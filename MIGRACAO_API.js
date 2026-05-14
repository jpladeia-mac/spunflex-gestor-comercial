// ============================================================
// GUIA DE MIGRAÇÃO: app.js para API segura
// ============================================================
//
// Este arquivo mostra COMO MIGRAR o código atual do app.js
// para usar a API segura do servidor ao invés de dados hardcoded.

// ============================================================
// 1. REMOVER: Carregamento de dados hardcoded
// ============================================================

// ❌ ANTES (INSEGURO):
// <script src="./data.js"></script>
// <script>
//   const data = window.SpunflexData;
// </script>

// ✅ DEPOIS (SEGURO):
// Remover tag <script src="./data.js"></script> do HTML
// Os dados serão carregados via API após autenticação


// ============================================================
// 2. ADICIONAR: Service para API
// ============================================================

class ApiClient {
  constructor() {
    this.baseURL = '/api';
    this.token = sessionStorage.getItem('auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expirado ou inválido
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

  // Auth endpoints
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

  // Data endpoints
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
}

// Instância global
const apiClient = new ApiClient();


// ============================================================
// 3. MODIFICAR: Função init()
// ============================================================

// ❌ ANTES:
// function init() {
//   setupLoginControls();
//   if (SECURITY.hostAuthRequired) {
//     recordAccess(...);
//     showApp();
//     bootApp();
//     return;
//   }
//   if (!SECURITY.allowClientAuth) {
//     showSecurityLock();
//     return;
//   }
//   ensureUserStore();
//   if (!isUserLoggedIn()) {
//     loginContainer.classList.remove("hidden");
//     ...
//   }
// }

// ✅ DEPOIS:
async function init() {
  setupLoginControls();
  
  // Verificar se token existe e ainda é válido
  const hasValidToken = await apiClient.verifyToken();
  
  if (hasValidToken) {
    const user = JSON.parse(sessionStorage.getItem('current_user') || 'null');
    if (user) {
      showApp();
      await bootApp();
      return;
    }
  }
  
  // Token expirado ou ausente - mostrar login
  loginContainer.classList.remove("hidden");
  appShell.classList.add("hidden");
  document.querySelector("#login-user").focus();
}


// ============================================================
// 4. MODIFICAR: Função login()
// ============================================================

// ❌ ANTES:
// async function login(username, password) {
//   if (!SECURITY.allowClientAuth) {
//     recordAccess(username || "sem usuario", "negado", "Autenticacao local desativada");
//     return null;
//   }
//   const normalizedUser = username.trim().toLowerCase();
//   const users = getUsers();
//   const found = users.find(u => normalizeUsername(u.username) === normalizedUser && u.active !== false);
//   if (!found) {
//     recordAccess(normalizedUser || "sem usuario", "negado", "Usuario inexistente ou inativo");
//     return null;
//   }
//   if (await passwordMatches(password, found.passwordHash)) {
//     ...
//     return currentUser;
//   }
//   recordAccess(normalizedUser, "negado", "Senha invalida");
//   return null;
// }

// ✅ DEPOIS:
async function login(username, password) {
  try {
    const user = await apiClient.login(username, password);
    showApp();
    bootApp();
    return user;
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    document.querySelector("#login-error").textContent = error.message || 'Erro ao fazer login';
    document.querySelector("#login-error").classList.remove("hidden");
    return null;
  }
}


// ============================================================
// 5. MODIFICAR: Função logout()
// ============================================================

// ❌ ANTES:
// function logout() {
//   if (SECURITY.hostAuthRequired) {
//     showToast(...);
//     return;
//   }
//   const currentUser = getCurrentUser();
//   if (currentUser) {
//     recordAccess(currentUser.username, "saida", "Sessao encerrada");
//   }
//   sessionStorage.removeItem(STORAGE_KEYS.authenticated);
//   sessionStorage.removeItem(STORAGE_KEYS.currentUser);
//   loginContainer.classList.remove("hidden");
//   appShell.classList.add("hidden");
//   ...
// }

// ✅ DEPOIS:
async function logout() {
  await apiClient.logout();
  
  loginContainer.classList.remove("hidden");
  appShell.classList.add("hidden");
  loginForm.reset();
  loginError.classList.add("hidden");
  document.querySelector("#login-user").focus();
}


// ============================================================
// 6. MODIFICAR: Carregamento de dados
// ============================================================

// ❌ ANTES: Dados acessados diretamente
// function getCustomerAggregates() {
//   const may = data.mayInvoices2026; // Acessar global data
//   ...
// }

// ✅ DEPOIS: Dados carregados via API
async function getCustomerAggregates() {
  try {
    const data = await apiClient.getInvoices();
    const may = data.mayInvoices2026;
    // ... resto da lógica
  } catch (error) {
    console.error('Erro ao carregar agregados:', error);
    showToast('Erro', 'Não foi possível carregar os dados', 'error');
  }
}


// ============================================================
// 7. ADICIONAR: Cache de dados com expiração
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

  clear() {
    this.cache.clear();
  }
}

const dataCache = new DataCache();

// Usar cache:
async function getOverviewCached() {
  const cached = dataCache.get('overview');
  if (cached) return cached;
  
  const data = await apiClient.getOverview();
  dataCache.set('overview', data);
  return data;
}


// ============================================================
// 8. REMOVER DO app.js
// ============================================================

// Remover estas funções/variáveis:
// - VALID_CREDENTIALS_HASH (credenciais não devem estar no código)
// - SEED_USERS (senhas hasheadas não devem estar no código)
// - getUsers() (usuários agora são gerenciados pelo servidor)
// - saveUsers() (usuários não persistem no localStorage)
// - passwordMatches() (validação acontece no servidor)
// - hashPasswordForStorage() (hashing acontece no servidor com bcrypt)
// - recordAccess() (logs agora ficam no servidor)

// Manter localStorage apenas para:
// - UI state (sidebar collapsed, tema, etc)
// - NÃO para dados sensíveis


// ============================================================
// 9. REMOVER DO HTML
// ============================================================

// ❌ Remove:
// <script src="./data.js"></script>
// <script src="./CORRECOES_SEGURANCA.js"></script> (se houver código de segurança)

// ✅ Manter:
// <script src="./styles.css"></script>
// <script src="./app.js"></script> (modificado para usar API)


// ============================================================
// 10. EXEMPLO DE USO COMPLETO
// ============================================================

/*

// Inicializar aplicação
await init();

// Usuário faz login
document.querySelector("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const username = document.querySelector("#login-user").value;
  const password = document.querySelector("#login-password").value;
  
  const user = await login(username, password);
  if (user) {
    console.log("Logado como:", user.displayName);
  }
});

// Carregar dados quando app inicializa
async function bootApp() {
  try {
    const overview = await apiClient.getOverview();
    const invoices = await apiClient.getInvoices();
    
    // Usar dados para renderizar UI
    render(overview, invoices);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('Erro', 'Não foi possível carregar os dados', 'error');
  }
}

// Fazer logout
document.querySelector("#logout-button").addEventListener("click", logout);

*/


// ============================================================
// CHECKLIST DE MIGRAÇÃO
// ============================================================

/*
[ ] 1. Criar ApiClient class com métodos para todos os endpoints
[ ] 2. Modificar init() para verificar token com /api/auth/verify
[ ] 3. Modificar login() para usar /api/auth/login
[ ] 4. Modificar logout() para usar /api/auth/logout
[ ] 5. Remover getUsers(), saveUsers() e funções de password hash
[ ] 6. Remover VALID_CREDENTIALS_HASH e SEED_USERS do código
[ ] 7. Remover recordAccess() (logs agora no servidor)
[ ] 8. Remover <script src="./data.js"> do HTML
[ ] 9. Adicionar DataCache class para cache com expiração
[ ] 10. Modificar todas as funções de dados para usar apiClient
[ ] 11. Testar fluxo completo de login/logout
[ ] 12. Validar que dados sensíveis não aparecem no DevTools
[ ] 13. Testar token expiração e refresh
[ ] 14. Verificar logs no servidor para auditoria
*/
