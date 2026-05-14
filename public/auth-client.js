/**
 * AUTH-CLIENT.JS - Módulo de Autenticação e API
 * 
 * Fornece:
 * - Classe ApiClient para comunicação com servidor
 * - Gerenciamento de JWT tokens
 * - Cache de dados com expiração
 * - Manipulação de erros e timeout
 */

// ============================================================
// CLASSE API CLIENT
// ============================================================

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.token = sessionStorage.getItem('auth_token');
    this.requestTimeout = 30000; // 30 segundos
  }

  /**
   * Fazer requisição na API com timeout e retry
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Adicionar token se existir
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Token expirado - fazer logout
      if (response.status === 401) {
        this.logout();
        window.location.href = '/';
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      // Erro na requisição
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Erro HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Requisição expirou. Tente novamente.');
      }

      throw error;
    }
  }

  // ========================================================
  // AUTENTICAÇÃO
  // ========================================================

  async login(username, password) {
    if (!username || !password) {
      throw new Error('Usuário e senha são obrigatórios');
    }

    const { token, user } = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    this.token = token;
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('current_user', JSON.stringify(user));

    return user;
  }

  async verifyToken() {
    try {
      const result = await this.request('/auth/verify', {
        method: 'POST'
      });
      return result.valid;
    } catch (error) {
      console.warn('Token inválido ou expirado');
      return false;
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }

    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('current_user');
    this.token = null;
  }

  getCurrentUser() {
    const userStr = sessionStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // ========================================================
  // DADOS - PUBLICOS
  // ========================================================

  async getOverview() {
    return this.request('/data/overview');
  }

  async getInvoices() {
    return this.request('/data/invoices');
  }

  async getSalesHistory() {
    return this.request('/data/sales-history');
  }

  // ========================================================
  // DADOS - ADMIN APENAS
  // ========================================================

  async getAllData() {
    return this.request('/data/all');
  }

  // ========================================================
  // ADMIN
  // ========================================================

  async getUsers() {
    return this.request('/admin/users');
  }

  async updatePassword(userId, currentPassword, newPassword) {
    if (newPassword.length < 12) {
      throw new Error('Senha deve ter ao menos 12 caracteres');
    }

    return this.request('/admin/user/update-password', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        currentPassword,
        newPassword
      })
    });
  }

  async getAccessLogs() {
    return this.request('/admin/access-logs');
  }
}

// ============================================================
// CACHE DE DADOS COM EXPIRAÇÃO
// ============================================================

class DataCache {
  constructor(ttlMs = 5 * 60 * 1000) { // 5 minutos padrão
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

// ============================================================
// GERENCIADOR DE UI PARA LOGIN/LOGOUT
// ============================================================

class AuthUI {
  constructor() {
    this.loginContainer = document.querySelector('#login-container');
    this.appShell = document.querySelector('#app-shell');
    this.loginForm = document.querySelector('#login-form');
    this.loginError = document.querySelector('#login-error');
    this.loginUserInput = document.querySelector('#login-user');
    this.loginPasswordInput = document.querySelector('#login-password');
    this.logoutButton = document.querySelector('#logout-button');
  }

  showLoginPage() {
    this.loginContainer.classList.remove('hidden');
    this.appShell.classList.add('hidden');
    this.loginForm.reset();
    this.hideLoginError();
    this.loginUserInput?.focus();
  }

  showAppPage() {
    this.loginContainer.classList.add('hidden');
    this.appShell.classList.remove('hidden');
  }

  showLoginError(message) {
    if (this.loginError) {
      this.loginError.textContent = message || 'Usuário ou senha inválidos';
      this.loginError.classList.remove('hidden');
    }
  }

  hideLoginError() {
    if (this.loginError) {
      this.loginError.classList.add('hidden');
    }
  }

  setCurrentUserDisplay(user) {
    const initials = (user.displayName || user.username)
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const badge = document.querySelector('#current-user-initials');
    if (badge) badge.textContent = initials;

    const name = document.querySelector('#current-user-name');
    if (name) name.textContent = user.displayName || user.username;
  }

  showLoading(show = true) {
    if (show) {
      this.loginForm?.classList.add('loading');
    } else {
      this.loginForm?.classList.remove('loading');
    }
  }
}

// ============================================================
// INSTÂNCIAS GLOBAIS
// ============================================================

const apiClient = new ApiClient();
const dataCache = new DataCache();
const authUI = new AuthUI();

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Obter dados com cache automático
 */
async function getDataWithCache(key, fetchFn, ttlMs = 5 * 60 * 1000) {
  // Verificar cache
  const cached = dataCache.get(key);
  if (cached) {
    console.log(`[Cache] Retornando dados em cache para: ${key}`);
    return cached;
  }

  // Carregar do servidor
  console.log(`[API] Carregando dados: ${key}`);
  const data = await fetchFn();

  // Guardar em cache
  dataCache.set(key, data);

  return data;
}

/**
 * Mostrar toast/notificação
 */
function showToast(title, message, type = 'info', duration = 3000) {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

  // TODO: Implementar toast visual se houver elemento no HTML
  // Por enquanto, apenas log no console
}

/**
 * Tratamento genérico de erro
 */
function handleError(error) {
  console.error('Erro:', error);

  if (error.message.includes('401') || error.message.includes('expirada')) {
    showToast('Sessão Expirada', 'Por favor, faça login novamente', 'error');
    apiClient.logout();
    authUI.showLoginPage();
  } else if (error.message.includes('timeout') || error.message.includes('expirou')) {
    showToast('Erro de Conexão', 'Tente novamente', 'error');
  } else {
    showToast('Erro', error.message, 'error');
  }
}

// ============================================================
// COMPATIBILIDADE COM APP.JS ANTIGO
// ============================================================

/**
 * Função que substitui window.SpunflexData
 * Carrega dados via API ao invés de global
 */
async function loadSpunflexData() {
  try {
    return await apiClient.getAllData();
  } catch (error) {
    handleError(error);
    return null;
  }
}

// Manter compatibilidade com código antigo
// window.SpunflexData será carregado dinamicamente
const data = null; // Será populado quando necessário

console.log('✅ Auth Client carregado');
console.log('   - apiClient: disponível globalmente');
console.log('   - dataCache: disponível globalmente');
console.log('   - authUI: disponível globalmente');
