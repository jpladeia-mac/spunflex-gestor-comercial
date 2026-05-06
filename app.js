const data = window.SpunflexData;

// Credenciais válidas (SHA-256). Para trocar a senha, gere um novo hash e atualize.
// Usuário atual: spunflex / Senha atual: 2026
const VALID_CREDENTIALS_HASH = {
  username: "8d8892fecf984b787f0fc090164b10925708e55651355c09a18740a7e9b4eca8",
  password: "158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab"
};

const STORAGE_KEYS = {
  authenticated: "spunflex_authenticated",
  currentUser: "spunflex.currentUser",
  users: "spunflex.users.v1",
  accessLogs: "spunflex.accessLogs.v1"
};

const VIEW_DEFINITIONS = [
  { id: "overview", label: "Dashboard" },
  { id: "sales", label: "Vendas" },
  { id: "representatives", label: "Representantes" },
  { id: "goals", label: "Metas" },
  { id: "entries", label: "Entradas" },
  { id: "finance", label: "Financeiro" },
  { id: "sources", label: "Fontes" },
  { id: "admin", label: "Admin" }
];

async function sha256Hex(text) {
  if (!window.crypto?.subtle) {
    return null;
  }

  const buffer = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const months = [
  { id: 1, short: "jan", name: "Janeiro" },
  { id: 2, short: "fev", name: "Fevereiro" },
  { id: 3, short: "mar", name: "Março" },
  { id: 4, short: "abr", name: "Abril" },
  { id: 5, short: "mai", name: "Maio" },
  { id: 6, short: "jun", name: "Junho" },
  { id: 7, short: "jul", name: "Julho" },
  { id: 8, short: "ago", name: "Agosto" },
  { id: 9, short: "set", name: "Setembro" },
  { id: 10, short: "out", name: "Outubro" },
  { id: 11, short: "nov", name: "Novembro" },
  { id: 12, short: "dez", name: "Dezembro" }
];

const state = {
  view: "overview",
  year: 2026,
  metric: "revenue",
  repSort: "revenue",
  repQuery: "",
  entryMetric: "totalValue"
};

const app = document.querySelector("#app");
const viewTitle = document.querySelector("#view-title");
const navButtons = [...document.querySelectorAll(".nav-button")];
const modal = document.querySelector("#source-modal");
const modalTitle = document.querySelector("#modal-title");
const modalImage = document.querySelector("#modal-image");
const sidebarToggle = document.querySelector("#toggle-sidebar");
const fullscreenToggle = document.querySelector("#toggle-fullscreen");
const sidebarScrim = document.querySelector("#sidebar-scrim");
const loginContainer = document.querySelector("#login-container");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const appShell = document.querySelector("#app-shell");

const defaultRevenueTarget = totalSales(2025).revenue * 1.15;
let appBooted = false;

init();

function isUserLoggedIn() {
  return sessionStorage.getItem(STORAGE_KEYS.authenticated) === "true" && Boolean(getCurrentUser());
}

async function login(username, password) {
  const normalizedUser = username.trim().toLowerCase();
  const users = getUsers();
  const found = users.find((user) => normalizeUsername(user.username) === normalizedUser && user.active !== false);

  if (!found) {
    recordAccess(normalizedUser || "sem usuario", "negado", "Usuario inexistente ou inativo");
    return null;
  }

  if (await passwordMatches(password, found.passwordHash)) {
    const updatedUsers = users.map((user) => {
      if (user.id !== found.id) return user;
      return {
        ...user,
        lastLoginAt: new Date().toISOString(),
        accessCount: Number(user.accessCount || 0) + 1
      };
    });
    saveUsers(updatedUsers);
    const currentUser = sessionUserFrom(updatedUsers.find((user) => user.id === found.id));
    setCurrentUser(currentUser);
    recordAccess(currentUser.username, "permitido", "Login efetuado");
    return currentUser;
  }

  recordAccess(normalizedUser, "negado", "Senha invalida");
  return null;
}

function logout() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    recordAccess(currentUser.username, "saida", "Sessao encerrada");
  }
  sessionStorage.removeItem(STORAGE_KEYS.authenticated);
  sessionStorage.removeItem(STORAGE_KEYS.currentUser);
  loginContainer.classList.remove("hidden");
  appShell.classList.add("hidden");
  loginForm.reset();
  loginError.classList.add("hidden");
  document.querySelector("#login-user").focus();
}

function showApp() {
  loginContainer.classList.add("hidden");
  appShell.classList.remove("hidden");
  updateNavigationAccess();
}

function init() {
  ensureUserStore();

  // Verificar autenticação
  if (!isUserLoggedIn()) {
    loginContainer.classList.remove("hidden");
    appShell.classList.add("hidden");

    loginForm.addEventListener("submit", handleLogin);
    setupPasswordToggle();
    document.querySelector("#login-user").focus();
    return;
  }

  // Usuário está logado, mostrar aplicação
  showApp();
  bootApp();
}

function bootApp() {
  if (appBooted) {
    applyStoredSidebarState();
    updateFullscreenButton();
    startClock();
    updateGreeting();
    render();
    return;
  }

  appBooted = true;
  applyStoredSidebarState();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  window.addEventListener("resize", handleResize);
  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarScrim.addEventListener("click", closeMobileSidebar);
  fullscreenToggle.addEventListener("click", toggleFullscreen);
  document.querySelector("#export-json").addEventListener("click", exportJson);
  document.querySelector("#logout-button").addEventListener("click", handleLogout);
  updateFullscreenButton();
  startClock();
  updateGreeting();
  render();
}

function setupPasswordToggle() {
  const toggle = document.querySelector("#toggle-password");
  const input = document.querySelector("#login-password");
  if (!toggle || !input) return;
  toggle.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    toggle.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
    toggle.setAttribute("title", showing ? "Mostrar senha" : "Ocultar senha");
    input.focus();
  });
}

function ensureUserStore() {
  const users = getUsers();
  if (!users.length) {
    saveUsers([defaultAdminUser()]);
    return;
  }

  const hasAdmin = users.some((user) => user.role === "admin");
  if (!hasAdmin) {
    saveUsers([defaultAdminUser(), ...users]);
  }
}

function defaultAdminUser() {
  const now = new Date().toISOString();
  return {
    id: "admin-spunflex",
    username: "spunflex",
    displayName: "Administrador Spunflex",
    role: "admin",
    active: true,
    passwordHash: VALID_CREDENTIALS_HASH.password,
    permissions: VIEW_DEFINITIONS.map((view) => view.id),
    createdAt: now,
    lastLoginAt: null,
    accessCount: 0
  };
}

function getUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((user) => ({
      ...user,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      active: user.active !== false
    }));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.currentUser) || "null");
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  sessionStorage.setItem(STORAGE_KEYS.authenticated, "true");
  sessionStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function sessionUserFrom(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || "user",
    permissions: user.role === "admin" ? VIEW_DEFINITIONS.map((view) => view.id) : user.permissions || []
  };
}

function isAdmin(user = getCurrentUser()) {
  return user?.role === "admin";
}

function hasPermission(view, user = getCurrentUser()) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return (user.permissions || []).includes(view);
}

function firstAllowedView(user = getCurrentUser()) {
  const first = VIEW_DEFINITIONS.find((view) => view.id !== "admin" && hasPermission(view.id, user));
  return first ? first.id : null;
}

function updateNavigationAccess() {
  const user = getCurrentUser();
  navButtons.forEach((button) => {
    const allowed = hasPermission(button.dataset.view, user);
    button.classList.toggle("nav-hidden", !allowed);
    button.disabled = !allowed;
    button.setAttribute("aria-hidden", allowed ? "false" : "true");
  });
}

async function hashPasswordForStorage(password) {
  const hash = await sha256Hex(password);
  return hash || `plain:${password}`;
}

async function passwordMatches(password, storedHash) {
  if (storedHash?.startsWith("plain:")) {
    return storedHash.slice(6) === password;
  }

  const hash = await sha256Hex(password);
  if (hash) return hash === storedHash;

  return storedHash === VALID_CREDENTIALS_HASH.password && password === "2026";
}

function getAccessLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.accessLogs) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccessLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.accessLogs, JSON.stringify(logs.slice(0, 250)));
}

function recordAccess(username, status, detail) {
  const logs = getAccessLogs();
  logs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    username,
    status,
    detail,
    timestamp: new Date().toISOString(),
    device: navigator.userAgent
  });
  saveAccessLogs(logs);
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function generatePasswordValue() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  let password = "";
  const values = new Uint32Array(12);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
    password = Array.from(values, (value) => chars[value % chars.length]).join("");
  } else {
    for (let i = 0; i < 12; i += 1) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return password;
}

async function createAdminUser() {
  if (!isAdmin()) return;

  const displayName = document.querySelector("#admin-display-name")?.value.trim();
  const username = normalizeUsername(document.querySelector("#admin-username")?.value || "");
  const password = document.querySelector("#admin-password")?.value || "";
  const role = document.querySelector("#admin-role")?.value || "user";
  const permissions = [...document.querySelectorAll("[name='new-user-permission']:checked")].map((input) => input.value);

  if (!displayName || !username || password.length < 6) {
    showToast("Dados incompletos", "Informe nome, login e uma senha com pelo menos 6 caracteres.", "error");
    return;
  }

  const users = getUsers();
  if (users.some((user) => normalizeUsername(user.username) === username)) {
    showToast("Login ja existe", "Escolha outro nome de usuario.", "error");
    return;
  }

  if (role !== "admin" && !permissions.length) {
    showToast("Sem permissao", "Autorize pelo menos uma pagina para este usuario.", "error");
    return;
  }

  const newUser = {
    id: `user-${Date.now()}`,
    username,
    displayName,
    role,
    active: true,
    passwordHash: await hashPasswordForStorage(password),
    permissions: role === "admin" ? VIEW_DEFINITIONS.map((view) => view.id) : permissions,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    accessCount: 0
  };

  saveUsers([...users, newUser]);
  recordAccess(getCurrentUser().username, "admin", `Usuario criado: ${username}`);
  render();
  showToast("Usuario criado", `Acesso de ${displayName} foi liberado.`, "success");
}

function updateUserPermission(userId, page, allowed) {
  if (!isAdmin()) return;
  const users = getUsers();
  const updated = users.map((user) => {
    if (user.id !== userId || user.role === "admin") return user;
    const permissions = new Set(user.permissions || []);
    if (allowed) permissions.add(page);
    else permissions.delete(page);
    return { ...user, permissions: [...permissions] };
  });
  saveUsers(updated);
  const user = updated.find((item) => item.id === userId);
  recordAccess(getCurrentUser().username, "admin", `Permissao atualizada: ${user?.username || userId}`);
  showToast("Permissao salva", "Autorizacao de pagina atualizada.", "success", 1800);
}

function updateUserActive(userId, active) {
  if (!isAdmin()) return;
  const currentUser = getCurrentUser();
  if (userId === currentUser?.id) {
    showToast("Acao bloqueada", "Voce nao pode desativar o proprio usuario.", "warning");
    render();
    return;
  }

  const users = getUsers();
  const updated = users.map((user) => user.id === userId ? { ...user, active } : user);
  saveUsers(updated);
  const user = updated.find((item) => item.id === userId);
  recordAccess(currentUser.username, "admin", `${active ? "Ativado" : "Desativado"}: ${user?.username || userId}`);
  showToast("Status salvo", `Usuario ${active ? "ativado" : "desativado"}.`, "success", 1800);
}

function deleteAdminUser(userId) {
  if (!isAdmin()) return;
  const currentUser = getCurrentUser();
  const users = getUsers();
  const target = users.find((user) => user.id === userId);
  if (!target || target.role === "admin" || target.id === currentUser?.id) {
    showToast("Acao bloqueada", "Administradores e usuario atual nao podem ser excluidos aqui.", "warning");
    return;
  }

  saveUsers(users.filter((user) => user.id !== userId));
  recordAccess(currentUser.username, "admin", `Usuario excluido: ${target.username}`);
  render();
  showToast("Usuario excluido", `${target.displayName || target.username} removido do painel.`, "success");
}

function startClock() {
  const time = document.querySelector("#clock-time");
  const date = document.querySelector("#clock-date");
  if (!time || !date) return;

  const tickClock = () => {
    const now = new Date();
    time.textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const formatted = now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
    date.textContent = formatted.replace(/\.$/, "").replace(/\.,/, ",");
  };

  tickClock();
  if (window.__spunflexClock) clearInterval(window.__spunflexClock);
  window.__spunflexClock = setInterval(tickClock, 30000);
}

function updateGreeting() {
  const el = document.querySelector("#topbar-greeting");
  if (!el) return;
  const hour = new Date().getHours();
  let greeting = "Boa noite";
  if (hour >= 5 && hour < 12) greeting = "Bom dia";
  else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
  el.textContent = greeting;
}

function showToast(title, message, type = "info", duration = 3600) {
  const container = document.querySelector("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✓", error: "!", warning: "⚠", info: "i" };
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ""}
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 240);
  }, duration);
}

function showLoadingBar(active = true) {
  const bar = document.querySelector("#loading-bar");
  if (!bar) return;
  bar.classList.toggle("is-active", active);
}

function handleLogout() {
  showToast("Sessão encerrada", "Até logo!", "info", 1800);
  setTimeout(logout, 200);
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.querySelector("#login-user").value;
  const password = document.querySelector("#login-password").value;
  const button = loginForm.querySelector(".login-button");

  button.classList.add("is-loading");

  try {
    const ok = await login(username, password);
    button.classList.remove("is-loading");
    if (ok) {
      loginError.classList.add("hidden");
      showApp();
      bootApp();
      showToast("Bem-vindo de volta!", "Dados carregados com sucesso.", "success");
    } else {
      loginError.classList.remove("hidden");
      document.querySelector("#login-password").value = "";
      document.querySelector("#login-password").focus();
    }
  } catch (err) {
    button.classList.remove("is-loading");
    loginError.classList.remove("hidden");
  }
}


function handleClick(event) {
  const nav = event.target.closest(".nav-button");
  if (nav) {
    setView(nav.dataset.view);
    closeMobileSidebar();
    return;
  }

  const jump = event.target.closest("[data-view-jump]");
  if (jump) {
    setView(jump.dataset.viewJump);
    return;
  }

  const metricButton = event.target.closest("[data-metric]");
  if (metricButton) {
    state.metric = metricButton.dataset.metric;
    render();
    return;
  }

  const yearButton = event.target.closest("[data-year]");
  if (yearButton) {
    state.year = Number(yearButton.dataset.year);
    render();
    return;
  }

  const repSort = event.target.closest("[data-rep-sort]");
  if (repSort) {
    state.repSort = repSort.dataset.repSort;
    render();
    return;
  }

  const entryMetric = event.target.closest("[data-entry-metric]");
  if (entryMetric) {
    state.entryMetric = entryMetric.dataset.entryMetric;
    render();
    return;
  }

  const openSource = event.target.closest("[data-open-source]");
  if (openSource) {
    showSource(openSource.dataset.openSource);
    return;
  }

  if (event.target.closest("[data-close-modal]")) {
    closeModal();
    return;
  }

  const saveGoal = event.target.closest("#save-goal");
  if (saveGoal) {
    const input = document.querySelector("#revenue-target");
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) {
      localStorage.setItem("spunflex.revenueTarget2026", String(value));
      render();
      showToast("Meta atualizada", "Nova meta de faturamento salva.", "success");
    } else {
      showToast("Valor inválido", "Informe um número positivo.", "error");
    }
    return;
  }

  const exportCsvButton = event.target.closest("[data-export-csv]");
  if (exportCsvButton) {
    exportFinanceCsv();
    showToast("Exportação concluída", "Arquivo spunflex-faturamento.csv gerado.", "success");
    return;
  }

  const generatePassword = event.target.closest("#generate-user-password");
  if (generatePassword) {
    const input = document.querySelector("#admin-password");
    if (input) {
      input.value = generatePasswordValue();
      input.focus();
      input.select();
    }
    return;
  }

  const createUser = event.target.closest("#create-admin-user");
  if (createUser) {
    createAdminUser();
    return;
  }

  const permissionToggle = event.target.closest("[data-user-permission]");
  if (permissionToggle) {
    updateUserPermission(permissionToggle.dataset.userPermission, permissionToggle.dataset.page, permissionToggle.checked);
    return;
  }

  const activeToggle = event.target.closest("[data-toggle-user-active]");
  if (activeToggle) {
    updateUserActive(activeToggle.dataset.toggleUserActive, activeToggle.checked);
    return;
  }

  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser) {
    deleteAdminUser(deleteUser.dataset.deleteUser);
  }
}

function handleInput(event) {
  if (event.target.matches("#rep-search")) {
    state.repQuery = event.target.value;
    renderRepresentativesList();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeMobileSidebar();
  }
}

function setView(view) {
  if (!hasPermission(view)) {
    showToast("Acesso restrito", "Seu usuario nao esta autorizado para esta pagina.", "warning");
    return;
  }
  state.view = view;
  render();
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function handleResize() {
  if (!isMobileLayout()) {
    closeMobileSidebar();
  }
}

function applyStoredSidebarState() {
  const collapsed = localStorage.getItem("spunflex.sidebarCollapsed") === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  updateSidebarButton(collapsed);
}

function toggleSidebar() {
  if (isMobileLayout()) {
    const open = !document.body.classList.contains("sidebar-open");
    document.body.classList.toggle("sidebar-open", open);
    updateSidebarButton(open ? false : document.body.classList.contains("sidebar-collapsed"));
    return;
  }

  const collapsed = !document.body.classList.contains("sidebar-collapsed");
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  localStorage.setItem("spunflex.sidebarCollapsed", String(collapsed));
  updateSidebarButton(collapsed);
}

function updateSidebarButton(collapsed) {
  const mobile = isMobileLayout();
  const mobileOpen = document.body.classList.contains("sidebar-open");
  const label = mobile
    ? (mobileOpen ? "Fechar menu" : "Abrir menu")
    : (collapsed ? "Expandir menu" : "Recolher menu");
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.setAttribute("title", label);
}

function closeMobileSidebar() {
  if (!document.body.classList.contains("sidebar-open")) return;
  document.body.classList.remove("sidebar-open");
  updateSidebarButton(document.body.classList.contains("sidebar-collapsed"));
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    return;
  }

  document.exitFullscreen?.();
}

function updateFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  fullscreenToggle.setAttribute("aria-label", active ? "Sair da tela cheia" : "Entrar em tela cheia");
  fullscreenToggle.setAttribute("title", active ? "Sair da tela cheia" : "Tela cheia");
}

function render() {
  const currentUser = getCurrentUser();
  if (!hasPermission(state.view, currentUser)) {
    const fallbackView = firstAllowedView(currentUser);
    if (!fallbackView) {
      viewTitle.textContent = "Acesso restrito";
      updateNavigationAccess();
      app.innerHTML = renderAccessDenied();
      return;
    }
    state.view = fallbackView;
  }

  const titles = {
    overview: "Dashboard Estratégico",
    sales: "Vendas",
    representatives: "Representantes",
    goals: "Metas",
    entries: "Entradas",
    finance: "Financeiro",
    sources: "Fontes",
    admin: "Administração"
  };

  viewTitle.textContent = titles[state.view];
  updateNavigationAccess();
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));

  const views = {
    overview: renderOverview,
    sales: renderSales,
    representatives: renderRepresentatives,
    goals: renderGoals,
    entries: renderEntries,
    finance: renderFinance,
    sources: renderSources,
    admin: renderAdmin
  };

  showLoadingBar(true);
  app.innerHTML = views[state.view] ? views[state.view]() : renderAccessDenied();
  app.style.animation = "none";
  // force reflow to restart the entry animation on each render
  void app.offsetWidth;
  app.style.animation = "";
  setTimeout(() => showLoadingBar(false), 220);
}

function renderOverview() {
  const throughMonth = latestMonth(2026);
  const ytd = totalSales(2026, throughMonth);
  const prevYtd = totalSales(2025, throughMonth);
  const total2025 = totalSales(2025);
  const aprilSales = salesRecord(2026, 4);
  const aprilEntries = data.monthlyEntries2026.find((row) => row.month === 4);
  const repTotals = totalRepresentatives();
  const forecast = (ytd.revenue / throughMonth) * 12;
  const forecastGrowth = change(forecast, total2025.revenue);
  const ytdGrowth = change(ytd.revenue, prevYtd.revenue);
  const ytdWeightGrowth = change(ytd.weightKg, prevYtd.weightKg);
  const avgPrice2026 = ytd.revenue / ytd.weightKg;
  const avgPrice2025 = total2025.revenue / total2025.weightKg;
  const aprilAvgPrice = aprilSales.revenue / aprilSales.weightKg;
  const concentration = representativeConcentration();
  const direct = directChannels();
  const reconciliation = {
    revenue: aprilSales.revenue - aprilEntries.merchandiseValue,
    weight: aprilSales.weightKg - aprilEntries.weightKg
  };

  const monthRows = data.monthlySales
    .filter((row) => row.year === 2026)
    .map((row) => ({
      label: monthName(row.month, "short"),
      value: row.revenue,
      valueLabel: formatBRL(row.revenue),
      color: row.month === 4 ? "amber" : ""
    }));

  const strategicRows = [
    {
      indicator: "Fechamento mensal",
      status: ytdGrowth >= 0.3 ? "Forte" : "Acompanhar",
      target: `Referência: ${formatBRL(aprilSales.revenue)}/mês`,
      trigger: "Abaixo de 90% da referência até a semana 3",
      action: "Revisar carteira, pedidos em aberto e negociações travadas."
    },
    {
      indicator: "R$/kg mínimo",
      status: aprilAvgPrice > avgPrice2026 ? "Melhorando" : "Pressão",
      target: `Referência: ${formatBRL(aprilAvgPrice)}/kg`,
      trigger: `Abaixo da média parcial de 2026: ${formatBRL(avgPrice2026)}/kg`,
      action: "Bloquear desconto fora da política ou aprovar exceção formal."
    },
    {
      indicator: "Dependência Top 5",
      status: concentration.top5Share > 0.6 ? "Risco" : "Saudável",
      target: "Meta sugerida: até 58% do faturamento mensal",
      trigger: `Atual: ${formatPercent(concentration.top5Share)}`,
      action: "Acelerar representantes intermediários e mapear clientes concentrados."
    },
    {
      indicator: "Força interna",
      status: "Alavanca",
      target: `Manter acima de 30% do mês`,
      trigger: `Atual: ${formatPercent(direct.share)}`,
      action: "Separar recompra, prospecção e carteira ativa da venda interna."
    },
    {
      indicator: "Conciliação operacional",
      status: "Conciliar",
      target: "Fechar divergências por DataEmissao x Data de Entrada",
      trigger: `${formatBRL(reconciliation.revenue)} e ${formatKg(reconciliation.weight, 2)} em abril`,
      action: "Criar rotina de conciliação entre comercial, operação e financeiro."
    }
  ];

  return `
    <div class="section-grid">
      ${kpiCard("Faturamento jan-abr", formatBRL(ytd.revenue), `${formatPercent(ytdGrowth)} vs jan-abr/2025`, "green")}
      ${kpiCard("Projeção 2026", formatBRL(forecast), `${formatPercent(forecastGrowth)} vs fechamento de 2025`, "blue")}
      ${kpiCard("Preço médio 2026", formatBRL(avgPrice2026), `${formatBRL(aprilAvgPrice)}/kg em abril`, "amber")}
      ${kpiCard("Concentração Top 5", formatPercent(concentration.top5Share), `${concentration.top1.name} lidera com ${formatPercent(concentration.top1Share)}`, "red")}

      <article class="panel span-12 management-hero">
        <div class="panel-header">
          <div>
            <h2>Situação executiva</h2>
            <p>Leitura consolidada para orientar decisões comerciais com a base disponível.</p>
          </div>
          <span class="status-pill">Crescimento forte</span>
        </div>
        <div class="management-grid">
          ${managementCard("Crescer com controle", `A operação está acelerando: ${formatPercent(ytdGrowth)} de crescimento em faturamento no ano contra 2025.`, "Prioridade: transformar abril em novo piso mensal.")}
          ${managementCard("Proteger preço", `O preço médio de abril chegou a ${formatBRL(aprilAvgPrice)}/kg, acima da média parcial de 2026.`, "Prioridade: bloquear descontos que derrubem R$/kg.")}
          ${managementCard("Reduzir dependência", `O Top 5 concentra ${formatPercent(concentration.top5Share)} do mês de abril.`, "Prioridade: plano de ativação para a base intermediária.")}
          ${managementCard("Conciliar operação", `Entradas e faturamento de abril não são a mesma base e diferem em ${formatBRL(reconciliation.revenue)}.`, "Prioridade: funil único de pedido, faturamento, entrada e recebimento.")}
        </div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Meta e projeção</h2>
            <p>Progresso contra meta local, com projeção linear pelo ritmo jan-abr.</p>
          </div>
          <span class="status-pill blue">Forecast</span>
        </div>
        ${goalProgress(ytd.revenue)}
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Painel de controle semanal</h2>
            <p>Régua operacional com referência, gatilho e ação de gestão.</p>
          </div>
        </div>
        ${strategicDecisionTable(strategicRows)}
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Ritmo comercial 2026</h2>
            <p>Faturamento mensal por data de emissão; abril é o mês de referência.</p>
          </div>
          <span class="status-pill amber">Abril: ${formatBRL(aprilSales.revenue)}</span>
        </div>
        ${barList(monthRows)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Mapa comercial de abril</h2>
            <p>Resumo de canais e concentração para gestão de carteira.</p>
          </div>
          <button class="ghost-button" type="button" data-view-jump="representatives">Detalhar</button>
        </div>
        <div class="stat-stack">
          <div><span>Total geral faturado</span><strong>${formatBRL(aprilSales.revenue)}</strong><small>${formatKg(aprilSales.weightKg)} no faturamento da empresa</small></div>
          <div><span>Venda direta/interna</span><strong>${formatBRL(direct.revenue, 0)}</strong><small>${formatPercent(direct.share)} do mês</small></div>
          <div><span>Maior representante</span><strong>${formatBRL(concentration.top1.revenue, 0)}</strong><small>${concentration.top1.name}</small></div>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Prioridades executivas</h2>
            <p>Recomendações práticas para os próximos 30 dias.</p>
          </div>
        </div>
        <div class="priority-grid">
          ${priorityItem("Meta de maio", "Usar abril como referência e acompanhar semanalmente realizado x projetado.")}
          ${priorityItem("Preço mínimo", "Definir piso de R$/kg e registrar exceções aprovadas pela diretoria.")}
          ${priorityItem("Carteira média", "Criar plano para representantes fora do Top 5 aumentarem participação.")}
          ${priorityItem("Pipeline financeiro", "Adicionar contas a receber, prazo médio e inadimplência ao histórico financeiro.")}
        </div>
      </article>
    </div>
  `;
}

function renderSales() {
  const metricLabel = state.metric === "revenue" ? "Faturamento" : "Peso";
  const rows = months.map((month) => {
    const record = salesRecord(state.year, month.id);
    return {
      label: month.short,
      value: record ? record[state.metric] : 0,
      valueLabel: record ? formatMetric(record[state.metric], state.metric) : "Sem dado",
      color: state.metric === "revenue" ? "" : "blue"
    };
  });

  return `
    <div class="section-grid">
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Histórico de vendas</h2>
            <p>Compare faturamento e peso por mês entre 2023 e 2026.</p>
          </div>
          <div class="control-row">
            ${metricButtons()}
            ${yearButtons()}
          </div>
        </div>
        ${barList(rows)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Resumo ${state.year}</h2>
            <p>Totais conforme meses disponíveis na fonte.</p>
          </div>
          <span class="status-pill">${metricLabel}</span>
        </div>
        ${yearSummary(state.year)}
      </article>

      <article class="panel span-12 representatives-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Comparativo jan-abr</h2>
            <p>Recorte usado para comparar 2026 contra anos completos anteriores.</p>
          </div>
        </div>
        ${comparisonTable()}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela mensal - ${metricLabel}</h2>
            <p>Valores digitados a partir da tabela histórica.</p>
          </div>
        </div>
        ${pivotTable(state.metric)}
      </article>
    </div>
  `;
}

function renderRepresentatives() {
  const totals = totalRepresentatives();
  const top = sortedRepresentatives("revenue")[0];
  const share = top.revenue / totals.revenue;

  return `
    <div class="section-grid">
      ${kpiCard("Total abril por representantes", formatBRL(totals.revenue, 0), `${formatKg(totals.weightKg)} no ranking`, "green")}
      ${kpiCard("Preço médio do ranking", formatBRL(totals.revenue / totals.weightKg), "Faturamento dividido pelo peso", "blue")}
      ${kpiCard("Maior participação", formatPercent(share), `${top.name} por faturamento`, "amber")}
      ${kpiCard("Representantes listados", String(data.representativesApril2026.length), "Inclui venda direta e venda interna", "red")}

      <article class="panel span-12 representatives-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Detalhe por representante</h2>
            <p>Busca local sobre os dados extraídos da imagem de abril. A lista permanece ordenada pelo faturamento.</p>
          </div>
        </div>
        <input class="search-input" id="rep-search" type="search" placeholder="Buscar representante" value="${escapeHtml(state.repQuery)}">
        <div id="rep-list">
          ${representativesTable()}
        </div>
      </article>
    </div>
  `;
}

function renderGoals() {
  const targetKg = 450000;
  const businessDays = 20;
  const aprilSales = salesRecord(2026, 4);
  const repTotals = totalRepresentatives();
  const companyAvgPrice = aprilSales.revenue / aprilSales.weightKg;
  const rankingAvgPrice = repTotals.revenue / repTotals.weightKg;
  const companyRevenueTarget = targetKg * companyAvgPrice;
  const rankingRevenueTarget = targetKg * rankingAvgPrice;
  const aprilCompanyGrowth = change(targetKg, aprilSales.weightKg);
  const aprilRankingGrowth = change(targetKg, repTotals.weightKg);
  const plan = mayGoalPlan(targetKg);
  const projectedRevenue = plan.reduce((sum, row) => sum + row.targetRevenue, 0);

  const topRows = plan.slice(0, 8).map((row) => ({
    label: row.name,
    value: row.targetKg,
    valueLabel: `${formatTon(row.targetKg)} | ${formatBRL(row.targetRevenue, 0)}`,
    color: row.name.startsWith("VENDA") ? "amber" : "blue"
  }));

  return `
    <div class="section-grid">
      ${kpiCard("Meta maio", "450 t", `${formatKg(targetKg)} para executar`, "green")}
      ${kpiCard("Ritmo diário", `${formatTon(targetKg / businessDays)}/dia`, `${businessDays} dias úteis comerciais`, "blue")}
      ${kpiCard("Faturamento alvo", formatBRL(companyRevenueTarget), `Usando R$/kg geral de abril: ${formatBRL(companyAvgPrice)}`, "amber")}
      ${kpiCard("Crescimento necessário", formatPercent(aprilCompanyGrowth), "vs peso faturado geral de abril", "red")}

      <article class="panel span-12 management-hero">
        <div class="panel-header">
          <div>
            <h2>Plano de execução de maio</h2>
            <p>Distribuição da meta de 450t pela participação de peso do ranking comercial de abril.</p>
          </div>
          <span class="status-pill">Simulação</span>
        </div>
        <div class="management-grid">
          ${managementCard("Base de divisão", `A meta foi rateada pela participação de cada representante/canal nos ${formatKg(repTotals.weightKg)} do ranking de abril.`, "Use como ponto de partida para negociação da carteira.")}
          ${managementCard("Esforço comercial", `450t representa ${formatPercent(aprilRankingGrowth)} sobre o volume do ranking de abril.`, "Cada representante precisa crescer na mesma proporção se o mix for mantido.")}
          ${managementCard("Projeção conservadora", `Pelo R$/kg do ranking de abril, o plano projeta ${formatBRL(rankingRevenueTarget)}.`, "A diferença para o alvo geral vem do mix e preço médio por base.")}
          ${managementCard("Meta diretoria", `Mantendo o preço médio geral de abril, o alvo financeiro fica em ${formatBRL(companyRevenueTarget)}.`, "Acompanhar R$/kg para não bater tonelada perdendo valor.")}
        </div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Top metas por volume</h2>
            <p>Maiores alvos de maio pela participação de abril.</p>
          </div>
        </div>
        ${barList(topRows)}
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Controle da meta</h2>
            <p>Indicadores de execução para acompanhamento semanal.</p>
          </div>
        </div>
        <div class="stat-stack">
          <div><span>Meta semanal média</span><strong>${formatTon(targetKg / 4)}</strong><small>Referência simples para quatro semanas de maio</small></div>
          <div><span>Meta diária</span><strong>${formatTon(targetKg / businessDays)}</strong><small>Ritmo mínimo para cumprir 450t</small></div>
          <div><span>Faturamento simulado por representante</span><strong>${formatBRL(projectedRevenue, 0)}</strong><small>Soma por R$/kg individual de abril</small></div>
        </div>
      </article>

      <article class="panel span-12 representatives-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Rateio da meta por representante/canal</h2>
            <p>Volume, participação, R$/kg histórico e faturamento estimado para maio.</p>
          </div>
        </div>
        ${mayGoalTable(plan, targetKg)}
      </article>
    </div>
  `;
}

function renderEntries() {
  const april = data.monthlyEntries2026.find((row) => row.month === 4);
  const totals = totalDailyEntries();
  const rows = data.dailyEntriesApril2026.map((row) => ({
    label: formatDay(row.date),
    value: row[state.entryMetric],
    valueLabel: formatEntryMetric(row[state.entryMetric], state.entryMetric),
    color: state.entryMetric === "totalKg" ? "blue" : state.entryMetric === "avgPrice" ? "amber" : ""
  }));

  return `
    <div class="section-grid">
      ${kpiCard("Entradas abr/2026", formatBRL(april.merchandiseValue), `${formatKg(april.weightKg, 2)} na visão mensal`, "green")}
      ${kpiCard("Média R$/dia", formatBRL(april.merchandiseValue / data.dailyEntriesApril2026.length), "19 dias com entrada", "blue")}
      ${kpiCard("Média kg/dia", formatKg(april.weightKg / data.dailyEntriesApril2026.length, 0), "Imagem informa 18.707 kg/dia", "amber")}
      ${kpiCard("Preço médio", formatBRL(april.merchandiseValue / april.weightKg), "Imagem informa R$ 18,88/kg", "red")}

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Entradas diárias de abril</h2>
            <p>Alterna entre valor, peso e preço médio por dia.</p>
          </div>
          <div class="control-row">
            ${entryMetricButtons()}
          </div>
        </div>
        ${barList(rows)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Composição por tipo</h2>
            <p>Corte 1, Corte 2 e Rebo no fechamento diário.</p>
          </div>
        </div>
        ${entryComposition(totals)}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela diária</h2>
            <p>Dados transcritos da imagem de entradas de abril.</p>
          </div>
        </div>
        ${entriesTable()}
      </article>
    </div>
  `;
}

function renderFinance() {
  const throughMonth = latestMonth(2026);
  const ytd = totalSales(2026, throughMonth);
  const total2025 = totalSales(2025);
  const forecast = (ytd.revenue / throughMonth) * 12;
  const target = getRevenueTarget();

  return `
    <div class="section-grid">
      ${kpiCard("Faturamento 2023", formatBRL(totalSales(2023).revenue, 0), `${formatKg(totalSales(2023).weightKg)} vendidos`, "blue")}
      ${kpiCard("Faturamento 2024", formatBRL(totalSales(2024).revenue, 0), `${formatPercent(change(totalSales(2024).revenue, totalSales(2023).revenue))} vs 2023`, "green")}
      ${kpiCard("Faturamento 2025", formatBRL(total2025.revenue, 0), `${formatPercent(change(total2025.revenue, totalSales(2024).revenue))} vs 2024`, "amber")}
      ${kpiCard("Parcial 2026", formatBRL(ytd.revenue), `Projeção linear ${formatBRL(forecast)}`, "red")}

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Meta financeira 2026</h2>
            <p>Editável e salva neste navegador.</p>
          </div>
        </div>
        ${goalProgress(ytd.revenue)}
        <div class="goal-form">
          <input id="revenue-target" type="number" min="1" step="1000" value="${Math.round(target)}" aria-label="Meta de faturamento 2026">
          <button class="primary-button" id="save-goal" type="button">Salvar meta</button>
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Vendas x entradas em 2026</h2>
            <p>Compara DataEmissao com Data de Entrada, mantendo cada fonte separada.</p>
          </div>
        </div>
        ${salesVsEntriesTable()}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Histórico financeiro de faturamento</h2>
            <p>Valores comerciais por mês e ano conforme tabela histórica.</p>
          </div>
          <button class="ghost-button" type="button" data-export-csv>Exportar CSV</button>
        </div>
        ${financeTable()}
      </article>
    </div>
  `;
}

function renderSources() {
  return `
    <div class="section-grid">
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Auditoria das imagens</h2>
            <p>Cada imagem foi revisada e os pontos principais foram incorporados ao sistema.</p>
          </div>
          <span class="status-pill">${data.sources.length} fontes</span>
        </div>
        ${noteList(data.auditNotes)}
      </article>

      <div class="span-12 source-grid">
        ${data.sources.map(sourceCard).join("")}
      </div>
    </div>
  `;
}

function renderAdmin() {
  if (!isAdmin()) return renderAccessDenied();

  const users = getUsers();
  const logs = getAccessLogs();
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((log) => log.timestamp.slice(0, 10) === today);
  const deniedToday = todayLogs.filter((log) => log.status === "negado").length;

  return `
    <div class="section-grid">
      ${kpiCard("Usuários cadastrados", String(users.length), `${users.filter((user) => user.active !== false).length} ativos`, "blue")}
      ${kpiCard("Acessos hoje", String(todayLogs.filter((log) => log.status === "permitido").length), "Logins autorizados neste navegador", "green")}
      ${kpiCard("Tentativas negadas", String(deniedToday), "Falhas de senha ou usuario", deniedToday ? "red" : "amber")}
      ${kpiCard("Páginas controladas", String(VIEW_DEFINITIONS.length), "Permissão individual por aba", "green")}

      <article class="panel span-5 admin-form-panel">
        <div class="panel-header">
          <div>
            <h2>Novo usuário</h2>
            <p>Gere login, senha e autorize quais páginas o usuário poderá acessar.</p>
          </div>
          <span class="status-pill blue">Admin</span>
        </div>
        <div class="admin-form">
          <label>Nome
            <input id="admin-display-name" type="text" placeholder="Ex.: Comercial Interno">
          </label>
          <label>Login
            <input id="admin-username" type="text" placeholder="ex.: comercial01" autocomplete="off">
          </label>
          <label>Senha
            <div class="admin-password-row">
              <input id="admin-password" type="text" placeholder="Clique em gerar ou digite">
              <button class="ghost-button" id="generate-user-password" type="button">Gerar</button>
            </div>
          </label>
          <label>Perfil
            <select id="admin-role">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <fieldset class="permission-grid">
            <legend>Autorizações de páginas</legend>
            ${VIEW_DEFINITIONS.filter((view) => view.id !== "admin").map((view) => `
              <label><input type="checkbox" name="new-user-permission" value="${view.id}" checked> ${view.label}</label>
            `).join("")}
          </fieldset>
          <button class="primary-button" id="create-admin-user" type="button">Criar acesso</button>
        </div>
      </article>

      <article class="panel span-7 admin-users-panel">
        <div class="panel-header">
          <div>
            <h2>Usuários e permissões</h2>
            <p>Marque as páginas liberadas. Administradores sempre acessam tudo.</p>
          </div>
        </div>
        ${adminUsersTable(users)}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Histórico de acessos</h2>
            <p>Registro local de login, saída e tentativas negadas neste navegador.</p>
          </div>
          <span class="status-pill">${logs.length} registros</span>
        </div>
        ${accessLogsTable(logs)}
      </article>
    </div>
  `;
}

function renderAccessDenied() {
  return `
    <div class="section-grid">
      <article class="panel span-12">
        <div class="empty-state">
          <strong>Acesso nao autorizado</strong>
          <span>Solicite ao administrador a liberacao desta pagina.</span>
        </div>
      </article>
    </div>
  `;
}

function adminUsersTable(users) {
  const currentUser = getCurrentUser();
  const pageViews = VIEW_DEFINITIONS.filter((view) => view.id !== "admin");
  const rows = users.map((user) => {
    const admin = user.role === "admin";
    return `
      <tr>
        <td>
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <small>${escapeHtml(user.username)}</small>
        </td>
        <td><span class="status-pill ${admin ? "blue" : ""}">${admin ? "Admin" : "Usuário"}</span></td>
        <td>
          <label class="switch-label">
            <input type="checkbox" data-toggle-user-active="${user.id}" ${user.active !== false ? "checked" : ""} ${user.id === currentUser?.id ? "disabled" : ""}>
            Ativo
          </label>
        </td>
        ${pageViews.map((view) => `
          <td>
            <input type="checkbox" data-user-permission="${user.id}" data-page="${view.id}" ${admin || (user.permissions || []).includes(view.id) ? "checked" : ""} ${admin ? "disabled" : ""} aria-label="${view.label}">
          </td>
        `).join("")}
        <td>${user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-"}</td>
        <td>
          <button class="ghost-button danger-ghost table-action" type="button" data-delete-user="${user.id}" ${user.id === currentUser?.id || admin ? "disabled" : ""}>Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="data-table-wrap admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Perfil</th>
            <th>Status</th>
            ${pageViews.map((view) => `<th>${view.label}</th>`).join("")}
            <th>Último acesso</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function accessLogsTable(logs) {
  if (!logs.length) {
    return `<div class="empty-state">Nenhum acesso registrado ainda.</div>`;
  }

  const rows = logs.slice(0, 80).map((log) => `
    <tr>
      <td>${formatDateTime(log.timestamp)}</td>
      <td>${escapeHtml(log.username)}</td>
      <td><span class="status-pill ${log.status === "negado" ? "red" : log.status === "saida" ? "amber" : "blue"}">${escapeHtml(log.status)}</span></td>
      <td>${escapeHtml(log.detail)}</td>
    </tr>
  `).join("");

  return `
    <div class="data-table-wrap access-log-wrap">
      <table>
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Usuário</th>
            <th>Status</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRepresentativesList() {
  const list = document.querySelector("#rep-list");
  if (list) {
    list.innerHTML = representativesTable();
  }
}

function metricButtons() {
  return `
    <button class="chip-button ${state.metric === "revenue" ? "active" : ""}" type="button" data-metric="revenue">Faturamento</button>
    <button class="chip-button ${state.metric === "weightKg" ? "active" : ""}" type="button" data-metric="weightKg">Peso</button>
  `;
}

function yearButtons() {
  return [2023, 2024, 2025, 2026]
    .map((year) => `<button class="chip-button ${state.year === year ? "active" : ""}" type="button" data-year="${year}">${year}</button>`)
    .join("");
}

function repSortButtons() {
  const options = [
    ["revenue", "Reais"],
    ["weightKg", "Peso"],
    ["avg", "R$/kg"]
  ];

  return options
    .map(([key, label]) => `<button class="chip-button ${state.repSort === key ? "active" : ""}" type="button" data-rep-sort="${key}">${label}</button>`)
    .join("");
}

function entryMetricButtons() {
  const options = [
    ["totalValue", "Reais"],
    ["totalKg", "Peso"],
    ["avgPrice", "R$/kg"]
  ];

  return options
    .map(([key, label]) => `<button class="chip-button ${state.entryMetric === key ? "active" : ""}" type="button" data-entry-metric="${key}">${label}</button>`)
    .join("");
}

function kpiCard(label, value, note, tone = "green") {
  const toneClass = tone === "green" ? "" : tone;
  return `
    <article class="kpi-card span-3 ${toneClass}">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <strong class="kpi-value">${value}</strong>
      <span class="kpi-note">${escapeHtml(note)}</span>
    </article>
  `;
}

function yearSummary(year) {
  const total = totalSales(year);
  const availableMonths = data.monthlySales.filter((row) => row.year === year).length;
  const avgRevenue = total.revenue / availableMonths;
  const avgWeight = total.weightKg / availableMonths;

  return `
    <div class="stat-strip">
      <div><span>Faturamento</span><strong>${formatBRL(total.revenue, year === 2026 ? 2 : 0)}</strong></div>
      <div><span>Peso</span><strong>${formatKg(total.weightKg)}</strong></div>
      <div><span>Média mensal</span><strong>${formatBRL(avgRevenue, year === 2026 ? 2 : 0)}</strong></div>
    </div>
    <div class="stat-strip" style="margin-top:10px">
      <div><span>Meses na base</span><strong>${availableMonths}</strong></div>
      <div><span>Kg/mês</span><strong>${formatKg(avgWeight)}</strong></div>
      <div><span>R$/kg</span><strong>${formatBRL(total.revenue / total.weightKg)}</strong></div>
    </div>
  `;
}

function comparisonTable() {
  const years = [2023, 2024, 2025, 2026];
  const rows = years.map((year) => {
    const total = totalSales(year, 4);
    const previous = year > 2023 ? totalSales(year - 1, 4) : null;
    const revenueChange = previous ? change(total.revenue, previous.revenue) : null;
    const weightChange = previous ? change(total.weightKg, previous.weightKg) : null;
    return `
      <tr>
        <td>${year}</td>
        <td>${formatBRL(total.revenue, year === 2026 ? 2 : 0)}</td>
        <td>${formatKg(total.weightKg)}</td>
        <td>${revenueChange === null ? "-" : comparisonCell(revenueChange)}</td>
        <td>${weightChange === null ? "-" : comparisonCell(weightChange)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ano</th>
            <th>Faturamento jan-abr</th>
            <th>Peso jan-abr</th>
            <th>Var. reais</th>
            <th>Var. peso</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function pivotTable(metric) {
  const years = [2023, 2024, 2025, 2026];
  const rows = months.map((month) => {
    const cells = years.map((year) => {
      const record = salesRecord(year, month.id);
      return `<td>${record ? formatMetric(record[metric], metric, year) : "-"}</td>`;
    }).join("");
    return `<tr><td>${month.name}</td>${cells}</tr>`;
  }).join("");

  const footer = years.map((year) => `<td>${formatMetric(totalSales(year)[metric], metric, year)}</td>`).join("");

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            ${years.map((year) => `<th>${year}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td>Total</td>${footer}</tr>
        </tfoot>
      </table>
    </div>
  `;
}

function representativesBars() {
  const rows = filteredRepresentatives()
    .slice(0, 12)
    .map((rep) => {
      const value = state.repSort === "avg" ? rep.revenue / rep.weightKg : rep[state.repSort];
      return {
        label: rep.name,
        value,
        valueLabel: state.repSort === "weightKg" ? formatKg(value) : formatBRL(value, state.repSort === "avg" ? 2 : 0),
        color: state.repSort === "weightKg" ? "blue" : state.repSort === "avg" ? "amber" : ""
      };
    });

  return rows.length ? barList(rows) : `<div class="empty-state">Nenhum representante encontrado.</div>`;
}

function representativesTable() {
  const rows = filteredRepresentatives().map((rep, index) => {
    const avg = rep.revenue / rep.weightKg;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(rep.name)}</td>
        <td>${formatKg(rep.weightKg)}</td>
        <td>${formatBRL(rep.revenue, 0)}</td>
        <td>${formatBRL(avg)}</td>
      </tr>
    `;
  }).join("");

  if (!rows) {
    return `<div class="empty-state">Nenhum representante encontrado.</div>`;
  }

  return `
    <div class="data-table-wrap representatives-table goals-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Representante</th>
            <th>Peso</th>
            <th>Faturamento</th>
            <th>R$/kg</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function mayGoalTable(plan, targetKg) {
  const rows = plan.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${formatPercent(row.share)}</td>
      <td>${formatKg(row.aprilKg)}</td>
      <td>${formatTon(row.targetKg)}</td>
      <td>${formatKg(row.targetKg / 20)}</td>
      <td>${formatBRL(row.avgPrice)}</td>
      <td>${formatBRL(row.targetRevenue, 0)}</td>
    </tr>
  `).join("");

  const totalRevenue = plan.reduce((sum, row) => sum + row.targetRevenue, 0);

  return `
    <div class="data-table-wrap representatives-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Representante / Canal</th>
            <th>Part. abril</th>
            <th>Kg abril</th>
            <th>Meta maio</th>
            <th>Meta/dia</th>
            <th>R$/kg abril</th>
            <th>Faturamento simulado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>Meta maio</td>
            <td>100,0%</td>
            <td>${formatKg(plan.reduce((sum, row) => sum + row.aprilKg, 0))}</td>
            <td>${formatTon(targetKg)}</td>
            <td>${formatKg(targetKg / 20)}</td>
            <td>${formatBRL(totalRevenue / targetKg)}</td>
            <td>${formatBRL(totalRevenue, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function entryComposition(totals) {
  const kgRows = [
    { label: "Corte 1", value: totals.corte1Kg, valueLabel: formatKg(totals.corte1Kg), color: "blue" },
    { label: "Corte 2", value: totals.corte2Kg, valueLabel: formatKg(totals.corte2Kg) },
    { label: "Rebo", value: totals.reboKg, valueLabel: formatKg(totals.reboKg), color: "amber" }
  ];

  const valueRows = [
    { label: "Corte 1", value: totals.corte1Value, valueLabel: formatBRL(totals.corte1Value) },
    { label: "Corte 2", value: totals.corte2Value, valueLabel: formatBRL(totals.corte2Value), color: "blue" },
    { label: "Rebo", value: totals.reboValue, valueLabel: formatBRL(totals.reboValue), color: "amber" }
  ];

  return `
    <h3>Peso</h3>
    ${barList(kgRows)}
    <h3 style="margin-top:18px">Valor</h3>
    ${barList(valueRows)}
  `;
}

function entriesTable() {
  const rows = data.dailyEntriesApril2026.map((row) => `
    <tr>
      <td>${formatDay(row.date)}</td>
      <td>${formatKg(row.corte1Kg)}</td>
      <td>${formatKg(row.corte2Kg)}</td>
      <td>${formatKg(row.reboKg)}</td>
      <td>${formatKg(row.totalKg)}</td>
      <td>${formatBRL(row.corte1Value)}</td>
      <td>${formatBRL(row.corte2Value)}</td>
      <td>${formatBRL(row.reboValue)}</td>
      <td>${formatBRL(row.totalValue)}</td>
      <td>${formatBRL(row.avgPrice)}</td>
    </tr>
  `).join("");

  const totals = totalDailyEntries();

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Corte 1 kg</th>
            <th>Corte 2 kg</th>
            <th>Rebo kg</th>
            <th>Total kg</th>
            <th>Corte 1 R$</th>
            <th>Corte 2 R$</th>
            <th>Rebo R$</th>
            <th>Total R$</th>
            <th>R$/kg</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>${formatKg(totals.corte1Kg)}</td>
            <td>${formatKg(totals.corte2Kg)}</td>
            <td>${formatKg(totals.reboKg)}</td>
            <td>${formatKg(totals.totalKg)}</td>
            <td>${formatBRL(totals.corte1Value)}</td>
            <td>${formatBRL(totals.corte2Value)}</td>
            <td>${formatBRL(totals.reboValue)}</td>
            <td>${formatBRL(totals.totalValue)}</td>
            <td>${formatBRL(totals.totalValue / totals.totalKg)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function salesVsEntriesTable() {
  const rows = data.monthlyEntries2026.map((entry) => {
    const sale = salesRecord(2026, entry.month);
    const revenueDiff = sale.revenue - entry.merchandiseValue;
    const weightDiff = sale.weightKg - entry.weightKg;
    return `
      <tr>
        <td>${monthName(entry.month)}</td>
        <td>${formatBRL(sale.revenue)}</td>
        <td>${formatBRL(entry.merchandiseValue)}</td>
        <td>${comparisonMoney(revenueDiff)}</td>
        <td>${formatKg(sale.weightKg)}</td>
        <td>${formatKg(entry.weightKg, 2)}</td>
        <td>${comparisonKg(weightDiff)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Faturado</th>
            <th>Entradas</th>
            <th>Dif. R$</th>
            <th>Peso faturado</th>
            <th>Peso entrada</th>
            <th>Dif. kg</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function financeTable() {
  const years = [2023, 2024, 2025, 2026];
  const rows = months.map((month) => {
    const cells = years.map((year) => {
      const record = salesRecord(year, month.id);
      return `<td>${record ? formatBRL(record.revenue, year === 2026 ? 2 : 0) : "-"}</td>`;
    }).join("");
    return `<tr><td>${month.name}</td>${cells}</tr>`;
  }).join("");

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            ${years.map((year) => `<th>${year}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            ${years.map((year) => `<td>${formatBRL(totalSales(year).revenue, year === 2026 ? 2 : 0)}</td>`).join("")}
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function sourceCard(source) {
  return `
    <article class="source-card">
      <button type="button" data-open-source="${source.id}" aria-label="Abrir ${escapeHtml(source.title)}">
        <img src="${escapeHtml(source.file)}" alt="${escapeHtml(source.title)}">
      </button>
      <div class="source-body">
        <div class="source-meta">
          <span class="status-pill">${escapeHtml(source.type)}</span>
          <span class="status-pill blue">Revisada</span>
        </div>
        <h2>${escapeHtml(source.title)}</h2>
        <p>${escapeHtml(source.file)}</p>
        <ul>
          ${source.extracted.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </article>
  `;
}

function noteList(notes) {
  return `
    <div class="note-list">
      ${notes.map((note) => `
        <article class="note-card">
          <h3>${escapeHtml(note.title)}</h3>
          <p>${escapeHtml(note.detail)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function managementCard(title, reading, action) {
  return `
    <article class="management-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(reading)}</p>
      <strong>${escapeHtml(action)}</strong>
    </article>
  `;
}

function strategicDecisionTable(rows) {
  return `
    <div class="decision-list">
      ${rows.map((row) => `
        <article class="decision-row">
          <div>
            <span class="decision-indicator">${escapeHtml(row.indicator)}</span>
            <strong>${escapeHtml(row.target)}</strong>
          </div>
          <span class="status-pill ${statusTone(row.status)}">${escapeHtml(row.status)}</span>
          <dl class="decision-metrics">
            <div><dt>Gatilho</dt><dd>${escapeHtml(row.trigger)}</dd></div>
            <div><dt>Ação</dt><dd>${escapeHtml(row.action)}</dd></div>
          </dl>
        </article>
      `).join("")}
    </div>
  `;
}

function priorityItem(title, detail) {
  return `
    <article class="priority-item">
      <span></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    </article>
  `;
}

function statusTone(status) {
  const tones = {
    Forte: "",
    Melhorando: "",
    Alavanca: "blue",
    Acompanhar: "amber",
    Conciliar: "amber",
    Pressão: "red",
    Risco: "red"
  };
  return tones[status] || "";
}

function barList(rows) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  return `
    <div class="bar-list">
      ${rows.map((row) => {
        const width = Math.max(0, Math.min(100, Math.abs(row.value) / max * 100));
        const color = row.color || "";
        return `
          <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
            <span class="bar-track"><span class="bar-fill ${color}" style="width:${width}%"></span></span>
            <span class="bar-value">${row.valueLabel}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function goalProgress(currentRevenue) {
  const target = getRevenueTarget();
  const percent = currentRevenue / target;
  return `
    <div class="progress-shell">
      <div class="stat-strip">
        <div><span>Realizado</span><strong>${formatBRL(currentRevenue)}</strong></div>
        <div><span>Meta</span><strong>${formatBRL(target, 0)}</strong></div>
        <div><span>Progresso</span><strong>${formatPercent(percent)}</strong></div>
      </div>
      <div class="progress-track" aria-label="Progresso da meta">
        <div class="progress-fill" style="width:${Math.min(percent * 100, 100)}%"></div>
      </div>
    </div>
  `;
}

function filteredRepresentatives() {
  const query = normalize(state.repQuery);
  return sortedRepresentatives("revenue").filter((rep) => normalize(rep.name).includes(query));
}

function sortedRepresentatives(sortKey) {
  return [...data.representativesApril2026].sort((a, b) => {
    const aValue = sortKey === "avg" ? a.revenue / a.weightKg : a[sortKey];
    const bValue = sortKey === "avg" ? b.revenue / b.weightKg : b[sortKey];
    return bValue - aValue;
  });
}

function totalRepresentatives() {
  if (data.representativesApril2026Totals) {
    return {
      weightKg: data.representativesApril2026Totals.weightKg,
      revenue: data.representativesApril2026Totals.revenue
    };
  }

  return data.representativesApril2026.reduce((acc, row) => {
    acc.weightKg += row.weightKg;
    acc.revenue += row.revenue;
    return acc;
  }, { weightKg: 0, revenue: 0 });
}

function representativeConcentration() {
  const reps = sortedRepresentatives("revenue");
  const totals = totalRepresentatives();
  const top5Revenue = reps.slice(0, 5).reduce((sum, rep) => sum + rep.revenue, 0);

  return {
    top1: reps[0],
    top1Share: reps[0].revenue / totals.revenue,
    top5Share: top5Revenue / totals.revenue
  };
}

function directChannels() {
  const totals = totalRepresentatives();
  const channels = data.representativesApril2026.filter((rep) => rep.name.startsWith("VENDA"));
  const revenue = channels.reduce((sum, rep) => sum + rep.revenue, 0);
  const weightKg = channels.reduce((sum, rep) => sum + rep.weightKg, 0);

  return {
    revenue,
    weightKg,
    share: revenue / totals.revenue
  };
}

function mayGoalPlan(targetKg) {
  const totals = totalRepresentatives();

  return sortedRepresentatives("weightKg").map((rep) => {
    const share = rep.weightKg / totals.weightKg;
    const avgPrice = rep.revenue / rep.weightKg;
    const representativeTargetKg = targetKg * share;

    return {
      name: rep.name,
      share,
      aprilKg: rep.weightKg,
      targetKg: representativeTargetKg,
      avgPrice,
      targetRevenue: representativeTargetKg * avgPrice
    };
  });
}

function totalDailyEntries() {
  if (data.dailyEntriesApril2026Totals) {
    return { ...data.dailyEntriesApril2026Totals };
  }

  return data.dailyEntriesApril2026.reduce((acc, row) => {
    acc.corte1Kg += row.corte1Kg;
    acc.corte2Kg += row.corte2Kg;
    acc.reboKg += row.reboKg;
    acc.totalKg += row.totalKg;
    acc.corte1Value += row.corte1Value;
    acc.corte2Value += row.corte2Value;
    acc.reboValue += row.reboValue;
    acc.totalValue += row.totalValue;
    return acc;
  }, {
    corte1Kg: 0,
    corte2Kg: 0,
    reboKg: 0,
    totalKg: 0,
    corte1Value: 0,
    corte2Value: 0,
    reboValue: 0,
    totalValue: 0
  });
}

function totalSales(year, throughMonth = 12) {
  return data.monthlySales
    .filter((row) => row.year === year && row.month <= throughMonth)
    .reduce((acc, row) => {
      acc.weightKg += row.weightKg;
      acc.revenue += row.revenue;
      return acc;
    }, { weightKg: 0, revenue: 0 });
}

function salesRecord(year, month) {
  return data.monthlySales.find((row) => row.year === year && row.month === month);
}

function latestMonth(year) {
  return Math.max(...data.monthlySales.filter((row) => row.year === year).map((row) => row.month));
}

function getRevenueTarget() {
  const stored = Number(localStorage.getItem("spunflex.revenueTarget2026"));
  return Number.isFinite(stored) && stored > 0 ? stored : defaultRevenueTarget;
}

function showSource(sourceId) {
  const source = data.sources.find((item) => item.id === sourceId);
  if (!source) return;

  modalTitle.textContent = source.title;
  modalImage.src = source.file;
  modalImage.alt = source.title;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalImage.src = "";
}

function exportJson() {
  downloadFile("spunflex-dados.json", JSON.stringify(data, null, 2), "application/json");
  showToast("Exportação concluída", "Arquivo spunflex-dados.json gerado.", "success");
}

function exportFinanceCsv() {
  const years = [2023, 2024, 2025, 2026];
  const header = ["Mes", ...years].join(";");
  const rows = months.map((month) => {
    const cells = years.map((year) => {
      const record = salesRecord(year, month.id);
      return record ? decimalForCsv(record.revenue) : "";
    });
    return [month.name, ...cells].join(";");
  });

  downloadFile("spunflex-faturamento.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function comparisonCell(value) {
  const className = value >= 0 ? "comparison-positive" : "comparison-negative";
  return `<span class="${className}">${formatPercent(value)}</span>`;
}

function comparisonMoney(value) {
  const className = value >= 0 ? "comparison-positive" : "comparison-negative";
  return `<span class="${className}">${value >= 0 ? "+" : ""}${formatBRL(value)}</span>`;
}

function comparisonKg(value) {
  const className = value >= 0 ? "comparison-positive" : "comparison-negative";
  return `<span class="${className}">${value >= 0 ? "+" : ""}${formatKg(value, 2)}</span>`;
}

function change(current, previous) {
  return previous === 0 ? 0 : (current - previous) / previous;
}

function formatMetric(value, metric, year = 2026) {
  if (metric === "revenue") {
    return formatBRL(value, year === 2026 ? 2 : 0);
  }
  return formatKg(value);
}

function formatEntryMetric(value, metric) {
  if (metric === "totalKg") {
    return formatKg(value);
  }
  return formatBRL(value, metric === "avgPrice" ? 2 : 2);
}

function formatBRL(value, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

function formatKg(value, fractionDigits = 0) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)} kg`;
}

function formatTon(valueKg, fractionDigits = 1) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(valueKg / 1000)} t`;
}

function formatPercent(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function monthName(month, mode = "name") {
  const found = months.find((item) => item.id === month);
  return found ? found[mode] : "";
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function decimalForCsv(value) {
  return String(value).replace(".", ",");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
