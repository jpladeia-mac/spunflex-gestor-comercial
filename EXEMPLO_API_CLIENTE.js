/**
 * EXEMPLO DE USO - API CLIENTE
 * 
 * Este arquivo mostra exemplos práticos de como usar a API segura
 * no arquivo app.js do cliente.
 */

// ============================================================
// 1. CLASSE API CLIENT
// ============================================================

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.token = sessionStorage.getItem('auth_token');
  }

  /**
   * Fazer requisição na API
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

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Se token expirou, fazer logout
    if (response.status === 401) {
      this.logout();
      window.location.href = '/';
      throw new Error('Sessão expirada');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro na requisição');
    }

    return response.json();
  }

  // ========================================================
  // AUTENTICAÇÃO
  // ========================================================

  async login(username, password) {
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
  }

  // ========================================================
  // DADOS
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
// 2. INSTÂNCIA GLOBAL
// ============================================================

const apiClient = new ApiClient();

// ============================================================
// 3. EXEMPLOS DE USO
// ============================================================

/**
 * EXEMPLO 1: Fazer login
 */
async function exampleLogin() {
  try {
    const user = await apiClient.login('rodrigo', 'senha123');
    console.log('Login bem-sucedido:', user);
    // {
    //   id: "user-rodrigo",
    //   username: "rodrigo",
    //   displayName: "Rodrigo",
    //   role: "admin"
    // }
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
  }
}

/**
 * EXEMPLO 2: Inicializar app (verificar autenticação)
 */
async function exampleInit() {
  // Verificar se token ainda é válido
  const isValid = await apiClient.verifyToken();
  
  if (isValid) {
    const user = JSON.parse(sessionStorage.getItem('current_user'));
    console.log('Usuário logado:', user.displayName);
    // Carregar dados e renderizar app
    await loadAndRenderApp();
  } else {
    console.log('Token expirado, redirecionar para login');
    showLoginPage();
  }
}

/**
 * EXEMPLO 3: Carregar dados gerais
 */
async function exampleLoadOverview() {
  try {
    const overview = await apiClient.getOverview();
    console.log('Dados gerais:', overview);
    // {
    //   company: "Spunflex",
    //   baseDate: "2026-05-04",
    //   currentMayBilling2026: { ... },
    //   currentMayOrders2026: { ... }
    // }
  } catch (error) {
    console.error('Erro ao carregar overview:', error.message);
  }
}

/**
 * EXEMPLO 4: Carregar faturamento
 */
async function exampleLoadInvoices() {
  try {
    const invoices = await apiClient.getInvoices();
    console.log('Faturamento:', invoices);
    // {
    //   period: { ... },
    //   totals: { ... },
    //   invoices: [ ... ]
    // }
    
    // Processar dados
    const totalRevenue = invoices.totals.revenue;
    console.log('Faturamento total: R$', totalRevenue);
  } catch (error) {
    console.error('Erro ao carregar invoices:', error.message);
  }
}

/**
 * EXEMPLO 5: Carregar histórico de vendas
 */
async function exampleLoadSalesHistory() {
  try {
    const history = await apiClient.getSalesHistory();
    console.log('Histórico:', history);
    // {
    //   monthlySales: [ ... ],
    //   dailyOrders: [ ... ]
    // }
    
    // Encontrar mês com maior revenue
    const topMonth = history.monthlySales.reduce((max, month) => 
      month.revenue > max.revenue ? month : max
    );
    console.log('Melhor mês:', topMonth);
  } catch (error) {
    console.error('Erro ao carregar histórico:', error.message);
  }
}

/**
 * EXEMPLO 6: Fazer logout
 */
async function exampleLogout() {
  await apiClient.logout();
  console.log('Logout realizado');
  // Redirecionar para login
  window.location.href = '/';
}

/**
 * EXEMPLO 7: Cache com expiração
 */
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

  clear() {
    this.cache.clear();
  }
}

const dataCache = new DataCache(5 * 60 * 1000); // 5 minutos

async function getOverviewCached() {
  // Verificar cache
  const cached = dataCache.get('overview');
  if (cached) {
    console.log('Retornando dados em cache');
    return cached;
  }
  
  // Carregar do servidor
  console.log('Carregando dados do servidor');
  const data = await apiClient.getOverview();
  
  // Guardar em cache
  dataCache.set('overview', data);
  
  return data;
}

/**
 * EXEMPLO 8: Integração com formulário de login
 */
function setupLoginForm() {
  const form = document.querySelector('#login-form');
  const errorDiv = document.querySelector('#login-error');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.querySelector('#login-user').value;
    const password = document.querySelector('#login-password').value;
    
    try {
      // Fazer login via API
      const user = await apiClient.login(username, password);
      
      // Sucesso - redirecionar para app
      console.log('Login bem-sucedido para:', user.displayName);
      window.location.href = '/dashboard';
    } catch (error) {
      // Erro - mostrar mensagem
      errorDiv.textContent = error.message || 'Erro ao fazer login';
      errorDiv.classList.remove('hidden');
      
      // Limpar campo de senha
      document.querySelector('#login-password').value = '';
      document.querySelector('#login-password').focus();
    }
  });
}

/**
 * EXEMPLO 9: Integração com botão de logout
 */
function setupLogoutButton() {
  const button = document.querySelector('#logout-button');
  
  button.addEventListener('click', async () => {
    if (confirm('Deseja realmente sair?')) {
      await apiClient.logout();
    }
  });
}

/**
 * EXEMPLO 10: Admin - Alterar senha
 */
async function exampleUpdatePassword() {
  try {
    const result = await apiClient.updatePassword(
      'user-rodrigo',
      'senha123',           // Senha atual
      'novaSenha123456'     // Senha nova (mín 12 chars)
    );
    
    console.log('Senha alterada com sucesso');
    alert('Senha alterada. Faça login novamente.');
    await apiClient.logout();
  } catch (error) {
    console.error('Erro ao alterar senha:', error.message);
    alert('Erro: ' + error.message);
  }
}

/**
 * EXEMPLO 11: Admin - Ver logs de acesso
 */
async function exampleGetAccessLogs() {
  try {
    const logs = await apiClient.getAccessLogs();
    console.table(logs);
    // [
    //   {
    //     timestamp: "2026-05-10T12:00:00.000Z",
    //     action: "login",
    //     username: "rodrigo",
    //     status: "permitido",
    //     details: "Login bem-sucedido"
    //   },
    //   ...
    // ]
  } catch (error) {
    console.error('Erro ao carregar logs:', error.message);
  }
}

// ============================================================
// 4. APLICAÇÃO COMPLETA EXEMPLO
// ============================================================

/**
 * Função principal - Inicializar aplicação
 */
async function initApp() {
  console.log('Iniciando Spunflex...');
  
  try {
    // 1. Verificar autenticação
    const isAuthenticated = await apiClient.verifyToken();
    
    if (!isAuthenticated) {
      // Não autenticado - mostrar login
      showLoginPage();
      setupLoginForm();
      return;
    }
    
    // 2. Usuário autenticado - carregar dados
    const user = JSON.parse(sessionStorage.getItem('current_user'));
    console.log('Bem-vindo,', user.displayName);
    
    // 3. Carregar dados do servidor
    const overview = await getOverviewCached();
    const invoices = await apiClient.getInvoices();
    const history = await apiClient.getSalesHistory();
    
    // 4. Renderizar dashboard
    showDashboard(overview, invoices, history);
    
    // 5. Setup para logout
    setupLogoutButton();
    
    // 6. Setup para refresh de dados (a cada 5 min)
    setInterval(async () => {
      console.log('Atualizando dados...');
      dataCache.clear(); // Limpar cache
      const newData = await getOverviewCached();
      updateDashboard(newData);
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    alert('Erro ao carregar dados: ' + error.message);
  }
}

/**
 * Mostrar página de login
 */
function showLoginPage() {
  const loginDiv = document.querySelector('#login-container');
  const appDiv = document.querySelector('#app-shell');
  
  loginDiv.classList.remove('hidden');
  appDiv.classList.add('hidden');
}

/**
 * Mostrar dashboard
 */
function showDashboard(overview, invoices, history) {
  const loginDiv = document.querySelector('#login-container');
  const appDiv = document.querySelector('#app-shell');
  
  loginDiv.classList.add('hidden');
  appDiv.classList.remove('hidden');
  
  // TODO: Renderizar dados no HTML
  console.log('Dashboard renderizado');
}

/**
 * Atualizar dashboard com novos dados
 */
function updateDashboard(newData) {
  // TODO: Atualizar elementos HTML com novos dados
  console.log('Dashboard atualizado');
}

// ============================================================
// 5. INICIALIZAR QUANDO PÁGINA CARREGA
// ============================================================

document.addEventListener('DOMContentLoaded', initApp);

// ============================================================
// 6. DICAS E BOAS PRÁTICAS
// ============================================================

/*
✅ BOM:
  - Usar sessionStorage para token (expira com aba)
  - Validar token ao inicializar app
  - Usar cache com expiração automática
  - Tratar erro 401 como sessão expirada
  - Fazer logout ao token expirar
  - Usar try/catch para tratamento de erro

❌ RUIM:
  - Armazenar token em localStorage (persiste)
  - Confiar que usuário está logado sem verificar
  - Não cachear dados (muitas requisições)
  - Ignorar erro 401
  - Armazenar dados sensíveis no sessionStorage
  - Expor token em console.log

🔐 SEGURANÇA:
  - Token é validado no servidor (não confie no cliente)
  - Senha nunca é armazenada (apenas token JWT)
  - Dados sensíveis retornam apenas com token válido
  - Logout invalida a sessão no servidor
  - Logs de auditoria são registrados no servidor
*/
