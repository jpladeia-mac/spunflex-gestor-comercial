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
  accessLogs: "spunflex.accessLogs.v1",
  seedFlag: "spunflex.seed.team.v1",
  config: "spunflex.config.v1",
  backlog: "spunflex.backlog.v1",
  dailyOrders: "spunflex.dailyOrders.v1"
};

// ---- Configuração operacional (custo, capacidade, metas) persistida no navegador ----
function getConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || "null");
    return { ...data.defaultConfig, ...(stored || {}) };
  } catch {
    return { ...data.defaultConfig };
  }
}

function saveConfig(partial) {
  const merged = { ...getConfig(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(merged));
    return merged;
  } catch (e) {
    showToast("Erro ao salvar", "Não foi possível salvar a configuração.", "error");
    return merged;
  }
}

// ---- Carteira (pedidos em aberto) persistida no navegador ----
function getBacklog() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.backlog) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveBacklog(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.backlog, JSON.stringify(list));
    return true;
  } catch (e) {
    showToast("Erro ao salvar", "Não foi possível salvar a carteira.", "error");
    return false;
  }
}

// ---- Entrada diária de pedidos (Vendas) ----
function getDailyOrders() {
  const baseRows = Array.isArray(data.dailyOrders2026) ? data.dailyOrders2026 : [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyOrders) || "null");
    if (Array.isArray(stored)) {
      const merged = new Map();
      stored.forEach((row) => {
        if (row?.date) merged.set(row.date, row);
      });
      baseRows.forEach((row) => {
        if (row?.date) merged.set(row.date, row);
      });
      return [...merged.values()].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    }
  } catch {/* fall through */}
  return baseRows;
}

function saveDailyOrders(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.dailyOrders, JSON.stringify(list));
    return true;
  } catch (e) {
    showToast("Erro ao salvar", "Não foi possível salvar a entrada de pedidos.", "error");
    return false;
  }
}

// ---- Helpers de produtos e clientes ----
function customerGroup(name) {
  if (!name) return "—";
  // Lookup exato
  if (data.customerGroups?.[name]) return data.customerGroups[name];
  // Tenta detectar palavras-chave (caso o nome venha com pequenas variações)
  const upper = name.toUpperCase();
  for (const key of Object.keys(data.customerGroups || {})) {
    if (upper.includes(key)) return data.customerGroups[key];
  }
  return name;
}

function getInvoiceReferenceDate() {
  return data.mayInvoices2026?.period?.endDate || data.currentMayBilling2026?.endDate || data.baseDate || getBacklogReferenceDate();
}

function getActiveBacklogOrders() {
  return (data.carteiraOrders2026 || [])
    .filter((order) => order && order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada");
}

function getBacklogTotals(orders = getActiveBacklogOrders()) {
  return orders.reduce((acc, order) => {
    acc.orders += 1;
    acc.weightKg += Number(order.totalKg) || 0;
    acc.revenue += Number(order.totalValor) || 0;
    acc.lineCount += Array.isArray(order.linhas) ? order.linhas.length : 0;
    return acc;
  }, { orders: 0, weightKg: 0, revenue: 0, lineCount: 0 });
}

function countBusinessDaysInclusive(startIso, endIso) {
  if (!startIso || !endIso || startIso > endIso) return 0;
  const date = new Date(startIso + "T12:00:00");
  const end = new Date(endIso + "T12:00:00");
  let count = 0;
  while (date <= end) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count += 1;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

function remainingBusinessDaysInMonth(iso = getBacklogReferenceDate()) {
  return Math.max(1, countBusinessDaysInclusive(iso, monthEndIso(iso)));
}

function aggregateActiveBacklogByRepresentative(orders = getActiveBacklogOrders()) {
  const map = new Map();
  orders.forEach((order) => {
    const name = (order.representante || "Sem representante").trim() || "Sem representante";
    if (!map.has(name)) map.set(name, { name, weightKg: 0, revenue: 0, invoiceCount: 0 });
    const row = map.get(name);
    row.weightKg += Number(order.totalKg) || 0;
    row.revenue += Number(order.totalValor) || 0;
    row.invoiceCount += 1;
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

function aggregateActiveBacklogProducts(orders = getActiveBacklogOrders()) {
  const map = new Map();
  const colors = inventoryColorCatalog(window.finishedGoodsStock2026?.records || []);
  orders.forEach((order) => {
    (order.linhas || []).forEach((line) => {
      const description = line.produto || "Produto sem descrição";
      const sig = inventorySignatureFromText(description, colors);
      const key = normalizeInventoryText(description);
      if (!map.has(key)) {
        map.set(key, {
          description,
          line: sig.line || "—",
          width: sig.widthMm || "—",
          color: sig.color || "—",
          grammage: sig.grammage || "—",
          weightKg: 0,
          revenue: 0,
          orders: new Set(),
          representatives: new Set(),
          machines: new Set()
        });
      }
      const row = map.get(key);
      row.weightKg += Number(line.kg) || 0;
      row.revenue += Number(line.valor) || 0;
      row.orders.add(order.pedido);
      if (order.representante) row.representatives.add(order.representante);
      if (line.maquina) row.machines.add(machineForProductionFocus(line.maquina));
    });
  });
  return [...map.values()]
    .map((row) => ({
      ...row,
      orderCount: row.orders.size,
      representativeCount: row.representatives.size,
      machineList: [...row.machines]
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function customerAggregates() {
  // Consolida NFs emitidas e carteira ativa por grupo econômico.
  const may = data.mayInvoices2026;
  const map = new Map();

  const ensureAgg = (group) => {
    const key = group || "—";
    if (!map.has(key)) {
      map.set(key, {
        group: key,
        members: new Set(),
        weightKg: 0,
        revenue: 0,
        invoices: 0,
        days: new Set(),
        representatives: new Set(),
        states: new Set(),
        cities: new Set(),
        lastDate: null,
        backlogWeightKg: 0,
        backlogRevenue: 0,
        backlogOrders: 0,
        backlogLines: 0,
        nextDeliveryDate: null
      });
    }
    return map.get(key);
  };

  (may?.invoices || []).forEach((inv) => {
    const agg = ensureAgg(customerGroup(inv.client));
    agg.members.add(inv.client);
    agg.weightKg += Number(inv.weightKg) || 0;
    agg.revenue += Number(inv.revenue) || 0;
    agg.invoices += 1;
    if (inv.date) agg.days.add(inv.date);
    if (inv.representative) agg.representatives.add(inv.representative);
    if (inv.state) agg.states.add(inv.state);
    if (inv.city || inv.state) agg.cities.add(`${inv.city || "-"}/${inv.state || "-"}`);
    if (inv.date && (!agg.lastDate || inv.date > agg.lastDate)) agg.lastDate = inv.date;
  });

  getActiveBacklogOrders().forEach((order) => {
    const agg = ensureAgg(customerGroup(order.cliente));
    agg.members.add(order.cliente || agg.group);
    agg.backlogWeightKg += Number(order.totalKg) || 0;
    agg.backlogRevenue += Number(order.totalValor) || 0;
    agg.backlogOrders += 1;
    agg.backlogLines += Array.isArray(order.linhas) ? order.linhas.length : 0;
    if (order.representante) agg.representatives.add(order.representante);
    if (order.dataEntrega && (!agg.nextDeliveryDate || order.dataEntrega < agg.nextDeliveryDate)) {
      agg.nextDeliveryDate = order.dataEntrega;
    }
  });

  return [...map.values()].map((agg) => ({
    ...agg,
    members: [...agg.members],
    days: agg.days.size,
    representatives: [...agg.representatives],
    states: [...agg.states],
    cities: [...agg.cities],
    pricePerKg: agg.weightKg ? agg.revenue / agg.weightKg : 0,
    avgTicket: agg.invoices ? agg.revenue / agg.invoices : 0,
    backlogPricePerKg: agg.backlogWeightKg ? agg.backlogRevenue / agg.backlogWeightKg : 0,
    commercialRevenue: agg.revenue + agg.backlogRevenue,
    commercialWeightKg: agg.weightKg + agg.backlogWeightKg,
    commercialPricePerKg: (agg.weightKg + agg.backlogWeightKg)
      ? (agg.revenue + agg.backlogRevenue) / (agg.weightKg + agg.backlogWeightKg)
      : 0
  })).sort((a, b) => b.commercialRevenue - a.commercialRevenue);
}

function abcClassify(items, key = "revenue") {
  // Aplica curva ABC com base nos thresholds da config
  const total = items.reduce((sum, item) => sum + (item[key] || 0), 0);
  const thresholds = getConfig().abcThresholds;
  const sorted = [...items].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  let acc = 0;
  return sorted.map((item) => {
    acc += item[key] || 0;
    const cumShare = total ? acc / total : 0;
    let category = "C";
    if (cumShare <= thresholds.a) category = "A";
    else if (cumShare <= thresholds.b) category = "B";
    return { ...item, cumShare, abc: category, share: total ? (item[key] || 0) / total : 0 };
  });
}

function stateName(uf) {
  const names = { AC:"Acre", AL:"Alagoas", AP:"Amapá", AM:"Amazonas", BA:"Bahia", CE:"Ceará", DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás", MA:"Maranhão", MT:"Mato Grosso", MS:"Mato Grosso do Sul", MG:"Minas Gerais", PA:"Pará", PB:"Paraíba", PR:"Paraná", PE:"Pernambuco", PI:"Piauí", RJ:"Rio de Janeiro", RN:"Rio Grande do Norte", RS:"Rio Grande do Sul", RO:"Rondônia", RR:"Roraima", SC:"Santa Catarina", SP:"São Paulo", SE:"Sergipe", TO:"Tocantins" };
  return names[uf] || uf;
}

// Equipe inicial pré-cadastrada: senhas hash SHA-256. O admin pode editar
// nome, senha ou permissões a qualquer momento na aba Administração.
const SEED_USERS = [
  { id: "user-rodrigo", username: "rodrigo", displayName: "Rodrigo",
    passwordHash: "b21f65f19ec266a82965228ca3ea5b5765687dfda53e080e82ccf3fca988290f" },
  { id: "user-joao", username: "joao", displayName: "João",
    passwordHash: "b1ba9b6762c999b27caaa6b4bde250fc5a70b84cd20354f228eba9f7ff42abdb" },
  { id: "user-adriana", username: "adriana", displayName: "Adriana",
    passwordHash: "27fd801792369e616cdb4751eaf73bd33c99deddd42ede295403247f65f9d65e" }
];

const VIEW_DEFINITIONS = [
  { id: "overview", label: "Dashboard" },
  { id: "invoices", label: "Faturamento" },
  { id: "sales", label: "Vendas" },
  { id: "customers", label: "Clientes" },
  { id: "products", label: "Produtos" },
  { id: "prices", label: "Preços" },
  { id: "representatives", label: "Representantes" },
  { id: "operations", label: "Operação" },
  { id: "inventory", label: "Estoque" },
  { id: "backlog", label: "Carteira" },
  { id: "freights", label: "Fretes" },
  { id: "goals", label: "Metas" },
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

const FREIGHT_DEFAULT_FILTERS = Object.freeze({
  minKg: "1000",
  maxStops: "5",
  route: "all",
  readiness: "all"
});
const FREIGHT_ROUTE_FILTERS = new Set(["all", "sp", "nwPr"]);
const FREIGHT_READINESS_FILTERS = new Set(["all", "ready", "partial", "produce"]);
const FREIGHT_NUMERIC_FILTERS = new Set(["minKg", "maxStops"]);

const state = {
  view: "overview",
  year: 2026,
  metric: "revenue",
  repSort: "revenue",
  repQuery: "",
  entryMetric: "totalValue",
  lastCreatedAccess: null,
  editingUserId: null,
  invoiceFilters: { date: "", rep: "all", state: "all", machine: "all" },
  customerQuery: "",
  productQuery: "",
  inventoryFilters: {
    query: "",
    line: "all",
    width: "all",
    grammage: "all",
    color: "all",
    profile: "all",
    machine: "all",
    minKg: ""
  },
  freightFilters: { ...FREIGHT_DEFAULT_FILTERS }
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
const activationCodeInput = document.querySelector("#activation-code");
const activationCodeButton = document.querySelector("#activate-access-code");

const defaultRevenueTarget = 70_000_000;
let appBooted = false;
let loginControlsBooted = false;

// Reset único da meta financeira para o padrão de 2026 (R$ 70MM)
if (localStorage.getItem("spunflex.revenueTarget2026.reset.v2") !== "true") {
  localStorage.setItem("spunflex.revenueTarget2026", String(defaultRevenueTarget));
  localStorage.setItem("spunflex.revenueTarget2026.reset.v2", "true");
}

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
  updateCurrentUserBadge();
}

function init() {
  ensureUserStore();
  setupLoginControls();

  // Verificar autenticação
  if (!isUserLoggedIn()) {
    loginContainer.classList.remove("hidden");
    appShell.classList.add("hidden");

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
    updateCurrentUserBadge();
    updateSidebarMeta();
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
  document.querySelector("#logout-button").addEventListener("click", handleLogout);
  setupScrollToTop();
  setupTableSorting();
  updateFullscreenButton();
  startClock();
  updateGreeting();
  updateCurrentUserBadge();
  updateSidebarMeta();
  render();
}

// ============================================================
// SCROLL-TO-TOP — botão flutuante após 400px
// ============================================================
function setupScrollToTop() {
  const button = document.querySelector("#scroll-top");
  if (!button) return;
  const toggleVisibility = () => {
    button.classList.toggle("is-visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", toggleVisibility, { passive: true });
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  toggleVisibility();
}

// ============================================================
// TABLE SORTING — qualquer th com [data-sort-key] vira ordenável
// ============================================================
let tableSortState = {}; // tableId -> { key, dir }

function setupTableSorting() {
  document.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-sort-key]");
    if (!th) return;
    const table = th.closest("table");
    if (!table) return;
    const tableId = table.dataset.tableId || `table-${[...document.querySelectorAll("table")].indexOf(table)}`;
    table.dataset.tableId = tableId;
    const key = th.dataset.sortKey;
    const prev = tableSortState[tableId];
    const dir = prev?.key === key && prev.dir === "asc" ? "desc" : "asc";
    tableSortState[tableId] = { key, dir };
    sortTable(table, key, dir);
    // Atualiza indicadores visuais
    table.querySelectorAll("th[data-sort-key]").forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
    th.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");
  });
}

function sortTable(table, key, dir) {
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  const rows = [...tbody.querySelectorAll("tr")];
  const colIndex = [...table.querySelectorAll("th")].findIndex((th) => th.dataset.sortKey === key);
  if (colIndex < 0) return;
  const sortType = table.querySelector(`th[data-sort-key="${key}"]`)?.dataset.sortType || "text";
  rows.sort((a, b) => {
    const aCell = a.children[colIndex];
    const bCell = b.children[colIndex];
    let aVal, bVal;
    if (sortType === "number") {
      aVal = parseNumericFromCell(aCell);
      bVal = parseNumericFromCell(bCell);
      return dir === "asc" ? aVal - bVal : bVal - aVal;
    }
    aVal = aCell?.textContent.trim().toLowerCase() || "";
    bVal = bCell?.textContent.trim().toLowerCase() || "";
    return dir === "asc" ? aVal.localeCompare(bVal, "pt-BR") : bVal.localeCompare(aVal, "pt-BR");
  });
  rows.forEach((row) => tbody.appendChild(row));
}

function parseNumericFromCell(cell) {
  if (!cell) return 0;
  // Pega o primeiro número da célula; ignora R$, kg, %, etc.
  const text = cell.textContent.replace(/\./g, "").replace(",", ".");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

// ============================================================
// CONFIRM MODAL — confirmAction(message, onAccept, opts)
// ============================================================
let confirmCallback = null;

function confirmAction(title, message, onAccept, options = {}) {
  const modal = document.querySelector("#confirm-modal");
  const titleEl = document.querySelector("#confirm-title");
  const msgEl = document.querySelector("#confirm-message");
  const acceptBtn = document.querySelector("#confirm-accept");
  if (!modal || !acceptBtn) {
    if (window.confirm(message)) onAccept?.();
    return;
  }
  titleEl.textContent = title || "Confirmar ação";
  msgEl.textContent = message || "Tem certeza?";
  acceptBtn.textContent = options.acceptLabel || "Confirmar";
  acceptBtn.classList.toggle("danger-confirm", options.danger !== false);
  confirmCallback = onAccept;
  modal.classList.remove("hidden");
  setTimeout(() => acceptBtn.focus(), 50);
}

function closeConfirmModal(accepted) {
  document.querySelector("#confirm-modal")?.classList.add("hidden");
  if (accepted && confirmCallback) confirmCallback();
  confirmCallback = null;
}

function latestIsoDate(...dates) {
  return dates.filter(Boolean).sort().at(-1) || "2026-05-12";
}

function getBacklogReferenceDate() {
  return data.backlogSnapshotDate || data.baseDate || data.currentMayBilling2026?.endDate || "2026-05-12";
}

function formatIsoShort(iso) {
  return iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
}

function addIsoDays(iso, days) {
  const date = new Date(iso + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEndIso(iso) {
  const date = new Date(iso + "T12:00:00");
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).toISOString().slice(0, 10);
}

function minIsoDate(...dates) {
  return dates.filter(Boolean).sort()[0] || "";
}

function formatIsoRange(startIso, endIso) {
  if (!startIso || !endIso) return "";
  return startIso === endIso ? formatIsoShort(startIso) : `${formatIsoShort(startIso)}-${formatIsoShort(endIso)}`;
}

function buildBacklogDeliveryBuckets(today = getBacklogReferenceDate()) {
  const monthEnd = monthEndIso(today);
  const nearStart = addIsoDays(today, 1);
  const nearEnd = minIsoDate(addIsoDays(today, 4), monthEnd);
  const monthEndStart = addIsoDays(nearEnd, 1);
  const buckets = [
    { key: "late", label: "Atrasados", helper: "Entrega vencida", tone: "red", filter: (order) => order.dataEntrega < today },
    { key: "today", label: `Hoje · ${formatIsoShort(today)}`, helper: "Faturar e expedir", tone: "blue", filter: (order) => order.dataEntrega === today }
  ];

  if (nearStart <= nearEnd) {
    buckets.push({
      key: "near",
      label: formatIsoRange(nearStart, nearEnd),
      helper: "Próximos dias",
      tone: "",
      filter: (order) => order.dataEntrega > today && order.dataEntrega <= nearEnd
    });
  }

  if (monthEndStart <= monthEnd) {
    buckets.push({
      key: "monthEnd",
      label: formatIsoRange(monthEndStart, monthEnd),
      helper: "Fim do mês",
      tone: "amber",
      filter: (order) => order.dataEntrega >= monthEndStart && order.dataEntrega <= monthEnd
    });
  }

  buckets.push({
    key: "future",
    label: "Junho+",
    helper: "Depois do mês atual",
    tone: "amber",
    filter: (order) => order.dataEntrega > monthEnd
  });

  return buckets;
}

function machineForProductionFocus(machine) {
  const name = String(machine || "").trim();
  return name.toUpperCase() === "REBOBINADEIRA" ? "Corte 1" : name || "Sem máquina";
}

function displayMachineLabels(value) {
  return String(value ?? "")
    .replace(/\bCorte\s*1\b/gi, "MAQ1")
    .replace(/\bCorte\s*2\b/gi, "MAQ2");
}

function applyMachineDisplayLabels(root = app) {
  if (!root || typeof document === "undefined" || typeof NodeFilter === "undefined") return;

  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return /Corte\s*[12]/i.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = displayMachineLabels(node.nodeValue);
  });

  const attrs = ["title", "aria-label", "alt", "placeholder"];
  root.querySelectorAll?.("[title],[aria-label],[alt],[placeholder]").forEach((el) => {
    attrs.forEach((attr) => {
      const current = el.getAttribute(attr);
      if (/Corte\s*[12]/i.test(current || "")) el.setAttribute(attr, displayMachineLabels(current));
    });
  });
}

function updateSidebarMeta() {
  const dateEl = document.querySelector("#sidebar-update-date");
  const detailEl = document.querySelector("#sidebar-update-detail");
  if (!dateEl || !detailEl) return;

  const billing = data.currentMayBilling2026;
  const invoices = data.mayInvoices2026;
  const latestIso = latestIsoDate(data.baseDate, data.backlogSnapshotDate, billing?.endDate, invoices?.period?.endDate);
  const latestDate = new Date(latestIso + "T12:00:00");

  dateEl.textContent = latestDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const nfCount = invoices?.totals?.invoiceCount || 0;
  const backlogDate = data.backlogSnapshotDate ? formatIsoShort(data.backlogSnapshotDate) : "";
  const detail = [
    nfCount ? `${nfCount} NFs até ${formatIsoShort(invoices?.period?.endDate || billing?.endDate)}` : "Dados consolidados",
    backlogDate ? `carteira ${backlogDate}` : ""
  ].filter(Boolean).join(" · ");
  detailEl.textContent = detail;
}

function setupLoginControls() {
  if (loginControlsBooted) return;
  loginControlsBooted = true;
  loginForm.addEventListener("submit", handleLogin);
  activationCodeButton?.addEventListener("click", handleActivationCode);
  setupPasswordToggle();
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
  let users = getUsers();

  if (!users.length) {
    users = [defaultAdminUser()];
    saveUsers(users);
  } else if (!users.some((user) => user.role === "admin")) {
    users = [defaultAdminUser(), ...users];
    saveUsers(users);
  }

  // Seed inicial da equipe (idempotente): só executa uma vez por navegador.
  // Se admin deletar um usuário seed, ele NÃO volta na próxima abertura.
  const alreadySeeded = localStorage.getItem(STORAGE_KEYS.seedFlag) === "true";
  if (alreadySeeded) return;

  const usernamesExistentes = new Set(users.map((u) => normalizeUsername(u.username)));
  const novosUsuarios = SEED_USERS
    .filter((seed) => !usernamesExistentes.has(normalizeUsername(seed.username)))
    .map((seed) => ({
      id: seed.id,
      username: seed.username,
      displayName: seed.displayName,
      role: "user",
      active: true,
      passwordHash: seed.passwordHash,
      permissions: VIEW_DEFINITIONS.filter((v) => v.id !== "admin").map((v) => v.id),
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      accessCount: 0
    }));

  if (novosUsuarios.length) {
    saveUsers([...users, ...novosUsuarios]);
  }
  try {
    localStorage.setItem(STORAGE_KEYS.seedFlag, "true");
  } catch (e) {
    /* ignora — usuário ainda foi criado */
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
  try {
    const payload = JSON.stringify(users);
    localStorage.setItem(STORAGE_KEYS.users, payload);
    // Read-back verification: garante que persistiu mesmo (quota, modo privado, etc.)
    const readBack = localStorage.getItem(STORAGE_KEYS.users);
    if (readBack !== payload) {
      throw new Error("Falha de leitura após gravação");
    }
    return true;
  } catch (err) {
    console.error("[Spunflex] saveUsers falhou:", err);
    showToast("Erro ao salvar", "Navegador não permitiu gravar os dados (modo privado ou armazenamento cheio).", "error", 6000);
    return false;
  }
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
  localStorage.setItem(STORAGE_KEYS.accessLogs, JSON.stringify(logs.slice(0, 1000)));
}

function recordAccess(username, status, detail) {
  const logs = getAccessLogs();
  const context = getClientSecurityContext();
  logs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    username,
    status,
    detail,
    timestamp: new Date().toISOString(),
    device: context.userAgent,
    ...context
  });
  saveAccessLogs(logs);
}

function getClientSecurityContext() {
  const userAgent = navigator.userAgent || "Indisponivel";
  const platform = navigator.userAgentData?.platform || navigator.platform || "Indisponivel";
  return {
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOperatingSystem(userAgent, platform),
    platform,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    language: navigator.language || "Indisponivel",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Indisponivel",
    path: window.location.pathname || "/",
    referrer: document.referrer || "Acesso direto",
    online: navigator.onLine ? "online" : "offline",
    userAgent
  };
}

function detectDeviceType(userAgent) {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return "Tablet";
  if (/mobi|android|iphone|ipod|blackberry|phone/i.test(userAgent)) return "Celular";
  return "Computador";
}

function detectBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return "Google Chrome";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  return "Desconhecido";
}

function detectOperatingSystem(userAgent, platform) {
  if (/Windows/i.test(userAgent) || /Win/i.test(platform)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS/iPadOS";
  if (/Mac OS|MacIntel|MacPPC/i.test(userAgent) || /Mac/i.test(platform)) return "macOS";
  if (/Linux/i.test(userAgent) || /Linux/i.test(platform)) return "Linux";
  return "Desconhecido";
}

function deviceTypeFromLegacy(userAgent = "") {
  return detectDeviceType(userAgent);
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

function encodeActivationPayload(payload) {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeActivationPayload(code) {
  const json = decodeURIComponent(escape(atob(code.trim())));
  return JSON.parse(json);
}

function createActivationCode(user) {
  return encodeActivationPayload({
    app: "spunflex-gestor-comercial",
    version: 1,
    user
  });
}

function importUserFromActivationCode(code) {
  const payload = decodeActivationPayload(code);
  if (payload.app !== "spunflex-gestor-comercial" || payload.version !== 1 || !payload.user?.username) {
    throw new Error("invalid-code");
  }

  const imported = {
    ...payload.user,
    active: payload.user.active !== false,
    permissions: Array.isArray(payload.user.permissions) ? payload.user.permissions : [],
    importedAt: new Date().toISOString()
  };
  const users = getUsers();
  const exists = users.some((user) => normalizeUsername(user.username) === normalizeUsername(imported.username));
  const updated = exists
    ? users.map((user) => normalizeUsername(user.username) === normalizeUsername(imported.username) ? { ...user, ...imported } : user)
    : [...users, imported];
  saveUsers(updated);
  recordAccess(imported.username, "ativacao", "Usuario ativado por codigo");
  return imported;
}

function handleActivationCode() {
  const code = activationCodeInput?.value.trim();
  if (!code) {
    showToast("Código vazio", "Cole o codigo de ativacao gerado pelo administrador.", "warning");
    return;
  }

  try {
    const user = importUserFromActivationCode(code);
    activationCodeInput.value = "";
    document.querySelector("#login-user").value = user.username;
    document.querySelector("#login-password").focus();
    showToast("Acesso ativado", "Agora entre com o login e senha recebidos.", "success");
  } catch {
    showToast("Código inválido", "Confira se o codigo foi copiado completo.", "error");
  }
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text)
    .then(() => showToast("Copiado", "Informacao enviada para a area de transferencia.", "success", 1800))
    .catch(() => showToast("Copie manualmente", "Selecione o texto exibido e copie.", "warning"));
}

function createdAccessText() {
  if (!state.lastCreatedAccess) return "";
  return [
    `Login: ${state.lastCreatedAccess.username}`,
    `Senha: ${state.lastCreatedAccess.password}`,
    `Codigo de ativacao: ${state.lastCreatedAccess.activationCode}`
  ].join("\n");
}

async function createAdminUser() {
  if (!isAdmin()) {
    showToast("Acesso negado", "Apenas administradores podem criar usuários.", "error");
    return;
  }

  const displayName = document.querySelector("#admin-display-name")?.value.trim();
  const username = normalizeUsername(document.querySelector("#admin-username")?.value || "");
  const password = document.querySelector("#admin-password")?.value || "";
  const role = document.querySelector("#admin-role")?.value || "user";
  const permissions = [...document.querySelectorAll("[name='new-user-permission']:checked")].map((input) => input.value);

  if (!displayName) {
    showToast("Nome obrigatório", "Informe o nome do usuário.", "error");
    return;
  }
  if (!username) {
    showToast("Login obrigatório", "Informe o login (sem espaços).", "error");
    return;
  }
  if (password.length < 6) {
    showToast("Senha curta", "A senha precisa ter pelo menos 6 caracteres.", "error");
    return;
  }

  const users = getUsers();
  if (users.some((user) => normalizeUsername(user.username) === username)) {
    showToast("Login já existe", `O login "${username}" já está em uso. Escolha outro.`, "error");
    return;
  }

  if (role !== "admin" && !permissions.length) {
    showToast("Sem permissão", "Autorize pelo menos uma página para este usuário.", "error");
    return;
  }

  const finalPermissions = role === "admin" ? VIEW_DEFINITIONS.map((view) => view.id) : permissions;

  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    username,
    displayName,
    role,
    active: true,
    passwordHash: await hashPasswordForStorage(password),
    permissions: finalPermissions,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    accessCount: 0
  };

  const activationCode = createActivationCode(newUser);

  if (!saveUsers([...users, newUser])) {
    return;
  }

  state.lastCreatedAccess = {
    username,
    password,
    displayName,
    activationCode,
    permissions: finalPermissions
  };
  recordAccess(getCurrentUser().username, "admin", `Usuário criado: ${username} (${role}, ${finalPermissions.length} permissões)`);

  // Limpa o formulário pra evitar criação duplicada acidental
  ["#admin-display-name", "#admin-username", "#admin-password"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.value = "";
  });

  render();
  showToast(
    "Usuário criado",
    `${displayName} (${username}) salvo com ${finalPermissions.length} permissão${finalPermissions.length !== 1 ? "ões" : ""}. Veja o código no card abaixo.`,
    "success",
    5000
  );
}

function updateUserPermission(userId, page, allowed) {
  if (!isAdmin()) return;
  const users = getUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) {
    showToast("Usuário não encontrado", "Recarregue a página e tente novamente.", "error");
    render();
    return;
  }
  if (target.role === "admin") {
    showToast("Ação bloqueada", "Administradores têm acesso total por padrão.", "warning");
    render();
    return;
  }

  const updated = users.map((user) => {
    if (user.id !== userId) return user;
    const permissions = new Set(user.permissions || []);
    if (allowed) permissions.add(page);
    else permissions.delete(page);
    return { ...user, permissions: [...permissions] };
  });

  if (!saveUsers(updated)) {
    render();
    return;
  }

  const user = updated.find((item) => item.id === userId);
  recordAccess(getCurrentUser().username, "admin", `Permissão atualizada: ${user?.username || userId} (${page} → ${allowed ? "liberada" : "bloqueada"})`);
  const pageLabel = VIEW_DEFINITIONS.find((v) => v.id === page)?.label || page;
  showToast(
    "Permissão salva",
    `${user.displayName || user.username}: "${pageLabel}" ${allowed ? "liberada" : "bloqueada"}.`,
    "success",
    2400
  );
  render();
}

function updateUserActive(userId, active) {
  if (!isAdmin()) return;
  const currentUser = getCurrentUser();
  if (userId === currentUser?.id) {
    showToast("Ação bloqueada", "Você não pode desativar o próprio usuário.", "warning");
    render();
    return;
  }

  const users = getUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) {
    showToast("Usuário não encontrado", "Recarregue a página e tente novamente.", "error");
    render();
    return;
  }

  const updated = users.map((user) => user.id === userId ? { ...user, active } : user);

  if (!saveUsers(updated)) {
    render();
    return;
  }

  recordAccess(currentUser.username, "admin", `${active ? "Ativado" : "Desativado"}: ${target.username}`);
  showToast(
    "Status salvo",
    `${target.displayName || target.username} agora está ${active ? "ativo" : "inativo"}.`,
    "success",
    2400
  );
  render();
}

async function updateAdminUser() {
  if (!isAdmin()) return;

  const userId = state.editingUserId;
  const users = getUsers();
  const target = users.find((user) => user.id === userId);
  const currentUser = getCurrentUser();
  if (!target) {
    showToast("Usuario nao encontrado", "Recarregue a pagina e tente novamente.", "error");
    return;
  }

  const displayName = document.querySelector("#edit-display-name")?.value.trim();
  const username = normalizeUsername(document.querySelector("#edit-username")?.value || "");
  const role = document.querySelector("#edit-role")?.value || "user";
  const password = document.querySelector("#edit-password")?.value || "";
  const active = document.querySelector("#edit-active")?.checked ?? true;
  const permissions = [...document.querySelectorAll("[name='edit-user-permission']:checked")].map((input) => input.value);

  if (!displayName || !username) {
    showToast("Dados incompletos", "Informe nome e login.", "error");
    return;
  }

  if (password && password.length < 6) {
    showToast("Senha curta", "Use pelo menos 6 caracteres para a nova senha.", "error");
    return;
  }

  if (users.some((user) => user.id !== userId && normalizeUsername(user.username) === username)) {
    showToast("Login ja existe", "Escolha outro nome de usuario.", "error");
    return;
  }

  if (role !== "admin" && !permissions.length) {
    showToast("Sem permissao", "Autorize pelo menos uma pagina para este usuario.", "error");
    return;
  }

  if (target.id === currentUser?.id && (!active || role !== "admin")) {
    showToast("Acao bloqueada", "Voce nao pode retirar o proprio acesso admin.", "warning");
    return;
  }

  const updatedUser = {
    ...target,
    username,
    displayName,
    role,
    active,
    permissions: role === "admin" ? VIEW_DEFINITIONS.map((view) => view.id) : permissions,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.username || "admin"
  };

  if (password) {
    updatedUser.passwordHash = await hashPasswordForStorage(password);
    state.lastCreatedAccess = {
      username,
      password,
      displayName,
      activationCode: createActivationCode(updatedUser),
      mode: "updated",
      permissions: updatedUser.permissions
    };
  }

  if (!saveUsers(users.map((user) => user.id === userId ? updatedUser : user))) {
    return;
  }

  if (updatedUser.id === currentUser?.id) {
    setCurrentUser(sessionUserFrom(updatedUser));
  }

  recordAccess(currentUser?.username || "admin", "admin", `Usuário editado: ${username}${password ? " | senha redefinida" : ""} (${updatedUser.permissions.length} permissões)`);
  state.editingUserId = null;
  render();
  showToast(
    "Usuário atualizado",
    password
      ? `${updatedUser.displayName} salvo com nova senha e ${updatedUser.permissions.length} permissão(ões).`
      : `${updatedUser.displayName} salvo com ${updatedUser.permissions.length} permissão(ões).`,
    "success",
    4000
  );
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

function updateCurrentUserBadge() {
  const nameEl = document.querySelector("#current-user-name");
  const initialsEl = document.querySelector("#current-user-initials");
  if (!nameEl || !initialsEl) return;

  const user = getCurrentUser();
  const displayName = user?.displayName || user?.username || "Usuário";
  nameEl.textContent = displayName;
  initialsEl.textContent = initialsFromName(displayName);
}

function initialsFromName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

  const copyAccess = event.target.closest("[data-copy-created-access]");
  if (copyAccess) {
    const text = copyAccess.dataset.copyCreatedAccess === "code"
      ? state.lastCreatedAccess?.activationCode
      : createdAccessText();
    copyText(text);
    return;
  }

  const editUser = event.target.closest("[data-edit-user]");
  if (editUser) {
    state.editingUserId = editUser.dataset.editUser;
    render();
    return;
  }

  const cancelEditUser = event.target.closest("[data-cancel-edit-user]");
  if (cancelEditUser) {
    state.editingUserId = null;
    render();
    return;
  }

  const generateEditPassword = event.target.closest("#generate-edit-password");
  if (generateEditPassword) {
    const input = document.querySelector("#edit-password");
    if (input) {
      input.value = generatePasswordValue();
      input.focus();
      input.select();
    }
    return;
  }

  const saveEditUser = event.target.closest("#save-edit-user");
  if (saveEditUser) {
    updateAdminUser();
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
    const userId = deleteUser.dataset.deleteUser;
    const target = getUsers().find((u) => u.id === userId);
    confirmAction(
      "Excluir usuário?",
      target ? `Tem certeza que deseja excluir o usuário "${target.displayName || target.username}"? Esta ação não pode ser desfeita.` : "Tem certeza?",
      () => deleteAdminUser(userId),
      { acceptLabel: "Excluir", danger: true }
    );
    return;
  }

  // -------- Confirm modal --------
  if (event.target.closest("[data-close-confirm]")) {
    closeConfirmModal(false);
    return;
  }

  if (event.target.closest("#confirm-accept")) {
    closeConfirmModal(true);
    return;
  }

  // -------- Filtros NFs --------
  const clearInvoiceFilter = event.target.closest('[data-invoice-filter="clear"]');
  if (clearInvoiceFilter) {
    state.invoiceFilters = { date: "", rep: "all", state: "all", machine: "all" };
    render();
    return;
  }

  const clearInventoryFilters = event.target.closest("[data-inventory-clear]");
  if (clearInventoryFilters) {
    state.inventoryFilters = {
      query: "",
      line: "all",
      width: "all",
      grammage: "all",
      color: "all",
      profile: "all",
      machine: "all",
      minKg: ""
    };
    render();
    return;
  }

  const clearFreightFilters = event.target.closest("[data-freight-clear]");
  if (clearFreightFilters) {
    state.freightFilters = { ...FREIGHT_DEFAULT_FILTERS };
    render();
    return;
  }

  const exportFreight = event.target.closest("[data-export-freight]");
  if (exportFreight) {
    exportFreightPdf(exportFreight.dataset.exportFreight);
    return;
  }

  const exportGoalsPdf = event.target.closest("[data-export-goals-pdf]");
  if (exportGoalsPdf) {
    exportGoalsSalesPdf();
    return;
  }

  // -------- Salvar todas as configurações operacionais --------
  const saveAllConfigBtn = event.target.closest("#save-all-config");
  if (saveAllConfigBtn) {
    const costPerKg = Number(document.querySelector("#config-cost")?.value);
    const fixedCostMonthly = Number(document.querySelector("#config-fixed-cost")?.value);
    const monthlyTargetKg = Number(document.querySelector("#config-target-kg")?.value);
    const cap1 = Number(document.querySelector("#config-cap-corte1")?.value);
    const cap2 = Number(document.querySelector("#config-cap-corte2")?.value);
    const valid = [costPerKg, fixedCostMonthly, monthlyTargetKg, cap1, cap2].every((v) => Number.isFinite(v) && v >= 0);
    if (!valid) {
      showToast("Valores inválidos", "Verifique os campos — todos devem ser números positivos.", "error");
      return;
    }
    saveConfig({
      costPerKg,
      fixedCostMonthly,
      monthlyTargetKg,
      machineCapacityKg: { "Corte 1": cap1, "Corte 2": cap2, "Rebobinadeira": 0 }
    });
    showToast("Configurações salvas", "Todos os indicadores foram recalculados com os novos valores.", "success", 2800);
    render();
    return;
  }

  // -------- (Compatibilidade) Salvar individual de config --------
  const saveConfigBtn = event.target.closest("[data-save-config]");
  if (saveConfigBtn) {
    const field = saveConfigBtn.dataset.saveConfig;
    const config = getConfig();
    let value;
    let partial = {};
    if (field === "costPerKg") {
      value = Number(document.querySelector("#config-cost").value);
      if (!Number.isFinite(value) || value < 0) {
        showToast("Valor inválido", "Informe um número positivo.", "error");
        return;
      }
      partial = { costPerKg: value };
    } else if (field === "fixedCostMonthly") {
      value = Number(document.querySelector("#config-fixed-cost").value);
      if (!Number.isFinite(value) || value < 0) return;
      partial = { fixedCostMonthly: value };
    } else if (field === "monthlyTargetKg") {
      value = Number(document.querySelector("#config-target-kg").value);
      if (!Number.isFinite(value) || value <= 0) return;
      partial = { monthlyTargetKg: value };
    } else if (field.startsWith("capacity-")) {
      const machine = field.replace("capacity-", "");
      const inputId = machine === "Corte 1" ? "#config-cap-corte1" : machine === "Corte 2" ? "#config-cap-corte2" : "#config-cap-rebo";
      value = Number(document.querySelector(inputId).value);
      if (!Number.isFinite(value) || value < 0) return;
      partial = { machineCapacityKg: { ...config.machineCapacityKg, [machine]: value } };
    }
    saveConfig(partial);
    showToast("Configuração salva", `Atualização aplicada em todo o sistema.`, "success", 2400);
    render();
    return;
  }

  // -------- Vendas (entrada diária de pedidos) --------
  const addOrder = event.target.closest("#add-order");
  if (addOrder) {
    const date = document.querySelector("#order-date")?.value;
    const orderCount = document.querySelector("#order-count")?.value;
    const weightKg = Number(document.querySelector("#order-weight")?.value);
    const revenue = Number(document.querySelector("#order-revenue")?.value);
    const notes = document.querySelector("#order-notes")?.value.trim();

    if (!date || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(revenue) || revenue <= 0) {
      showToast("Dados incompletos", "Data, peso e valor são obrigatórios (positivos).", "error");
      return;
    }

    const list = [...getDailyOrders()].filter((o) => o.date !== date);
    list.push({
      date,
      weightKg,
      revenue,
      avgPrice: revenue / weightKg,
      orderCount: orderCount ? Number(orderCount) : null,
      notes: notes || ""
    });

    if (saveDailyOrders(list)) {
      showToast("Entrada registrada", `${new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}: ${formatBRL(revenue)} captados.`, "success", 2400);
      ["#order-count", "#order-weight", "#order-revenue", "#order-notes"].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = "";
      });
      render();
    }
    return;
  }

  const deleteOrder = event.target.closest("[data-delete-order]");
  if (deleteOrder) {
    const date = deleteOrder.dataset.deleteOrder;
    confirmAction(
      "Excluir entrada de pedidos?",
      `Tem certeza que deseja remover a entrada do dia ${new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}?`,
      () => {
        const list = getDailyOrders().filter((o) => o.date !== date);
        if (saveDailyOrders(list)) {
          showToast("Entrada removida", "Removida das vendas.", "warning", 1800);
          render();
        }
      },
      { acceptLabel: "Excluir", danger: true }
    );
    return;
  }

  // -------- Carteira (backlog) --------
  const exportLateBacklog = event.target.closest("[data-export-late-backlog]");
  if (exportLateBacklog) {
    exportLateBacklogPdf();
    return;
  }

  const addBacklog = event.target.closest("#add-backlog");
  if (addBacklog) {
    const client = document.querySelector("#backlog-client")?.value.trim();
    const rep = document.querySelector("#backlog-rep")?.value.trim();
    const weightKg = Number(document.querySelector("#backlog-weight")?.value);
    const revenue = Number(document.querySelector("#backlog-revenue")?.value);
    const date = document.querySelector("#backlog-date")?.value;
    const promised = document.querySelector("#backlog-promised")?.value;
    const notes = document.querySelector("#backlog-notes")?.value.trim();

    if (!client || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(revenue) || revenue <= 0) {
      showToast("Dados incompletos", "Informe cliente, peso e valor (positivos).", "error");
      return;
    }

    const newOrder = {
      id: `P${Date.now().toString().slice(-6)}`,
      client, representative: rep, weightKg, revenue,
      date: date || new Date().toISOString().slice(0, 10),
      promisedDate: promised || null,
      notes: notes || "",
      status: "aberto",
      createdAt: new Date().toISOString()
    };
    const list = [...getBacklog(), newOrder];
    if (saveBacklog(list)) {
      showToast("Pedido cadastrado", `${client}: ${formatBRL(revenue)} adicionado à carteira.`, "success", 2400);
      ["#backlog-client", "#backlog-rep", "#backlog-weight", "#backlog-revenue", "#backlog-promised", "#backlog-notes"].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = "";
      });
      render();
    }
    return;
  }

  const toggleBacklog = event.target.closest("[data-toggle-backlog]");
  if (toggleBacklog) {
    const id = toggleBacklog.dataset.toggleBacklog;
    const list = getBacklog().map((o) => o.id === id ? { ...o, status: o.status === "entregue" ? "aberto" : "entregue" } : o);
    if (saveBacklog(list)) {
      showToast("Status atualizado", "Pedido atualizado na carteira.", "success", 1800);
      render();
    }
    return;
  }

  const deleteBacklog = event.target.closest("[data-delete-backlog]");
  if (deleteBacklog) {
    const id = deleteBacklog.dataset.deleteBacklog;
    const target = getBacklog().find((o) => o.id === id);
    confirmAction(
      "Excluir pedido?",
      target ? `Tem certeza que deseja remover o pedido ${id} (${target.client}) da carteira?` : "Confirmar?",
      () => {
        const list = getBacklog().filter((o) => o.id !== id);
        if (saveBacklog(list)) {
          showToast("Pedido excluído", "Removido da carteira.", "warning", 1800);
          render();
        }
      },
      { acceptLabel: "Excluir", danger: true }
    );
    return;
  }
}

function handleInput(event) {
  if (event.target.matches("#rep-search")) {
    state.repQuery = event.target.value;
    renderRepresentativesList();
    return;
  }

  if (event.target.matches("#customer-search")) {
    state.customerQuery = event.target.value;
    debouncedRender();
    return;
  }

  if (event.target.matches("#product-search")) {
    state.productQuery = event.target.value;
    debouncedRender();
    return;
  }

  const inventoryFilter = event.target.closest("[data-inventory-filter]");
  if (inventoryFilter) {
    const key = inventoryFilter.dataset.inventoryFilter;
    state.inventoryFilters = {
      ...state.inventoryFilters,
      [key]: inventoryFilter.value
    };
    if (key === "query" || key === "minKg") debouncedRender();
    else render();
    return;
  }

  const freightFilter = event.target.closest("[data-freight-filter]");
  if (freightFilter) {
    const key = freightFilter.dataset.freightFilter;
    state.freightFilters = {
      ...state.freightFilters,
      [key]: freightFilter.value
    };
    if (FREIGHT_NUMERIC_FILTERS.has(key)) debouncedRender();
    else render();
    return;
  }

  // Filtros de NFs
  const invoiceFilter = event.target.closest("[data-invoice-filter]");
  if (invoiceFilter && (invoiceFilter.tagName === "SELECT" || invoiceFilter.matches('input[type="date"]'))) {
    const key = invoiceFilter.dataset.invoiceFilter;
    state.invoiceFilters = { ...state.invoiceFilters, [key]: invoiceFilter.value };
    render();
  }
}

// Debounce simples para não re-renderizar a cada tecla
let _debounceTimer = null;
function debouncedRender() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    const active = document.activeElement;
    const activeId = active?.id;
    const cursorPos = active?.selectionStart;
    render();
    // Restaura foco no input
    if (activeId) {
      const restored = document.querySelector(`#${activeId}`);
      if (restored) {
        restored.focus();
        if (cursorPos !== undefined && restored.setSelectionRange) {
          restored.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  }, 200);
}

function handleKeydown(event) {
  // Escape — fecha tudo
  if (event.key === "Escape") {
    const confirmModal = document.querySelector("#confirm-modal");
    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      closeConfirmModal(false);
      return;
    }
    closeMobileSidebar();
    return;
  }

  // Números 1-9 — pula para a aba (quando não digitando)
  if (/^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
      return;
    }
    const user = getCurrentUser();
    const allowed = VIEW_DEFINITIONS.filter((v) => hasPermission(v.id, user));
    const idx = Number(event.key) - 1;
    if (idx < allowed.length) {
      event.preventDefault();
      setView(allowed[idx].id);
    }
  }
}

function setView(view) {
  if (!hasPermission(view)) {
    showToast("Acesso restrito", "Seu usuario nao esta autorizado para esta pagina.", "warning");
    return;
  }
  const label = VIEW_DEFINITIONS.find((item) => item.id === view)?.label || view;
  recordAccess(getCurrentUser()?.username || "sem usuario", "pagina", `Acessou pagina: ${label}`);
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
      applyMachineDisplayLabels(app);
      return;
    }
    state.view = fallbackView;
  }

  const titles = {
    overview: "Dashboard Estratégico",
    invoices: "Faturamento (NFs emitidas)",
    sales: "Vendas (entrada de pedidos)",
    customers: "Clientes",
    products: "Produtos",
    prices: "Precificação",
    representatives: "Representantes",
    operations: "Operação",
    inventory: "Estoque de produtos acabados",
    backlog: "Carteira (a faturar)",
    freights: "Fretes",
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
    invoices: renderInvoices,
    sales: renderSales,
    customers: renderCustomers,
    products: renderProducts,
    prices: renderPrices,
    representatives: renderRepresentatives,
    operations: renderOperations,
    inventory: renderInventory,
    backlog: renderBacklog,
    freights: renderFreights,
    goals: renderGoals,
    finance: renderFinance,
    sources: renderSources,
    admin: renderAdmin
  };

  showLoadingBar(true);
  app.innerHTML = views[state.view] ? views[state.view]() : renderAccessDenied();
  applyMachineDisplayLabels(app);
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
  const mayBilling = data.currentMayBilling2026;
  const mayTargetKg = 450000;
  const aprilAvgPrice = aprilSales.revenue / aprilSales.weightKg;
  const mayTargetRevenue = mayTargetKg * aprilAvgPrice;
  const forecast = (ytd.revenue / throughMonth) * 12;
  const forecastGrowth = change(forecast, total2025.revenue);
  const ytdGrowth = change(ytd.revenue, prevYtd.revenue);
  const avgPrice2026 = ytd.revenue / ytd.weightKg;
  const concentration = representativeConcentration();
  const direct = directChannels();
  const reconciliation = {
    revenue: aprilSales.revenue - aprilEntries.merchandiseValue,
    weight: aprilSales.weightKg - aprilEntries.weightKg
  };

  const mayEndDate = new Date(mayBilling.endDate + "T12:00:00");
  const monthStart = new Date(mayBilling.startDate + "T12:00:00");
  const monthEnd = new Date(mayEndDate.getFullYear(), mayEndDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const daysElapsed = Math.max(1, Math.round((mayEndDate - monthStart) / 86400000) + 1);
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const monthProgressPct = daysElapsed / daysInMonth;
  const mayEndLabel = mayEndDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const linearProjectionRevenue = (mayBilling.revenue / daysElapsed) * daysInMonth;
  const linearProjectionKg = (mayBilling.weightKg / daysElapsed) * daysInMonth;
  const projectionVsApril = change(linearProjectionRevenue, aprilSales.revenue);

  const dashboardToday = getBacklogReferenceDate();
  const dashboardTodayLabel = formatIsoShort(dashboardToday);
  const carteiraAll = data.carteiraOrders2026 || [];
  const isActiveOrder = (order) => order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada";
  const carteiraAtivos = carteiraAll.filter(isActiveOrder);
  const deliveryBuckets = buildBacklogDeliveryBuckets(dashboardToday);
  const bucketByKey = Object.fromEntries(deliveryBuckets.map((bucket) => [bucket.key, bucket]));
  const bucketOrders = Object.fromEntries(deliveryBuckets.map((bucket) => [bucket.key, carteiraAtivos.filter(bucket.filter)]));
  const carteiraAtrasados = bucketOrders.late || [];
  const carteiraHoje = bucketOrders.today || [];
  const carteiraSem1 = bucketOrders.near || [];
  const carteiraSem2 = bucketOrders.monthEnd || [];
  const carteiraFim = bucketOrders.future || [];
  const sumCart = (orders) => orders.reduce((acc, order) => ({
    val: acc.val + (Number(order.totalValor) || 0),
    kg: acc.kg + (Number(order.totalKg) || 0)
  }), { val: 0, kg: 0 });
  const ctAtivo = sumCart(carteiraAtivos);
  const ctAtr = sumCart(carteiraAtrasados);
  const ctHoje = sumCart(carteiraHoje);
  const ctSem1 = sumCart(carteiraSem1);
  const ctSem2 = sumCart(carteiraSem2);
  const ctFim = sumCart(carteiraFim);

  const securedRevenue = mayBilling.revenue + ctAtivo.val;
  const securedKg = mayBilling.weightKg + ctAtivo.kg;
  const securedCoverage = securedRevenue / mayTargetRevenue;
  const gapAfterBacklog = Math.max(mayTargetRevenue - securedRevenue, 0);
  const billedCoverage = mayBilling.revenue / mayTargetRevenue;
  const backlogCoverage = ctAtivo.val / mayTargetRevenue;
  const riskRevenue = ctAtr.val;
  const urgentRevenue = ctAtr.val + ctHoje.val;
  const currentWeekRevenue = ctHoje.val + ctSem1.val;
  const mayAvgPrice = mayBilling.weightKg ? mayBilling.revenue / mayBilling.weightKg : 0;
  const priceVsApril = change(mayAvgPrice, aprilAvgPrice);
  const requiredDailyRevenue = gapAfterBacklog / Math.max(daysRemaining, 1);
  const requiredDailyKg = Math.max(mayTargetKg - securedKg, 0) / Math.max(daysRemaining, 1);
  const avgBacklogTicket = carteiraAtivos.length ? ctAtivo.val / carteiraAtivos.length : 0;
  const activeStates = new Set(carteiraAtivos.map((order) => order.estado).filter(Boolean));
  const monthStatus = gapAfterBacklog <= 0 ? "Meta coberta" : securedCoverage >= 0.75 ? "Fechamento próximo" : "Acelerar carteira";
  const monthStatusTone = gapAfterBacklog <= 0 ? "" : securedCoverage >= 0.75 ? "amber" : "red";

  const orderRows = getDailyOrders();
  const mayOrderRows = orderRows.filter((order) => order.date?.startsWith("2026-05"));
  const orderTotals = mayOrderRows.reduce((acc, order) => ({
    revenue: acc.revenue + (Number(order.revenue) || 0),
    weightKg: acc.weightKg + (Number(order.weightKg) || 0),
    days: acc.days + 1
  }), { revenue: 0, weightKg: 0, days: 0 });
  const orderAvgPrice = orderTotals.weightKg ? orderTotals.revenue / orderTotals.weightKg : 0;

  const monthRows = data.monthlySales
    .filter((row) => row.year === 2026)
    .map((row) => ({
      label: monthName(row.month, "short"),
      value: row.revenue,
      valueLabel: row.partial ? `${formatBRL(row.revenue)} (parcial)` : formatBRL(row.revenue),
      color: row.month === 4 ? "amber" : (row.partial ? "blue" : "")
    }));

  const pipelineRows = [
    { label: bucketByKey.late?.label || "Atrasados", helper: bucketByKey.late?.helper || "Entrega vencida", orders: carteiraAtrasados, total: ctAtr, tone: bucketByKey.late?.tone || "red" },
    { label: bucketByKey.today?.label || `Hoje · ${dashboardTodayLabel}`, helper: bucketByKey.today?.helper || "Faturar e expedir", orders: carteiraHoje, total: ctHoje, tone: bucketByKey.today?.tone || "blue" },
    { label: bucketByKey.near?.label || "Próximos dias", helper: bucketByKey.near?.helper || "Próximos dias", orders: carteiraSem1, total: ctSem1, tone: bucketByKey.near?.tone || "" },
    { label: bucketByKey.monthEnd?.label || "Fim do mês", helper: bucketByKey.monthEnd?.helper || "Fim do mês", orders: carteiraSem2, total: ctSem2, tone: bucketByKey.monthEnd?.tone || "" },
    { label: bucketByKey.future?.label || "Junho+", helper: bucketByKey.future?.helper || "Depois do mês atual", orders: carteiraFim, total: ctFim, tone: bucketByKey.future?.tone || "amber" }
  ];

  const pipelineTableRows = pipelineRows.map((bucket) => {
    const statusText = [...new Set(bucket.orders.map((order) => order.situacao).filter(Boolean))].slice(0, 3).join(", ") || "-";
    return `
      <tr class="${bucket.tone ? `commercial-row-${bucket.tone}` : ""}">
        <td style="text-align:left"><strong>${escapeHtml(bucket.label)}</strong><br><small>${escapeHtml(bucket.helper)}</small></td>
        <td>${bucket.orders.length}</td>
        <td>${formatKg(bucket.total.kg, 0)}</td>
        <td>${formatBRL(bucket.total.val)}</td>
        <td>${formatPercent(bucket.total.val / mayTargetRevenue)}</td>
        <td style="text-align:left">${escapeHtml(statusText)}</td>
      </tr>
    `;
  }).join("");

  const topOpportunityRows = [...carteiraAtivos]
    .sort((a, b) => (Number(b.totalValor) || 0) - (Number(a.totalValor) || 0))
    .slice(0, 6)
    .map((order) => {
      const delivery = order.dataEntrega
        ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : "-";
      const tone = order.dataEntrega < dashboardToday ? "red" : order.dataEntrega === dashboardToday ? "blue" : "amber";
      return `
        <tr>
          <td style="text-align:left"><strong>#${escapeHtml(order.pedido)}</strong><br><small>${escapeHtml(delivery)}</small></td>
          <td style="text-align:left">${escapeHtml(order.cliente || "-")}<br><small>${escapeHtml(`${order.cidade || "-"} / ${order.estado || "-"}`)}</small></td>
          <td style="text-align:left">${escapeHtml(order.representante || "-")}</td>
          <td>${formatKg(Number(order.totalKg) || 0, 0)}</td>
          <td>${formatBRL(Number(order.totalValor) || 0)}</td>
          <td><span class="status-pill ${tone}">${escapeHtml(order.situacao || "-")}</span></td>
        </tr>
      `;
    }).join("");

  const repMap = new Map();
  const ensureRep = (name) => {
    const key = name || "Sem representante";
    if (!repMap.has(key)) {
      repMap.set(key, { name: key, billedVal: 0, billedKg: 0, invoices: 0, backlogVal: 0, backlogKg: 0, orders: 0, lateVal: 0 });
    }
    return repMap.get(key);
  };

  (data.mayInvoices2026?.invoices || []).forEach((invoice) => {
    const rep = ensureRep(invoice.representative);
    rep.billedVal += invoice.revenue || 0;
    rep.billedKg += invoice.weightKg || 0;
    rep.invoices += 1;
  });

  carteiraAtivos.forEach((order) => {
    const rep = ensureRep(order.representante);
    rep.backlogVal += order.totalValor || 0;
    rep.backlogKg += order.totalKg || 0;
    rep.orders += 1;
    if (order.dataEntrega < dashboardToday) rep.lateVal += order.totalValor || 0;
  });

  const commercialReps = [...repMap.values()]
    .map((rep) => ({
      ...rep,
      totalVal: rep.billedVal + rep.backlogVal,
      totalKg: rep.billedKg + rep.backlogKg
    }))
    .filter((rep) => rep.totalVal > 0)
    .sort((a, b) => b.totalVal - a.totalVal);

  const topRep = commercialReps[0];
  const repPotentialRows = commercialReps.slice(0, 8).map((rep, index) => {
    const avg = rep.totalKg ? rep.totalVal / rep.totalKg : 0;
    const share = securedRevenue ? rep.totalVal / securedRevenue : 0;
    const tone = rep.lateVal ? "red" : rep.backlogVal > rep.billedVal ? "amber" : "blue";
    const status = rep.lateVal ? "Risco" : rep.backlogVal > rep.billedVal ? "Converter" : "Faturando";
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="text-align:left"><strong>${escapeHtml(rep.name)}</strong><br><small>${formatPercent(share)} do total protegido</small></td>
        <td>${formatBRL(rep.billedVal, 0)}<br><small>${rep.invoices} NF${rep.invoices !== 1 ? "s" : ""}</small></td>
        <td>${formatBRL(rep.backlogVal, 0)}<br><small>${rep.orders} pedido${rep.orders !== 1 ? "s" : ""}</small></td>
        <td>${formatBRL(rep.totalVal, 0)}<br><small>${formatKg(rep.totalKg, 0)}</small></td>
        <td>${formatBRL(avg)}/kg</td>
        <td><span class="status-pill ${tone}">${status}</span></td>
      </tr>
    `;
  }).join("");

  const repPotentialBars = commercialReps.slice(0, 8).map((rep) => ({
    label: rep.name,
    value: rep.totalVal,
    valueLabel: `${formatBRL(rep.totalVal, 0)} | ${formatKg(rep.totalKg, 0)}`,
    color: rep.lateVal ? "red" : rep.backlogVal > rep.billedVal ? "amber" : "blue"
  }));
  const channelMax = Math.max(...commercialReps.slice(0, 8).map((rep) => rep.totalVal), 1);
  const channelRows = commercialReps.slice(0, 8).map((rep) => {
    const width = Math.max(2, Math.min(100, (rep.totalVal / channelMax) * 100));
    const tone = rep.lateVal ? "red" : rep.backlogVal > rep.billedVal ? "amber" : "blue";
    return `
      <div class="commercial-channel-row">
        <div class="commercial-channel-head">
          <strong title="${escapeHtml(rep.name)}">${escapeHtml(rep.name)}</strong>
          <span>${formatBRL(rep.totalVal, 0)}</span>
        </div>
        <div class="commercial-channel-track" aria-hidden="true">
          <span class="${tone}" style="width:${width.toFixed(1)}%"></span>
        </div>
        <small>${formatKg(rep.totalKg, 0)} · ${rep.orders} pedido${rep.orders !== 1 ? "s" : ""} · ${rep.invoices} NF${rep.invoices !== 1 ? "s" : ""}</small>
      </div>
    `;
  }).join("");

  const dailyRowsCurrent = (data.mayInvoices2026?.daily || []).map((day) => {
    const dt = new Date(day.date + "T12:00:00");
    const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `
      <tr>
        <td style="text-align:left">${label}</td>
        <td>${day.invoiceCount}</td>
        <td>${formatKg(day.weightKg, 2)}</td>
        <td>${formatBRL(day.revenue)}</td>
        <td>${formatBRL(day.avgPrice)}/kg</td>
      </tr>
    `;
  }).join("");

  const strategicRows = [
    {
      indicator: "Fechamento de maio",
      status: gapAfterBacklog <= 0 ? "Forte" : "Acompanhar",
      target: `${formatPercent(securedCoverage)} da meta já coberto entre faturado e carteira`,
      trigger: `Gap pós-carteira: ${formatBRL(gapAfterBacklog)}`,
      action: gapAfterBacklog > 0 ? `Gerar ${formatBRL(requiredDailyRevenue, 0)}/dia adicional até o fim do mês.` : "Proteger prazo de entrega e preço médio para não perder cobertura."
    },
    {
      indicator: "Risco de carteira",
      status: carteiraAtrasados.length ? "Risco" : "Forte",
      target: `${carteiraAtrasados.length} pedido${carteiraAtrasados.length !== 1 ? "s" : ""} atrasado${carteiraAtrasados.length !== 1 ? "s" : ""}`,
      trigger: `${formatBRL(riskRevenue)} ainda sem faturamento`,
      action: carteiraAtrasados.length ? "Atacar motivo do atraso: produção, crédito, logística ou negociação." : "Manter follow-up diário da carteira de curto prazo."
    },
    {
      indicator: "Preço médio",
      status: priceVsApril >= 0 ? "Melhorando" : "Pressão",
      target: `${formatBRL(mayAvgPrice)}/kg em maio vs ${formatBRL(aprilAvgPrice)}/kg em abril`,
      trigger: `${formatPercent(priceVsApril)} de variação`,
      action: "Travar desconto fora da política e priorizar pedidos acima do preço médio."
    },
    {
      indicator: "Concentração comercial",
      status: concentration.top5Share > 0.6 ? "Risco" : "Acompanhar",
      target: `Top 5 em ${formatPercent(concentration.top5Share)} do faturamento`,
      trigger: `${concentration.top1.name} lidera com ${formatPercent(concentration.top1Share)}`,
      action: "Aumentar carteira de representantes intermediários e reduzir dependência de grandes contas."
    },
    {
      indicator: "Venda interna",
      status: "Alavanca",
      target: `${formatPercent(direct.share)} no ranking de abril`,
      trigger: "Canal direto com potencial de recompras e giro rápido",
      action: "Separar rotina de recompra, recuperação de inativos e clientes novos."
    }
  ];

  const macroStats = [
    { label: "Jan-abr 2026", value: formatBRL(ytd.revenue), note: `${formatPercent(ytdGrowth)} vs 2025`, tone: "" },
    { label: "Forecast 2026", value: formatBRL(forecast), note: `${formatPercent(forecastGrowth)} vs 2025`, tone: "blue" },
    { label: "Preço 2026", value: formatBRL(avgPrice2026), note: `Abril ${formatBRL(aprilAvgPrice)}/kg`, tone: "amber" },
    { label: "Top 5 reps", value: formatPercent(concentration.top5Share), note: "Concentração comercial", tone: "red" }
  ];

  const heroMetrics = [
    { label: "Faturado", value: formatBRL(mayBilling.revenue, 0), note: `${formatPercent(billedCoverage)} da meta`, tone: "blue" },
    { label: "Carteira", value: formatBRL(ctAtivo.val, 0), note: `${carteiraAtivos.length} pedidos ativos`, tone: "navy" },
    { label: "Gap", value: gapAfterBacklog > 0 ? formatBRL(gapAfterBacklog, 0) : "Coberto", note: `${formatBRL(requiredDailyRevenue, 0)}/dia`, tone: gapAfterBacklog > 0 ? "red" : "green" },
    { label: "Risco", value: formatBRL(urgentRevenue, 0), note: `${carteiraAtrasados.length + carteiraHoje.length} pedidos críticos`, tone: urgentRevenue ? "red" : "green" }
  ];

  return `
    <div class="section-grid commercial-dashboard">
      <article class="panel span-12 commercial-hero">
        <div class="commercial-hero-main">
          <div class="commercial-hero-copy">
            <span class="commercial-eyebrow">Diretoria comercial · fechamento de maio</span>
            <h2>Receita protegida: ${formatBRL(securedRevenue)}</h2>
            <p>Faturado até ${mayEndLabel} mais carteira ativa ref. ${dashboardTodayLabel}. A leitura principal é converter carteira em NF sem perder preço.</p>
            <div class="commercial-hero-metrics" aria-label="Resumo executivo comercial">
              ${heroMetrics.map((item) => `
                <div class="commercial-hero-metric ${item.tone}">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${item.value}</strong>
                  <small>${escapeHtml(item.note)}</small>
                </div>
              `).join("")}
            </div>
            <div class="commercial-hero-actions">
              <span class="status-pill ${monthStatusTone}">${monthStatus}</span>
              <button class="ghost-button" type="button" data-view-jump="backlog">Abrir carteira</button>
              <button class="ghost-button" type="button" data-view-jump="invoices">Ver faturamento</button>
            </div>
          </div>

          <div class="commercial-progress-box">
            <div class="commercial-progress-head">
              <span>Cobertura da meta</span>
              <strong>${formatPercent(securedCoverage)}</strong>
            </div>
            <div class="commercial-progress-track" aria-hidden="true">
              <span class="commercial-progress-fill billed" style="width:${Math.min(billedCoverage * 100, 100).toFixed(1)}%"></span>
              <span class="commercial-progress-fill backlog" style="left:${Math.min(billedCoverage * 100, 100).toFixed(1)}%;width:${Math.min(backlogCoverage * 100, Math.max(100 - billedCoverage * 100, 0)).toFixed(1)}%"></span>
            </div>
            <div class="commercial-progress-legend">
              <span><i class="legend-billed"></i>Faturado ${formatBRL(mayBilling.revenue, 0)}</span>
              <span><i class="legend-backlog"></i>Carteira ${formatBRL(ctAtivo.val, 0)}</span>
            </div>
            <dl class="commercial-gap-list">
              <div><dt>Meta maio</dt><dd>${formatBRL(mayTargetRevenue, 0)}</dd></div>
              <div><dt>Gap pós-carteira</dt><dd>${formatBRL(gapAfterBacklog, 0)}</dd></div>
              <div><dt>Ritmo adicional</dt><dd>${formatBRL(requiredDailyRevenue, 0)}/dia</dd></div>
            </dl>
          </div>
        </div>
      </article>

      <section class="commercial-kpi-grid span-12" aria-label="Indicadores comerciais de maio">
        <article class="commercial-kpi">
          <span>Faturamento emitido</span>
          <strong>${formatBRL(mayBilling.revenue, 0)}</strong>
          <small>${formatKg(mayBilling.weightKg, 2)} · ${formatPercent(monthProgressPct)} do mês transcorrido</small>
        </article>
        <article class="commercial-kpi blue">
          <span>Carteira ativa</span>
          <strong>${formatBRL(ctAtivo.val, 0)}</strong>
          <small>${formatKg(ctAtivo.kg, 0)} · ${carteiraAtivos.length} pedidos · ticket médio ${formatBRL(avgBacklogTicket, 0)}</small>
        </article>
        <article class="commercial-kpi ${gapAfterBacklog > 0 ? "red" : "green"}">
          <span>Gap de fechamento</span>
          <strong>${gapAfterBacklog > 0 ? formatBRL(gapAfterBacklog, 0) : "Coberto"}</strong>
          <small>${gapAfterBacklog > 0 ? `${formatKg(requiredDailyKg, 0)}/dia para cobrir volume` : "Carteira cobre a meta financeira"}</small>
        </article>
        <article class="commercial-kpi ${priceVsApril >= 0 ? "green" : "amber"}">
          <span>Preço médio maio</span>
          <strong>${formatBRL(mayAvgPrice)}/kg</strong>
          <small>${formatPercent(priceVsApril)} vs abril · captação ${orderAvgPrice ? `${formatBRL(orderAvgPrice)}/kg` : "sem base"}</small>
        </article>
        <article class="commercial-kpi ${riskRevenue ? "red" : "green"}">
          <span>Risco imediato</span>
          <strong>${formatBRL(urgentRevenue, 0)}</strong>
          <small>${carteiraAtrasados.length} atrasados · ${carteiraHoje.length} para hoje</small>
        </article>
        <article class="commercial-kpi amber">
          <span>Captação registrada</span>
          <strong>${formatBRL(orderTotals.revenue, 0)}</strong>
          <small>${orderTotals.days} dia${orderTotals.days !== 1 ? "s" : ""} · ${formatKg(orderTotals.weightKg, 2)} · ${activeStates.size} UF na carteira</small>
        </article>
      </section>

      <article class="panel span-12 commercial-actions-panel">
        <div class="panel-header">
          <div>
            <h2>Prioridades comerciais desta semana</h2>
            <p>Fila de ação para transformar carteira em faturamento e preservar preço.</p>
          </div>
          <span class="status-pill ${riskRevenue ? "red" : "blue"}">${riskRevenue ? "Risco aberto" : "Carteira limpa"}</span>
        </div>
        <div class="commercial-action-grid">
          ${priorityItem("Destravar atrasados", `${carteiraAtrasados.length} pedido${carteiraAtrasados.length !== 1 ? "s" : ""} somam ${formatBRL(ctAtr.val, 0)}. Definir dono e motivo de bloqueio ainda hoje.`)}
          ${priorityItem("Faturar curto prazo", `Hoje + semana corrente somam ${formatBRL(currentWeekRevenue, 0)} em ${carteiraHoje.length + carteiraSem1.length} pedidos. Confirmar produção, crédito e logística.`)}
          ${priorityItem("Proteger R$/kg", `Maio está ${formatPercent(priceVsApril)} vs abril. Priorizar pedidos acima de ${formatBRL(aprilAvgPrice)}/kg e aprovar exceções formalmente.`)}
          ${priorityItem("Acelerar saldo", gapAfterBacklog > 0 ? `Ainda faltam ${formatBRL(gapAfterBacklog, 0)} após carteira. Criar plano de ${formatBRL(requiredDailyRevenue, 0)}/dia até o fim do mês.` : "Meta financeira coberta pela carteira: foco em entrega, cobrança de prazo e evitar cancelamentos.")}
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Pipeline de faturamento por entrega</h2>
            <p>Carteira ativa agrupada por janela de entrega. É a agenda operacional do fechamento.</p>
          </div>
          <span class="status-pill blue">${formatBRL(ctAtivo.val, 0)} em carteira</span>
        </div>
        <div class="commercial-stage-grid" aria-label="Resumo do pipeline por janela de entrega">
          ${pipelineRows.map((bucket) => `
            <div class="commercial-stage-card ${bucket.tone}">
              <span>${escapeHtml(bucket.label)}</span>
              <strong>${formatBRL(bucket.total.val, 0)}</strong>
              <small>${bucket.orders.length} pedido${bucket.orders.length !== 1 ? "s" : ""} · ${formatKg(bucket.total.kg, 0)}</small>
            </div>
          `).join("")}
        </div>
        <div class="data-table-wrap commercial-table">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Janela</th>
                <th>Pedidos</th>
                <th>Peso</th>
                <th>Valor</th>
                <th>% meta</th>
                <th style="text-align:left">Status</th>
              </tr>
            </thead>
            <tbody>${pipelineTableRows}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total ativo</strong></td>
                <td>${carteiraAtivos.length}</td>
                <td>${formatKg(ctAtivo.kg, 0)}</td>
                <td>${formatBRL(ctAtivo.val)}</td>
                <td>${formatPercent(ctAtivo.val / mayTargetRevenue)}</td>
                <td style="text-align:left">Previsto + faturado: ${formatBRL(securedRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Top oportunidades da carteira</h2>
            <p>Maiores pedidos ativos para acompanhamento diário.</p>
          </div>
          <button class="ghost-button" type="button" data-view-jump="backlog">Detalhar</button>
        </div>
        <div class="data-table-wrap commercial-table compact">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Pedido</th>
                <th style="text-align:left">Cliente</th>
                <th style="text-align:left">Rep.</th>
                <th>Peso</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${topOpportunityRows}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-8">
        <div class="panel-header">
          <div>
            <h2>Representantes · faturado + carteira</h2>
            <p>Ranking por valor protegido no mês: NFs emitidas mais carteira ativa.</p>
          </div>
          <button class="ghost-button" type="button" data-view-jump="representatives">Ver representantes</button>
        </div>
        <div class="data-table-wrap commercial-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left">Representante</th>
                <th>Faturado</th>
                <th>Carteira</th>
                <th>Total</th>
                <th>R$/kg</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${repPotentialRows}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-4">
        <div class="panel-header">
          <div>
            <h2>Contribuição por canal</h2>
            <p>Onde está concentrado o fechamento de maio.</p>
          </div>
          <span class="status-pill ${topRep?.lateVal ? "red" : "blue"}">${topRep ? escapeHtml(topRep.name.split(" ").slice(0, 2).join(" ")) : "Sem base"}</span>
        </div>
        ${repPotentialBars.length ? `<div class="commercial-channel-list">${channelRows}</div>` : `<div class="empty-state">Sem dados de representantes.</div>`}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Faturamento diário</h2>
            <p>NFs emitidas no recorte de maio.</p>
          </div>
          <button class="ghost-button" type="button" data-view-jump="invoices">NFs</button>
        </div>
        <div class="data-table-wrap commercial-table compact">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Dia</th>
                <th>NFs</th>
                <th>Peso</th>
                <th>Valor</th>
                <th>R$/kg</th>
              </tr>
            </thead>
            <tbody>${dailyRowsCurrent}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Painel de controle comercial</h2>
            <p>Indicadores que pedem decisão de diretoria, não só acompanhamento.</p>
          </div>
        </div>
        ${strategicDecisionTable(strategicRows)}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Visão macro · 2026</h2>
            <p>Leitura anual para contextualizar o fechamento do mês.</p>
          </div>
          <span class="status-pill">Jan-abr fechado</span>
        </div>
        <div class="commercial-kpi-grid macro">
          ${macroStats.map((item) => `
            <article class="commercial-kpi ${item.tone}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${item.value}</strong>
              <small>${escapeHtml(item.note)}</small>
            </article>
          `).join("")}
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Ritmo comercial mensal</h2>
            <p>Faturamento por emissão; abril é a referência do ciclo atual.</p>
          </div>
          <span class="status-pill amber">Abril ${formatBRL(aprilSales.revenue, 0)}</span>
        </div>
        ${barList(monthRows)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Qualidade da base comercial</h2>
            <p>Riscos estruturais para o crescimento.</p>
          </div>
          <span class="status-pill blue">Diretoria</span>
        </div>
        <div class="stat-stack">
          <div><span>Venda interna</span><strong>${formatPercent(direct.share)}</strong><small>Participação no ranking de abril</small></div>
          <div><span>Conciliação abril</span><strong>${formatBRL(reconciliation.revenue, 0)}</strong><small>${formatKg(reconciliation.weight, 0)} entre emissão e entrada</small></div>
          <div><span>Top 5 representantes</span><strong>${formatPercent(concentration.top5Share)}</strong><small>${concentration.top1.name} lidera com ${formatPercent(concentration.top1Share)}</small></div>
        </div>
      </article>
    </div>
  `;
}

function renderInvoices() {
  const may = data.mayInvoices2026;
  if (!may || !may.invoices?.length) {
    return `
      <div class="section-grid">
        <article class="panel span-12">
          <div class="empty-state">Nenhuma nota fiscal carregada ainda. Importe um xlsx de NFs e os dados aparecem aqui.</div>
        </article>
      </div>
    `;
  }

  const defaultInvoiceFilters = { date: "", rep: "all", state: "all", machine: "all" };
  const filters = { ...defaultInvoiceFilters, ...(state.invoiceFilters || {}) };
  const allInvoices = may.invoices;
  const availableDates = [...new Set([
    ...(may.daily || []).map((day) => day.date),
    ...allInvoices.map((invoice) => invoice.date)
  ])].filter(Boolean).sort();
  const minInvoiceDate = may.period?.startDate || availableDates[0] || "";
  const maxInvoiceDate = may.period?.endDate || availableDates[availableDates.length - 1] || "";
  const filterFn = (inv) => {
    const invoiceMachines = Array.isArray(inv.machines) ? inv.machines : [];
    return (!filters.date || inv.date === filters.date) &&
      (filters.rep === "all" || inv.representative === filters.rep) &&
      (filters.state === "all" || inv.state === filters.state) &&
      (filters.machine === "all" || invoiceMachines.includes(filters.machine));
  };

  const filteredInvoices = allInvoices.filter(filterFn);
  const hasActiveInvoiceFilters = Boolean(filters.date) || filters.rep !== "all" || filters.state !== "all" || filters.machine !== "all";
  const reps = [...new Set(allInvoices.map((i) => i.representative))].sort();
  const states = [...new Set(allInvoices.map((i) => i.state))].sort();
  const machines = [...new Set(allInvoices.flatMap((i) => i.machines))].sort();
  const filteredTotals = filteredInvoices.reduce((acc, i) => {
    acc.revenue += Number(i.revenue) || 0;
    acc.weightKg += Number(i.weightKg) || 0;
    acc.invoiceCount += 1;
    return acc;
  }, { revenue: 0, weightKg: 0, invoiceCount: 0 });
  const filteredAvgPrice = filteredTotals.weightKg ? filteredTotals.revenue / filteredTotals.weightKg : 0;
  const totalsLabel = hasActiveInvoiceFilters ? "Total filtrado" : "Total";

  const invoicesByDate = new Map();
  filteredInvoices.forEach((inv) => {
    if (!invoicesByDate.has(inv.date)) invoicesByDate.set(inv.date, []);
    invoicesByDate.get(inv.date).push(inv);
  });

  const sourceDailyByDate = new Map((may.daily || []).map((day) => [day.date, day]));
  const filteredDaily = [...invoicesByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, invoices]) => {
      const revenue = invoices.reduce((sum, inv) => sum + (Number(inv.revenue) || 0), 0);
      const weightKg = invoices.reduce((sum, inv) => sum + (Number(inv.weightKg) || 0), 0);
      const sourceDay = sourceDailyByDate.get(date);
      const sourceNotes = new Set((sourceDay?.notes || []).map(String));
      const invoiceNumbers = invoices.map((inv) => String(inv.number));
      const fullSourceDay = sourceDay &&
        sourceNotes.size === invoiceNumbers.length &&
        invoiceNumbers.every((number) => sourceNotes.has(number));

      return {
        date,
        invoiceCount: invoices.length,
        lineCount: fullSourceDay ? sourceDay.lineCount : null,
        weightKg,
        revenue,
        avgPrice: weightKg ? revenue / weightKg : 0
      };
    });

  const hasKnownLineCount = filteredDaily.length > 0 && filteredDaily.every((day) => day.lineCount !== null);
  const filteredLineCount = hasKnownLineCount
    ? filteredDaily.reduce((sum, day) => sum + day.lineCount, 0)
    : null;

  // Agrupamento por cliente (grupo econômico) sobre o filtro atual
  const byClient = new Map();
  filteredInvoices.forEach((inv) => {
    const group = customerGroup(inv.client);
    if (!byClient.has(group)) byClient.set(group, { group, weightKg: 0, revenue: 0, invoices: 0 });
    const agg = byClient.get(group);
    agg.weightKg += inv.weightKg;
    agg.revenue += inv.revenue;
    agg.invoices += 1;
  });
  const clientGroupRows = [...byClient.values()].sort((a, b) => b.revenue - a.revenue);

  const dailyRows = filteredDaily.length ? filteredDaily.map((day) => {
    const dt = new Date(day.date + "T12:00:00");
    const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `
      <tr>
        <td>${label}</td>
        <td>${day.invoiceCount}</td>
        <td>${day.lineCount ?? "-"}</td>
        <td>${formatKg(day.weightKg, 2)}</td>
        <td>${formatBRL(day.revenue)}</td>
        <td>${formatBRL(day.avgPrice)}/kg</td>
      </tr>
    `;
  }).join("") : `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--muted)">Nenhum faturamento encontrado para o filtro selecionado.</td>
      </tr>
    `;

  const invoiceRows = filteredInvoices.length ? [...filteredInvoices]
    .sort((a, b) => (a.date === b.date ? Number(a.number) - Number(b.number) : a.date.localeCompare(b.date)))
    .map((inv) => {
      const dt = new Date(inv.date + "T12:00:00");
      const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const machinesStr = inv.machines?.length ? inv.machines.join(" + ") : "Sem máquina";
      const pricePerKg = inv.weightKg ? inv.revenue / inv.weightKg : 0;
      const priceTone = pricePerKg >= filteredAvgPrice
        ? "color:var(--success);font-weight:700"
        : "color:var(--amber);font-weight:700";
      const group = customerGroup(inv.client);
      const groupTag = group !== inv.client ? `<br><small style="color:var(--brand-cyan-deep);font-weight:700">${escapeHtml(group)}</small>` : "";
      return `
        <tr>
          <td><strong>${inv.number}</strong></td>
          <td>${label}</td>
          <td>${escapeHtml(inv.client)}${groupTag}<br><small style="color:var(--muted)">${escapeHtml(inv.city || "-")}/${escapeHtml(inv.state || "-")}</small></td>
          <td>${escapeHtml(inv.representative)}</td>
          <td>${escapeHtml(machinesStr)}</td>
          <td>${formatKg(inv.weightKg, 2)}</td>
          <td>${formatBRL(inv.revenue)}</td>
          <td style="${priceTone}">${formatBRL(pricePerKg)}/kg</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--muted)">Nenhuma NF no recorte selecionado.</td>
      </tr>
    `;

  const aggregateRepresentatives = (invoices) => {
    const map = new Map();
    invoices.forEach((inv) => {
      const name = inv.representative || "Sem representante";
      if (!map.has(name)) map.set(name, { name, weightKg: 0, revenue: 0, invoiceCount: 0 });
      const row = map.get(name);
      row.weightKg += Number(inv.weightKg) || 0;
      row.revenue += Number(inv.revenue) || 0;
      row.invoiceCount += 1;
    });
    return [...map.values()];
  };

  const aggregateMachines = (invoices) => {
    const map = new Map();
    invoices.forEach((inv) => {
      const invoiceMachines = inv.machines?.length ? inv.machines : ["Sem máquina"];
      const allocation = 1 / invoiceMachines.length;
      invoiceMachines.forEach((name) => {
        if (!map.has(name)) map.set(name, { name, weightKg: 0, revenue: 0 });
        const row = map.get(name);
        row.weightKg += (Number(inv.weightKg) || 0) * allocation;
        row.revenue += (Number(inv.revenue) || 0) * allocation;
      });
    });
    return [...map.values()];
  };

  const representativeSource = hasActiveInvoiceFilters
    ? aggregateRepresentatives(filteredInvoices)
    : [...may.representatives];
  const representativeTotals = representativeSource.reduce((acc, rep) => {
    acc.revenue += Number(rep.revenue) || 0;
    acc.weightKg += Number(rep.weightKg) || 0;
    acc.invoiceCount += Number(rep.invoiceCount) || 0;
    return acc;
  }, { revenue: 0, weightKg: 0, invoiceCount: 0 });
  const representativeAvgPrice = representativeTotals.weightKg ? representativeTotals.revenue / representativeTotals.weightKg : 0;
  const representativeTotalSummary = representativeSource.length ? `
    <div class="bar-total-row">
      <span>${totalsLabel} representantes</span>
      <strong>${formatBRL(representativeTotals.revenue)}</strong>
      <small>${formatKg(representativeTotals.weightKg, 2)} · ${representativeTotals.invoiceCount} NF${representativeTotals.invoiceCount !== 1 ? "s" : ""} · ${representativeAvgPrice ? `${formatBRL(representativeAvgPrice)}/kg` : "-"}</small>
    </div>
  ` : "";
  const repRows = representativeSource.length ? representativeSource
    .sort((a, b) => b.revenue - a.revenue)
    .map((rep) => {
      const share = filteredTotals.revenue ? rep.revenue / filteredTotals.revenue : 0;
      const w = Math.max(2, Math.round(share * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(rep.name)}<br><small style="color:var(--muted)">${rep.invoiceCount} NF${rep.invoiceCount > 1 ? "s" : ""}</small></div>
          <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
          <div class="bar-value">${formatBRL(rep.revenue)}<br><small style="color:var(--muted)">${formatKg(rep.weightKg, 2)}</small></div>
        </div>
      `;
    }).join("") : `<div class="empty-state">Nenhum representante no filtro.</div>`;

  const machineSource = hasActiveInvoiceFilters
    ? aggregateMachines(filteredInvoices)
    : [...may.machines];
  const machineTotals = machineSource.reduce((acc, mac) => {
    acc.revenue += Number(mac.revenue) || 0;
    acc.weightKg += Number(mac.weightKg) || 0;
    return acc;
  }, { revenue: 0, weightKg: 0 });
  const machineAvgPrice = machineTotals.weightKg ? machineTotals.revenue / machineTotals.weightKg : 0;
  const machineTotalSummary = machineSource.length ? `
    <div class="bar-total-row">
      <span>${totalsLabel} máquinas</span>
      <strong>${formatBRL(machineTotals.revenue)}</strong>
      <small>${formatKg(machineTotals.weightKg, 2)} · ${machineAvgPrice ? `${formatBRL(machineAvgPrice)}/kg` : "-"}${hasActiveInvoiceFilters ? " · recorte atual" : ""}</small>
    </div>
  ` : "";
  const machineRows = machineSource.length ? machineSource
    .sort((a, b) => b.revenue - a.revenue)
    .map((mac) => {
      const share = filteredTotals.revenue ? mac.revenue / filteredTotals.revenue : 0;
      const w = Math.max(2, Math.round(share * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(mac.name)}</div>
          <div class="bar-track"><div class="bar-fill blue" style="width:${w}%"></div></div>
          <div class="bar-value">${formatBRL(mac.revenue)}<br><small style="color:var(--muted)">${formatKg(mac.weightKg, 2)}</small></div>
        </div>
      `;
    }).join("") : `<div class="empty-state">Nenhuma máquina no filtro.</div>`;

  const startLabel = new Date(may.period.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const endLabel = new Date(may.period.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const dateLabel = filters.date
    ? new Date(filters.date + "T12:00:00").toLocaleDateString("pt-BR")
    : `${startLabel} a ${endLabel}`;
  const lineCountLabel = filteredLineCount === null ? "-" : filteredLineCount;
  const dateOptions = availableDates
    .map((date) => `<option value="${escapeHtml(date)}">${formatDay(date)}</option>`)
    .join("");
  const invoiceRefDate = getInvoiceReferenceDate();
  const backlogRefDate = getBacklogReferenceDate();
  const invoiceRefLabel = formatIsoShort(invoiceRefDate);
  const backlogRefLabel = formatIsoShort(backlogRefDate);
  const activeBacklog = getActiveBacklogOrders();
  const backlogTotals = getBacklogTotals(activeBacklog);
  const stockAnalysis = buildBacklogStockAnalysis(activeBacklog, backlogRefDate);
  const readyToBillRows = stockAnalysis.readyToBill.slice(0, 8).map((order) => `
    <tr>
      <td><strong>${escapeHtml(String(order.pedido))}</strong></td>
      <td style="text-align:left">${escapeHtml(order.client || "-")}<br><small style="color:var(--muted)">Entrega ${formatIsoShort(order.delivery)}${order.late ? " · atrasado" : ""}</small></td>
      <td>${formatKg(order.readyKg, 2)}</td>
      <td>${formatBRL(order.readyValue)}</td>
      <td><span class="status-pill ${order.late ? "red" : "blue"}">${order.late ? "Faturar atrasado" : "Pronto"}</span></td>
    </tr>
  `).join("");

  return `
    <div class="section-grid">
      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Atualização comercial · NF x carteira</h2>
            <p>NF/faturamento real está carregado até ${invoiceRefLabel}. A pasta 18.05 não trouxe nova planilha de NF; por isso o avanço de ${backlogRefLabel} entra como carteira ativa e estoque pronto para converter.</p>
          </div>
          <span class="status-pill blue">Carteira/estoque ${backlogRefLabel}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard(`Faturado NF até ${invoiceRefLabel}`, formatBRL(may.totals?.revenue || 0), `${formatKg(may.totals?.weightKg || 0, 2)} · ${may.totals?.invoiceCount || allInvoices.length} NFs`, "green")}
          ${kpiCard(`Carteira ativa ${backlogRefLabel}`, formatBRL(backlogTotals.revenue), `${formatKg(backlogTotals.weightKg, 2)} · ${backlogTotals.orders} pedidos`, "blue")}
          ${kpiCard("Pronto para faturar", formatBRL(stockAnalysis.totals.readyValue), `${formatKg(stockAnalysis.totals.readyKg, 2)} · ${stockAnalysis.totals.readyOrders} pedidos`, "amber")}
          ${kpiCard("A produzir", formatKg(stockAnalysis.totals.produceKg, 2), `${formatBRL(stockAnalysis.totals.produceValue)} em carteira`, stockAnalysis.totals.produceKg ? "red" : "green")}
        </div>
        ${readyToBillRows ? `
        <div class="data-table-wrap" style="margin-top:14px">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th style="text-align:left">Cliente / prazo</th>
                <th>Kg pronto</th>
                <th>Valor pronto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${readyToBillRows}</tbody>
          </table>
        </div>` : ""}
      </article>

      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Notas fiscais · ${dateLabel}</h2>
            <p>${filteredInvoices.length} NF${filteredInvoices.length !== 1 ? "s" : ""} no recorte, ${lineCountLabel} linhas de itens. Fonte: planilha de NF revisada até ${invoiceRefLabel}; use a carteira acima para acompanhar o que ainda falta faturar.</p>
          </div>
          <span class="status-pill blue">${formatBRL(filteredTotals.revenue)} · ${formatKg(filteredTotals.weightKg, 2)}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Faturamento", formatBRL(filteredTotals.revenue), `Preço médio ${formatBRL(filteredAvgPrice)}/kg`, "green")}
          ${kpiCard("Peso", formatKg(filteredTotals.weightKg, 2), `${lineCountLabel} linhas em ${filteredTotals.invoiceCount} NFs`, "blue")}
          ${kpiCard("NFs/dia (média)", filteredDaily.length ? `${(filteredTotals.invoiceCount / filteredDaily.length).toFixed(1)}` : "0,0", `${filteredDaily.length} dia${filteredDaily.length !== 1 ? "s" : ""} com emissão`, "amber")}
          ${kpiCard("Ticket médio por NF", filteredTotals.invoiceCount ? formatBRL(filteredTotals.revenue / filteredTotals.invoiceCount) : formatBRL(0), filteredTotals.invoiceCount ? `${formatKg(filteredTotals.weightKg / filteredTotals.invoiceCount, 2)}/NF` : "Sem NF no filtro", "red")}
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Filtros</h2>
            <p>Refine a lista por dia, representante, estado ou máquina. Os totais abaixo acompanham o recorte selecionado.</p>
          </div>
          ${hasActiveInvoiceFilters ? `<button class="ghost-button" type="button" data-invoice-filter="clear">Limpar filtros</button>` : ""}
        </div>
        <div class="control-row">
          <label class="filter-field">
            <span>Dia</span>
            <input type="date" data-invoice-filter="date" value="${escapeHtml(filters.date || "")}" ${minInvoiceDate ? `min="${escapeHtml(minInvoiceDate)}"` : ""} ${maxInvoiceDate ? `max="${escapeHtml(maxInvoiceDate)}"` : ""} list="invoice-date-options" aria-label="Filtrar faturamento por dia">
          </label>
          <datalist id="invoice-date-options">${dateOptions}</datalist>
          <select data-invoice-filter="rep">
            <option value="all" ${filters.rep === "all" ? "selected" : ""}>Todos os representantes</option>
            ${reps.map(r => `<option value="${escapeHtml(r)}" ${filters.rep === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}
          </select>
          <select data-invoice-filter="state">
            <option value="all" ${filters.state === "all" ? "selected" : ""}>Todos os estados</option>
            ${states.map(s => `<option value="${s}" ${filters.state === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <select data-invoice-filter="machine">
            <option value="all" ${filters.machine === "all" ? "selected" : ""}>Todas as máquinas</option>
            ${machines.map(m => `<option value="${escapeHtml(m)}" ${filters.machine === m ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
          </select>
          <span class="status-pill blue" style="margin-left:auto">${filteredInvoices.length}/${allInvoices.length} NFs · ${formatBRL(filteredTotals.revenue)} · ${formatKg(filteredTotals.weightKg, 2)}</span>
        </div>
      </article>

      ${clientGroupRows.length > 1 ? `
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Agrupamento por cliente / grupo econômico</h2>
            <p>Razões sociais do mesmo grupo são somadas (ex.: Passalacqua Franca/Londrina/SP/MG = 1 grupo).</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Grupo / Cliente</th>
                <th>NFs</th>
                <th>Peso</th>
                <th>Faturamento</th>
                <th>R$/kg</th>
                <th>Participação</th>
              </tr>
            </thead>
            <tbody>
              ${clientGroupRows.map(c => `
                <tr>
                  <td style="text-align:left"><strong>${escapeHtml(c.group)}</strong></td>
                  <td>${c.invoices}</td>
                  <td>${formatKg(c.weightKg, 2)}</td>
                  <td>${formatBRL(c.revenue)}</td>
                  <td>${c.weightKg ? formatBRL(c.revenue / c.weightKg) : "-"}/kg</td>
                  <td>${filteredTotals.revenue ? formatPercent(c.revenue / filteredTotals.revenue) : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>${totalsLabel}</strong></td>
                <td>${filteredTotals.invoiceCount}</td>
                <td>${formatKg(filteredTotals.weightKg, 2)}</td>
                <td>${formatBRL(filteredTotals.revenue)}</td>
                <td>${filteredTotals.weightKg ? formatBRL(filteredTotals.revenue / filteredTotals.weightKg) : "-"}/kg</td>
                <td>${filteredTotals.revenue ? "100,0%" : "-"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>` : ""}

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Lista completa de NFs</h2>
            <p>Cada nota com cliente, representante, máquina, peso e valor. Clique no cabeçalho para ordenar.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left" data-sort-key="nf">NF</th>
                <th style="text-align:left" data-sort-key="date">Data</th>
                <th style="text-align:left" data-sort-key="client">Cliente</th>
                <th style="text-align:left" data-sort-key="rep">Representante</th>
                <th style="text-align:left" data-sort-key="machine">Máquina</th>
                <th data-sort-key="weight" data-sort-type="number">Peso</th>
                <th data-sort-key="revenue" data-sort-type="number">Valor</th>
                <th data-sort-key="rkg" data-sort-type="number">R$/kg</th>
              </tr>
            </thead>
            <tbody>${invoiceRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="5"><strong>${totalsLabel} / Média</strong></td>
                <td>${formatKg(filteredTotals.weightKg, 2)}</td>
                <td>${formatBRL(filteredTotals.revenue)}</td>
                <td>${filteredTotals.weightKg ? formatBRL(filteredTotals.revenue / filteredTotals.weightKg) : "-"}/kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style="margin: 10px 2px 0; font-size: 0.82rem; color: var(--muted);">
          <span style="color:var(--success); font-weight:700">Verde</span> = R$/kg acima da média do recorte (${formatBRL(filteredAvgPrice)}/kg);
          <span style="color:var(--amber); font-weight:700">âmbar</span> = abaixo da média.
        </p>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Por representante</h2>
            <p>Participação no faturamento do recorte.</p>
          </div>
        </div>
        <div class="bar-list">${repRows}${representativeTotalSummary}</div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Por máquina</h2>
            <p>${hasActiveInvoiceFilters ? "Distribuição no recorte; NFs com mais de uma máquina são rateadas igualmente." : "Distribuição entre Corte 1, Corte 2 e Rebobinadeira."}</p>
          </div>
        </div>
        <div class="bar-list">${machineRows}${machineTotalSummary}</div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Resumo diário</h2>
            <p>Volume e ticket médio por dia.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Dia</th>
                <th>NFs</th>
                <th>Itens</th>
                <th>Peso</th>
                <th>Faturamento</th>
                <th>Preço médio</th>
              </tr>
            </thead>
            <tbody>${dailyRows}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>${totalsLabel}</strong></td>
                <td>${filteredTotals.invoiceCount}</td>
                <td>${lineCountLabel}</td>
                <td>${formatKg(filteredTotals.weightKg, 2)}</td>
                <td>${formatBRL(filteredTotals.revenue)}</td>
                <td>${filteredTotals.weightKg ? formatBRL(filteredTotals.revenue / filteredTotals.weightKg) : "-"}/kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </div>
  `;
}

function renderSales() {
  // VENDAS = entrada diária de pedidos
  const orders = [...getDailyOrders()].sort((a, b) => b.date.localeCompare(a.date));
  const totals = orders.reduce((acc, o) => {
    acc.revenue += Number(o.revenue) || 0;
    acc.weightKg += Number(o.weightKg) || 0;
    return acc;
  }, { revenue: 0, weightKg: 0 });
  const avgPrice = totals.weightKg ? totals.revenue / totals.weightKg : 0;
  const today = getBacklogReferenceDate();
  const todayLabel = formatIsoShort(today);
  const todayOrder = orders.find((o) => o.date === today);

  // Filtra por mês atual
  const currentMonth = today.slice(0, 7);
  const monthOrders = orders.filter((o) => o.date && o.date.startsWith(currentMonth));
  const monthTotals = monthOrders.reduce((acc, o) => {
    acc.revenue += Number(o.revenue) || 0;
    acc.weightKg += Number(o.weightKg) || 0;
    return acc;
  }, { revenue: 0, weightKg: 0 });

  // Bar list dos últimos 14 dias
  const recentOrders = orders.slice(0, 14).reverse();
  const maxRevenue = Math.max(...recentOrders.map((o) => Number(o.revenue) || 0), 1);
  const orderBars = recentOrders.map((o) => {
    const dt = new Date(o.date + "T12:00:00");
    const label = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return {
      label,
      value: Number(o.revenue) || 0,
      valueLabel: `${formatBRL(o.revenue)} · ${formatKg(o.weightKg, 2)}`,
      color: "blue"
    };
  });

  const tableRows = orders.map((o) => {
    const dt = new Date(o.date + "T12:00:00");
    const label = dt.toLocaleDateString("pt-BR");
    const isToday = o.date === today;
    return `
      <tr>
        <td>${label}${isToday ? ` <span class="status-pill" style="margin-left:6px;font-size:0.7rem">Hoje</span>` : ""}</td>
        <td>${o.orderCount ?? "-"}</td>
        <td>${formatKg(Number(o.weightKg) || 0, 2)}</td>
        <td>${formatBRL(Number(o.revenue) || 0)}</td>
        <td>${o.weightKg ? formatBRL(Number(o.revenue) / Number(o.weightKg)) : "-"}/kg</td>
        <td style="text-align:left">${escapeHtml(o.notes || "")}</td>
        <td>
          <button class="ghost-button danger-ghost table-action" type="button" data-delete-order="${escapeHtml(o.date)}">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="section-grid">
      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Vendas · entrada diária de pedidos</h2>
            <p>Pedidos captados por dia (não confundir com faturamento, que mostra NFs emitidas, nem com carteira, que mostra o saldo total a faturar). Base mais recente: ${todayLabel}.</p>
          </div>
          <span class="status-pill blue">Atualizado em ${todayLabel}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Pedidos no mês", formatBRL(monthTotals.revenue), `${formatKg(monthTotals.weightKg, 2)} em ${monthOrders.length} dia${monthOrders.length !== 1 ? "s" : ""}`, "green")}
          ${kpiCard(`Captação ${todayLabel}`, todayOrder ? formatBRL(todayOrder.revenue) : "Sem registro", todayOrder ? `${formatKg(todayOrder.weightKg, 2)} · ${todayOrder.orderCount || 0} pedidos` : "Nenhuma entrada para a data-base", "blue")}
          ${kpiCard("Ticket médio diário", formatBRL(orders.length ? totals.revenue / orders.length : 0), `Média de captação por dia`, "blue")}
          ${kpiCard("R$/kg médio captado", formatBRL(avgPrice), `Preço médio dos pedidos`, avgPrice >= (salesRecord(2026, 4)?.revenue / salesRecord(2026, 4)?.weightKg || 0) ? "green" : "amber")}
        </div>
      </article>

      ${orders.length ? `
      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Últimos dias com captação</h2>
            <p>Histórico recente (mais antigo → mais novo).</p>
          </div>
        </div>
        ${barList(orderBars)}
      </article>

      <article class="panel span-5 admin-form-panel">
        <div class="panel-header">
          <div>
            <h2>Registrar dia de pedidos</h2>
            <p>Adicione o total captado em um dia.</p>
          </div>
        </div>
        <div class="admin-form">
          <label>Data
            <input id="order-date" type="date" value="${today}">
          </label>
          <label>Quantidade de pedidos (opcional)
            <input id="order-count" type="number" min="0" step="1" placeholder="Ex.: 12">
          </label>
          <label>Peso total (kg)
            <input id="order-weight" type="number" min="0" step="0.01" placeholder="Ex.: 5000">
          </label>
          <label>Valor total (R$)
            <input id="order-revenue" type="number" min="0" step="0.01" placeholder="Ex.: 100000">
          </label>
          <label>Observações
            <input id="order-notes" type="text" placeholder="Ex.: cliente novo, urgência…">
          </label>
          <button class="primary-button" id="add-order" type="button">Adicionar entrada do dia</button>
        </div>
      </article>` : `
      <article class="panel span-12">
        <div class="empty-state-rich">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11H5a2 2 0 0 0-2 2v6h18v-6a2 2 0 0 0-2-2h-4"></path>
              <path d="M12 3v10"></path>
              <path d="m8 7 4-4 4 4"></path>
            </svg>
          </div>
          <h3>Nenhuma entrada de pedidos ainda</h3>
          <p>Use o formulário abaixo para registrar quanto foi captado em cada dia.</p>
        </div>
      </article>`}

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela de pedidos diários</h2>
            <p>Cada linha = total captado naquele dia. Clique no cabeçalho para ordenar.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left" data-sort-key="date">Data</th>
                <th data-sort-key="count" data-sort-type="number">Qtde pedidos</th>
                <th data-sort-key="weight" data-sort-type="number">Peso (kg)</th>
                <th data-sort-key="revenue" data-sort-type="number">Valor (R$)</th>
                <th data-sort-key="rkg" data-sort-type="number">R$/kg</th>
                <th style="text-align:left" data-sort-key="notes">Obs.</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total</strong></td>
                <td>-</td>
                <td>${formatKg(totals.weightKg, 2)}</td>
                <td>${formatBRL(totals.revenue)}</td>
                <td>${formatBRL(avgPrice)}/kg</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      ${(() => {
        const aprilEntries = data.monthlyEntries2026.find((row) => row.month === 4);
        const aprilEntryTotals = totalDailyEntries();
        const aprilEntryBars = data.dailyEntriesApril2026.map((row) => ({
          label: formatDay(row.date),
          value: row[state.entryMetric],
          valueLabel: formatEntryMetric(row[state.entryMetric], state.entryMetric),
          color: state.entryMetric === "totalKg" ? "blue" : state.entryMetric === "avgPrice" ? "amber" : ""
        }));
        return `
      <article class="panel span-12 current-tracker" style="margin-top:8px">
        <div class="panel-header">
          <div>
            <h2>Entradas de produção · abril 2026</h2>
            <p>Volume faturado por dia por máquina — base de comparação para o mês atual.</p>
          </div>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Entradas abr/2026", formatBRL(aprilEntries.merchandiseValue), `${formatKg(aprilEntries.weightKg, 2)} na visão mensal`, "green")}
          ${kpiCard("Média R$/dia", formatBRL(aprilEntries.merchandiseValue / data.dailyEntriesApril2026.length), "19 dias com entrada", "blue")}
          ${kpiCard("Média kg/dia", formatKg(aprilEntries.weightKg / data.dailyEntriesApril2026.length, 0), "Imagem informa 18.707 kg/dia", "amber")}
          ${kpiCard("Preço médio", formatBRL(aprilEntries.merchandiseValue / aprilEntries.weightKg), "Imagem informa R$ 18,88/kg", "red")}
        </div>
      </article>

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
        ${barList(aprilEntryBars)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Composição por tipo</h2>
            <p>Corte 1, Corte 2 e Rebo no fechamento diário.</p>
          </div>
        </div>
        ${entryComposition(aprilEntryTotals)}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela diária de entradas · abril 2026</h2>
            <p>Dados transcritos da imagem de entradas de abril.</p>
          </div>
        </div>
        ${entriesTable()}
      </article>
        `;
      })()}
    </div>
  `;
}

function seasonalityTable(metric) {
  const years = [2023, 2024, 2025, 2026];
  const rows = months.map((month) => {
    const cells = years.map((year) => {
      const record = salesRecord(year, month.id);
      const prev = year > 2023 ? salesRecord(year - 1, month.id) : null;
      if (!record) return `<td>-</td>`;
      const value = formatMetric(record[metric], metric, year);
      const yoy = prev ? change(record[metric], prev[metric]) : null;
      let badge = "";
      if (yoy !== null) {
        const cls = yoy >= 0 ? "comparison-positive" : "comparison-negative";
        badge = `<br><small class="${cls}">${yoy >= 0 ? "+" : ""}${formatPercent(yoy)}</small>`;
      }
      const partialTag = record.partial ? `<br><small style="color:var(--amber)">parcial</small>` : "";
      return `<td>${value}${badge}${partialTag}</td>`;
    }).join("");
    return `<tr><td><strong>${month.name}</strong></td>${cells}</tr>`;
  }).join("");

  return `
    <div class="data-table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Mês</th>
            ${years.map((y) => `<th>${y}<br><small style="color:var(--muted)">YoY</small></th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function priceVolumeDecomposition() {
  const t2025 = totalSales(2025, 4);
  const t2026 = totalSales(2026, 4);
  const price2025 = t2025.revenue / t2025.weightKg;
  const price2026 = t2026.revenue / t2026.weightKg;

  // Decomposição: efeito volume = (kg2026 - kg2025) * preço2025; efeito preço = (preço2026 - preço2025) * kg2026
  const volumeEffect = (t2026.weightKg - t2025.weightKg) * price2025;
  const priceEffect = (price2026 - price2025) * t2026.weightKg;
  const totalDelta = t2026.revenue - t2025.revenue;
  const volPct = totalDelta ? volumeEffect / totalDelta : 0;
  const priPct = totalDelta ? priceEffect / totalDelta : 0;

  return `
    <div class="section-grid" style="gap:14px">
      ${kpiCard("Receita jan-abr 2025", formatBRL(t2025.revenue, 0), `${formatKg(t2025.weightKg)} · R$ ${price2025.toFixed(2)}/kg`, "blue")}
      ${kpiCard("Receita jan-abr 2026", formatBRL(t2026.revenue), `${formatKg(t2026.weightKg)} · R$ ${price2026.toFixed(2)}/kg`, "green")}
      ${kpiCard("Efeito volume", formatBRL(volumeEffect, 0), `${formatPercent(volPct)} do crescimento`, volumeEffect >= 0 ? "green" : "red")}
      ${kpiCard("Efeito preço", formatBRL(priceEffect, 0), `${formatPercent(priPct)} do crescimento`, priceEffect >= 0 ? "green" : "red")}
    </div>
    <p style="margin: 14px 2px 0; font-size: 0.86rem; color: var(--muted);">
      <strong>Leitura:</strong> jan-abr/2026 está ${formatBRL(totalDelta)} acima de 2025.
      ${volumeEffect >= 0 ? `Volume ${formatPercent(volPct)} contribuiu` : `Volume PERDEU ${formatPercent(Math.abs(volPct))}`}
      e
      ${priceEffect >= 0 ? `preço ${formatPercent(priPct)}` : `preço CAIU ${formatPercent(Math.abs(priPct))}`}.
      ${priceEffect < 0 ? "<strong style='color:var(--red)'>Atenção: preço médio caiu</strong> — pressão de desconto ou mix com menor R$/kg." : "Preço se manteve ou subiu — bom sinal."}
    </p>
  `;
}

// =================== PREÇOS ===================
function renderPrices() {
  const items    = data.productMix2026?.items || [];
  const invoices = data.mayInvoices2026?.invoices || [];
  const aprilReps = data.representativesApril2026 || [];

  const totalKg  = items.reduce((s, p) => s + p.weightKg, 0);
  const totalVal = items.reduce((s, p) => s + p.revenue,  0);
  const avgPrice = totalKg ? totalVal / totalKg : 0;

  // --- Por estado (NFs) ---
  const stateMap = new Map();
  invoices.forEach(nf => {
    if (!nf.state || !nf.weightKg) return;
    if (!stateMap.has(nf.state)) stateMap.set(nf.state, { state: nf.state, kg: 0, val: 0, nfs: 0 });
    const a = stateMap.get(nf.state);
    a.kg += nf.weightKg; a.val += nf.revenue || 0; a.nfs++;
  });
  const stateRows = [...stateMap.values()]
    .map(s => ({ ...s, rkg: s.kg ? s.val / s.kg : 0 }))
    .sort((a, b) => b.rkg - a.rkg);

  // --- Por representante (NFs maio + abril) ---
  const repMap = new Map();
  invoices.forEach(nf => {
    if (!nf.representative || !nf.weightKg) return;
    if (!repMap.has(nf.representative)) repMap.set(nf.representative, { name: nf.representative, mayKg: 0, mayVal: 0 });
    const a = repMap.get(nf.representative);
    a.mayKg += nf.weightKg; a.mayVal += nf.revenue || 0;
  });
  aprilReps.forEach(ar => {
    if (!repMap.has(ar.name)) repMap.set(ar.name, { name: ar.name, mayKg: 0, mayVal: 0 });
    repMap.get(ar.name).aprilRkg = ar.revenue / ar.weightKg;
  });
  const repRows = [...repMap.values()]
    .filter(r => r.mayKg > 0)
    .map(r => ({ ...r, mayRkg: r.mayKg ? r.mayVal / r.mayKg : 0 }))
    .sort((a, b) => b.mayRkg - a.mayRkg);

  // --- Por largura ---
  const widthMap = new Map();
  items.forEach(p => {
    if (!widthMap.has(p.width)) widthMap.set(p.width, { width: p.width, kg: 0, val: 0, prices: [] });
    const a = widthMap.get(p.width);
    a.kg += p.weightKg; a.val += p.revenue; a.prices.push(p.pricePerKg);
  });
  const widthPriceRows = [...widthMap.values()]
    .map(w => ({ ...w, rkg: w.kg ? w.val / w.kg : 0, minP: Math.min(...w.prices), maxP: Math.max(...w.prices) }))
    .sort((a, b) => b.kg - a.kg);

  // --- Por cliente (NFs) ---
  const clientMap = new Map();
  invoices.forEach(nf => {
    if (!nf.client || !nf.weightKg) return;
    const key = nf.client;
    if (!clientMap.has(key)) clientMap.set(key, { client: key, state: nf.state || "—", kg: 0, val: 0, nfs: 0 });
    const a = clientMap.get(key);
    a.kg += nf.weightKg; a.val += nf.revenue || 0; a.nfs++;
  });
  const clientRows = [...clientMap.values()]
    .map(c => ({ ...c, rkg: c.kg ? c.val / c.kg : 0 }))
    .sort((a, b) => b.rkg - a.rkg);

  // --- Tabela de preços (política comercial) ---
  // Group por linha + largura, ordered by volume
  const policyMap = new Map();
  items.forEach(p => {
    const key = `${p.line}||${p.width}`;
    if (!policyMap.has(key)) policyMap.set(key, { line: p.line, width: p.width, kg: 0, val: 0, skus: [] });
    const a = policyMap.get(key);
    a.kg += p.weightKg; a.val += p.revenue;
    a.skus.push({ grammage: p.grammage, kg: p.weightKg, rkg: p.pricePerKg, desc: p.description });
  });
  const policyRows = [...policyMap.values()]
    .map(r => ({ ...r, avgRkg: r.kg ? r.val / r.kg : 0, skus: r.skus.sort((a, b) => a.grammage - b.grammage) }))
    .sort((a, b) => b.kg - a.kg);

  // --- Extremes ---
  const best  = [...items].sort((a, b) => b.pricePerKg - a.pricePerKg)[0];
  const worst = [...items].sort((a, b) => a.pricePerKg - b.pricePerKg)[0];
  const bestState  = stateRows[0];
  const worstState = stateRows[stateRows.length - 1];

  // --- Bars for R$/kg by state ---
  const maxStateRkg = Math.max(...stateRows.map(s => s.rkg), 1);
  const stateBars = stateRows.map(s => {
    const w = Math.max(2, Math.round((s.rkg / maxStateRkg) * 100));
    const diff = s.rkg - avgPrice;
    const cls = diff > 1.5 ? "" : diff > 0 ? "blue" : diff > -1.5 ? "amber" : "red";
    return `
      <div class="bar-row">
        <div class="bar-label"><strong>${escapeHtml(stateName(s.state))}</strong> (${s.state})<br><small style="color:var(--muted)">${s.nfs} NF${s.nfs > 1 ? "s" : ""} · ${formatKg(s.kg, 0)}</small></div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(s.rkg)}/kg<br><small style="${diff >= 0 ? "color:var(--green)" : "color:var(--red)"}">${diff >= 0 ? "+" : ""}${formatBRL(diff)}/kg</small></div>
      </div>`;
  }).join("");

  // --- Bars for R$/kg by rep ---
  const maxRepRkg = Math.max(...repRows.map(r => r.mayRkg), 1);
  const repBars = repRows.map(r => {
    const w = Math.max(2, Math.round((r.mayRkg / maxRepRkg) * 100));
    const diff = r.mayRkg - avgPrice;
    const cls = diff > 1 ? "" : diff > 0 ? "blue" : "amber";
    return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(r.name)}<br><small style="color:var(--muted)">${formatKg(r.mayKg, 0)} · ${formatBRL(r.mayVal, 0)}</small></div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(r.mayRkg)}/kg<br><small style="${diff >= 0 ? "color:var(--green)" : "color:var(--red)"}">${diff >= 0 ? "+" : ""}${formatBRL(diff)}/kg</small></div>
      </div>`;
  }).join("");

  // --- Policy table rows ---
  const policyTableRows = policyRows.map(row => {
    const skuRows = row.skus.map(s => `
      <tr class="subrow">
        <td></td>
        <td style="text-align:left;padding-left:24px;color:var(--muted);font-size:0.82rem">${escapeHtml(s.desc)}</td>
        <td>${s.grammage} g/m²</td>
        <td>${formatKg(s.kg, 0)}</td>
        <td>${formatPercent(s.kg / totalKg)}</td>
        <td><strong>${formatBRL(s.rkg)}/kg</strong></td>
        <td>${formatBRL(s.rkg * 0.93)}/kg</td>
        <td>${formatBRL(s.rkg * 1.05)}/kg</td>
      </tr>`).join("");
    return `
      <tr style="background:var(--surface-alt,var(--bg))">
        <td style="text-align:left"><strong>${escapeHtml(row.line)}</strong></td>
        <td style="text-align:left"><strong>${row.width} mm</strong></td>
        <td>—</td>
        <td>${formatKg(row.kg, 0)}</td>
        <td>${formatPercent(row.kg / totalKg)}</td>
        <td><strong style="color:var(--green)">${formatBRL(row.avgRkg)}/kg</strong></td>
        <td>${formatBRL(row.avgRkg * 0.93)}/kg</td>
        <td>${formatBRL(row.avgRkg * 1.05)}/kg</td>
      </tr>
      ${skuRows}`;
  }).join("");

  // --- Client table rows (top 15 by volume) ---
  const topClients = clientRows.slice(0, 15);
  const clientTableRows = topClients.map((c, i) => {
    const diff = c.rkg - avgPrice;
    return `<tr>
      <td>${i + 1}</td>
      <td style="text-align:left">${escapeHtml(c.client)}</td>
      <td>${escapeHtml(c.state)}</td>
      <td>${formatKg(c.kg, 0)}</td>
      <td>${c.nfs}</td>
      <td><strong>${formatBRL(c.rkg)}/kg</strong></td>
      <td><span class="status-pill ${diff >= 1.5 ? "" : diff >= 0 ? "blue" : diff >= -1.5 ? "amber" : "red"}">${diff >= 0 ? "+" : ""}${formatBRL(diff)}/kg</span></td>
    </tr>`;
  }).join("");

  return `
    <div class="section-grid">

      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Análise de precificação · maio 2026</h2>
            <p>Preço médio por produto, representante, região e cliente — base para política comercial.</p>
          </div>
          <span class="status-pill blue">R$/kg ${formatBRL(avgPrice).replace("R$", "").trim()}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Preço médio geral", formatBRL(avgPrice) + "/kg", `${formatKg(totalKg, 0)} · ${formatBRL(totalVal, 0)}`, "green")}
          ${kpiCard("Maior R$/kg por estado", `${bestState?.state || "—"} · ${formatBRL(bestState?.rkg || 0)}/kg`, `vs média ${formatBRL(avgPrice)}/kg`, "blue")}
          ${kpiCard("Produto mais valorizado", escapeHtml(best?.description?.split(" ").slice(0, 4).join(" ") || "—"), `${formatBRL(best?.pricePerKg || 0)}/kg`, "amber")}
          ${kpiCard("Spread preço (min–max)", `${formatBRL(worst?.pricePerKg || 0)} → ${formatBRL(best?.pricePerKg || 0)}/kg`, `Amplitude de ${formatBRL((best?.pricePerKg || 0) - (worst?.pricePerKg || 0))}/kg`, "red")}
        </div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>R$/kg por largura</h2>
            <p>Preço médio e spread por bitola produzida.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead><tr>
              <th style="text-align:left">Largura</th>
              <th>kg</th>
              <th>R$/kg médio</th>
              <th>Mínimo</th>
              <th>Máximo</th>
            </tr></thead>
            <tbody>
              ${widthPriceRows.map(w => `<tr>
                <td style="text-align:left"><strong>${w.width} mm</strong></td>
                <td>${formatKg(w.kg, 0)}</td>
                <td><strong style="color:${w.rkg >= avgPrice ? "var(--green)" : "var(--red)"}">${formatBRL(w.rkg)}/kg</strong></td>
                <td style="color:var(--red)">${formatBRL(w.minP)}/kg</td>
                <td style="color:var(--green)">${formatBRL(w.maxP)}/kg</td>
              </tr>`).join("")}
            </tbody>
            <tfoot><tr>
              <td style="text-align:left"><strong>Média geral</strong></td>
              <td>${formatKg(totalKg, 0)}</td>
              <td><strong>${formatBRL(avgPrice)}/kg</strong></td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>R$/kg por representante · maio</h2>
            <p>Quem está vendendo acima ou abaixo do preço médio. Diferença vs média geral.</p>
          </div>
        </div>
        <div class="bar-list">${repBars}</div>
      </article>

      <article class="panel span-6">
        <div class="panel-header">
          <div>
            <h2>R$/kg por estado/região</h2>
            <p>Preço médio realizado por estado nas NFs de maio. Diferença vs média geral (${formatBRL(avgPrice)}/kg).</p>
          </div>
        </div>
        <div class="bar-list">${stateBars}</div>
      </article>

      <article class="panel span-6">
        <div class="panel-header">
          <div>
            <h2>R$/kg por cliente · top 15</h2>
            <p>Clientes ordenados por preço médio pago — identifica quem paga mais e quem precisa revisão.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead><tr>
              <th>#</th>
              <th style="text-align:left">Cliente</th>
              <th>UF</th>
              <th>kg</th>
              <th>NFs</th>
              <th>R$/kg</th>
              <th>Δ média</th>
            </tr></thead>
            <tbody>${clientTableRows}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela de preços · guia para política comercial</h2>
            <p>Preço médio observado por produto. <strong>Piso sugerido</strong> = −7% do atual · <strong>Alvo</strong> = +5% do atual. Use como referência para aprovação de descontos e metas de preço.</p>
          </div>
          <span class="status-pill">${items.length} SKUs</span>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Linha</th>
                <th style="text-align:left">Largura / SKU</th>
                <th>Gramatura</th>
                <th>kg vendidos</th>
                <th>% mix</th>
                <th>R$/kg atual</th>
                <th>Piso (−7%)</th>
                <th>Alvo (+5%)</th>
              </tr>
            </thead>
            <tbody>${policyTableRows}</tbody>
          </table>
        </div>
        <p style="margin:12px 2px 0;font-size:0.82rem;color:var(--muted)">
          <strong>Piso sugerido:</strong> desconto máximo de 7% sobre o preço atual para manter margem. <strong>Alvo:</strong> preço de referência para clientes novos e negociações. Valores calculados automaticamente sobre o realizado de maio — revise conforme custo de matéria-prima.
        </p>
      </article>

    </div>
  `;
}

function renderRepresentatives() {
  const currentRows = representativeCurrentRows();
  const previousRows = representativePreviousRows();
  const currentTotals = representativesTotals(currentRows);
  const previousTotals = representativesTotals(previousRows);
  const top = sortRepresentativeRows(currentRows, "revenue")[0] || { name: "-", revenue: 0 };
  const share = currentTotals.revenue ? top.revenue / currentTotals.revenue : 0;
  const period = data.mayInvoices2026?.period || {};
  const periodStart = period.startDate ? new Date(period.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  const periodEnd = period.endDate ? new Date(period.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

  return `
    <div class="section-grid">
      ${kpiCard("Mês vigente atualizado", formatBRL(currentTotals.revenue, 0), `Maio ${periodStart}–${periodEnd} · ${formatKg(currentTotals.weightKg, 0)}`, "green")}
      ${kpiCard("Preço médio maio", currentTotals.weightKg ? formatBRL(currentTotals.revenue / currentTotals.weightKg) : "-", "Base de NFs emitidas no mês vigente", "blue")}
      ${kpiCard("Maior participação maio", formatPercent(share), `${top.name} por faturamento`, "amber")}
      ${kpiCard("Mês anterior executado", formatBRL(previousTotals.revenue, 0), `Abril fechado · ${formatKg(previousTotals.weightKg, 0)}`, "red")}

      <article class="panel span-12 representatives-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Representantes · maio atualizado</h2>
            <p>Mês vigente atualizado com as NFs emitidas no período. Abaixo fica abril fechado como mês anterior executado.</p>
          </div>
          <div class="chip-group">${repSortButtons()}</div>
        </div>
        <input class="search-input" id="rep-search" type="search" placeholder="Buscar representante" value="${escapeHtml(state.repQuery)}">
        <div id="rep-list">
          ${representativesPeriodTables()}
        </div>
      </article>
    </div>
  `;
}

function renderGoals() {
  const targetKg    = 450000;
  const businessDays = 20;
  const aprilSales  = salesRecord(2026, 4);
  const mayActual   = data.currentMayBilling2026;
  const repTotals   = totalRepresentatives();
  const plan        = mayGoalPlan(targetKg);

  const fmtShort = formatIsoShort;
  const mayStart = fmtShort(mayActual.startDate);
  const mayEnd   = fmtShort(mayActual.endDate);
  const carteiraRef = getBacklogReferenceDate();
  const carteiraRefLabel = fmtShort(carteiraRef);

  // --- Carteira pipeline ---
  const TODAY         = carteiraRef;
  const carteiraAll   = data.carteiraOrders2026 || [];
  const carteiraAtivos = carteiraAll.filter(o => o.situacao !== "Cancelado" && o.situacao !== "Nota Gerada");
  const carteiraMaio  = carteiraAtivos.filter(o => o.dataEntrega && o.dataEntrega.startsWith("2026-05"));
  const carteiraAtr   = carteiraAtivos.filter(o => o.dataEntrega && o.dataEntrega < TODAY);
  const sumKg  = arr => arr.reduce((s, o) => s + (o.totalKg   || 0), 0);
  const sumVal = arr => arr.reduce((s, o) => s + (o.totalValor || 0), 0);

  // pipeline = todos ativos com entrega em maio (inclui atrasados que já eram maio)
  const pipelineOrders = carteiraAtivos.filter(o => o.dataEntrega && (o.dataEntrega.startsWith("2026-05") || o.dataEntrega < TODAY));
  const pipelineKg  = sumKg(pipelineOrders);
  const pipelineVal = sumVal(pipelineOrders);

  const faturadoKg  = mayActual.weightKg;
  const faturadoVal = mayActual.revenue;
  const totalCobertoKg = faturadoKg + pipelineKg;
  const saldoKg = Math.max(0, targetKg - totalCobertoKg);

  // Progress bar
  const pctFat  = Math.min(100, (faturadoKg / targetKg) * 100);
  const pctPipe = Math.min(100 - pctFat, (pipelineKg / targetKg) * 100);
  const pctGap  = Math.max(0, 100 - pctFat - pctPipe);

  // Ritmo
  const diasFaturados = (mayActual.breakdown || []).length || 7;
  const diasRestantes = 14;
  const ritmoAtualKg  = faturadoKg / diasFaturados;
  const ritmoNecKg    = saldoKg > 0 ? saldoKg / diasRestantes : 0;
  const projecaoFinalKg = faturadoKg + ritmoAtualKg * diasRestantes;

  // Entrada diária de pedidos acumulada em maio
  const today = new Date().toISOString().slice(0, 10);
  const mayOrders = getDailyOrders().filter(o => o.date && o.date.startsWith("2026-05"));
  const mayOrdersKg  = mayOrders.reduce((s, o) => s + (Number(o.weightKg) || 0), 0);
  const mayOrdersVal = mayOrders.reduce((s, o) => s + (Number(o.revenue)  || 0), 0);

  // Daily billing bars
  const metaDiaria = targetKg / businessDays;
  const dailyBars = (mayActual.breakdown || []).map(d => ({
    label: d.range,
    value: d.weightKg,
    valueLabel: `${formatKg(d.weightKg, 0)} · ${formatBRL(d.revenue)}`,
    color: d.weightKg >= metaDiaria ? "green" : "amber"
  }));

  // Carteira por semana
  const weekGroups = [
    ...buildBacklogDeliveryBuckets(TODAY).map((bucket) => ({
      label: bucket.key === "today" ? "Hoje " + carteiraRefLabel : bucket.label,
      filter: bucket.filter
    })),
  ];
  const weekRows = weekGroups.map(w => {
    const orders = carteiraAtivos.filter(w.filter);
    return { label: w.label, count: orders.length, kg: sumKg(orders), val: sumVal(orders) };
  }).filter(r => r.count > 0);

  // Foco por máquina: carteira aberta x estoque x capacidade produtiva.
  const config = getConfig();
  const machineCapacityKg = config.machineCapacityKg || {};
  const productionMachines = Object.keys(machineCapacityKg).filter((machine) => (Number(machineCapacityKg[machine]) || 0) > 0);
  const goalStockAnalysis = buildBacklogStockAnalysis(pipelineOrders, TODAY);
  const machineMap = new Map();
  const ensureMachine = (name) => {
    const machine = machineForProductionFocus(name);
    if (!machineMap.has(machine)) {
      machineMap.set(machine, {
        name: machine,
        dailyCapacity: Number(machineCapacityKg[machine]) || 0,
        carteiraKg: 0,
        carteiraValue: 0,
        produceKg: 0,
        produceValue: 0,
        lateKg: 0,
        orders: new Set(),
        produceOrders: new Set(),
        products: new Set()
      });
    }
    return machineMap.get(machine);
  };

  productionMachines.forEach(ensureMachine);
  pipelineOrders.forEach((order) => {
    (order.linhas || []).forEach((line) => {
      const row = ensureMachine(line.maquina);
      const kg = Number(line.kg) || 0;
      row.carteiraKg += kg;
      row.carteiraValue += Number(line.valor) || 0;
      if ((order.dataEntrega || "") < TODAY) row.lateKg += kg;
      row.orders.add(order.pedido);
      if (line.produto) row.products.add(line.produto);
    });
  });

  goalStockAnalysis.needsProduction.forEach((line) => {
    const row = ensureMachine(line.maquina);
    row.produceKg += line.produceKg || 0;
    row.produceValue += line.produceValue || 0;
    row.produceOrders.add(line.pedido);
    if (line.produto) row.products.add(line.produto);
  });

  const rawMachineRows = [...machineMap.values()]
    .filter((row) => row.dailyCapacity > 0 || row.carteiraKg > 0 || row.produceKg > 0)
    .map((row) => {
      const remainingCapacityKg = row.dailyCapacity * diasRestantes;
      const daysNeeded = row.dailyCapacity ? row.produceKg / row.dailyCapacity : 0;
      const capacityGapKg = remainingCapacityKg - row.produceKg;
      return {
        ...row,
        ordersCount: row.orders.size,
        produceOrdersCount: row.produceOrders.size,
        productCount: row.products.size,
        sampleProducts: [...row.products].slice(0, 3),
        remainingCapacityKg,
        daysNeeded,
        capacityGapKg,
        openCapacityKg: Math.max(capacityGapKg, 0),
        overloadKg: Math.max(-capacityGapKg, 0)
      };
    });
  const totalOpenCapacityKg = rawMachineRows.reduce((sum, row) => sum + (row.dailyCapacity > 0 ? row.openCapacityKg : 0), 0);
  const machineFocusRows = rawMachineRows
    .map((row) => {
      const captureTargetKg = saldoKg > 0 && totalOpenCapacityKg > 0 && row.dailyCapacity > 0
        ? Math.min(row.openCapacityKg, saldoKg * (row.openCapacityKg / totalOpenCapacityKg))
        : 0;
      const captureTargetValue = captureTargetKg * (aprilSales.revenue / aprilSales.weightKg);
      const tone = row.overloadKg > 0 ? "red" : captureTargetKg > 0 ? "amber" : row.produceKg > 0 ? "blue" : "green";
      const status = row.overloadKg > 0
        ? "Sobrecarga"
        : captureTargetKg > 0
          ? "Captar para meta"
          : row.produceKg > 0
            ? "Produzir carteira"
            : "Sem pressão";
      return { ...row, captureTargetKg, captureTargetValue, tone, status };
    })
    .sort((a, b) => b.overloadKg - a.overloadKg || b.captureTargetKg - a.captureTargetKg || b.produceKg - a.produceKg);

  const machineFocusCards = machineFocusRows.map((row) => `
    <article class="inventory-machine-card ${row.tone}">
      <span>${escapeHtml(row.name)}</span>
      <strong>${row.overloadKg > 0 ? formatKg(row.overloadKg, 0) : row.captureTargetKg > 0 ? formatKg(row.captureTargetKg, 0) : formatKg(row.produceKg, 0)}</strong>
      <small>${escapeHtml(row.status)} · ${formatKg(row.dailyCapacity, 0)}/dia · ${row.daysNeeded.toFixed(1).replace(".", ",")} dias de produção</small>
    </article>
  `).join("");

  const machineFocusTableRows = machineFocusRows.map((row) => {
    const gapTone = row.overloadKg > 0 ? "red" : row.captureTargetKg > 0 ? "amber" : "green";
    const products = row.sampleProducts.length
      ? `${row.productCount} produto${row.productCount !== 1 ? "s" : ""}: ${row.sampleProducts.map(escapeHtml).join(", ")}${row.productCount > 3 ? "..." : ""}`
      : "Sem produto em carteira";
    const focusText = row.overloadKg > 0
      ? `Reprogramar ${formatKg(row.overloadKg, 0)} ou deslocar prazo.`
      : row.captureTargetKg > 0
        ? `Captar ${formatKg(row.captureTargetKg, 0)} para usar a folga da máquina.`
        : "Carteira atual ocupa o foco produtivo.";
    return `
      <tr>
        <td style="text-align:left"><strong>${escapeHtml(row.name)}</strong><br><small>${products}</small></td>
        <td>${row.dailyCapacity ? `${formatKg(row.dailyCapacity, 0)}/dia` : "Sem meta"}</td>
        <td>${formatKg(row.carteiraKg, 0)}<br><small>${row.ordersCount} pedido${row.ordersCount !== 1 ? "s" : ""}</small></td>
        <td>${formatKg(row.produceKg, 0)}<br><small>${row.produceOrdersCount} pedido${row.produceOrdersCount !== 1 ? "s" : ""}</small></td>
        <td>${row.dailyCapacity ? row.daysNeeded.toFixed(1).replace(".", ",") : "-"}</td>
        <td><span class="status-pill ${gapTone}">${row.overloadKg > 0 ? `-${formatKg(row.overloadKg, 0)}` : formatKg(row.openCapacityKg, 0)}</span></td>
        <td>${row.captureTargetKg ? `${formatKg(row.captureTargetKg, 0)}<br><small>${formatBRL(row.captureTargetValue, 0)}</small>` : "-"}</td>
        <td style="text-align:left">${escapeHtml(focusText)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="section-grid">

      ${kpiCard("Meta maio · 450 t", formatKg(targetKg), `${formatPercent(totalCobertoKg / targetKg)} coberto (fat + carteira)`, "green")}
      ${kpiCard(`Faturado ${mayStart}–${mayEnd}`, formatBRL(faturadoVal), `${formatKg(faturadoKg, 2)} · ${formatPercent(faturadoKg / targetKg)} da meta`, "blue")}
      ${kpiCard("Carteira pipeline maio", formatKg(pipelineKg, 0), `${formatBRL(pipelineVal, 0)} · ${pipelineOrders.length} pedido${pipelineOrders.length !== 1 ? "s" : ""}`, "amber")}
      ${kpiCard("Saldo a capturar", formatKg(saldoKg, 0), saldoKg > 0 ? `${formatPercent(saldoKg / targetKg)} ainda sem pedido em carteira` : "Meta totalmente coberta", saldoKg > 50000 ? "red" : "green")}

      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Progresso para 450 t</h2>
            <p>Faturado (verde) + carteira pipeline maio (âmbar) + saldo descoberto (laranja cítrico).</p>
          </div>
          <span class="status-pill ${totalCobertoKg >= targetKg ? "" : "red"}">${formatPercent(totalCobertoKg / targetKg)} coberto</span>
        </div>
        <div style="display:flex;height:34px;border-radius:8px;overflow:hidden;gap:2px;margin:10px 0">
          <div style="width:${pctFat.toFixed(1)}%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:0.74rem;color:#fff;font-weight:700">${pctFat >= 7 ? formatPercent(faturadoKg / targetKg) : ""}</div>
          <div style="width:${pctPipe.toFixed(1)}%;background:var(--amber);display:flex;align-items:center;justify-content:center;font-size:0.74rem;color:#fff;font-weight:700">${pctPipe >= 7 ? formatPercent(pipelineKg / targetKg) : ""}</div>
          <div style="width:${pctGap.toFixed(1)}%;background:#ff9f1c;display:flex;align-items:center;justify-content:center;font-size:0.74rem;color:#3a2300;font-weight:800">${pctGap >= 7 ? formatPercent(saldoKg / targetKg) : ""}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:0.8rem;color:var(--muted)">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--green);margin-right:4px"></span>Faturado ${formatKg(faturadoKg, 0)}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--amber);margin-right:4px"></span>Carteira ${formatKg(pipelineKg, 0)}</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#ff9f1c;margin-right:4px"></span>Saldo ${formatKg(saldoKg, 0)}</span>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Foco por máquina · carteira x capacidade</h2>
            <p>Mostra quanto da carteira ainda precisa de produção, quantos dias cada máquina consome e onde captar o saldo da meta. Rebobinadeira entra como acabamento de Corte 1 e não aparece como máquina separada.</p>
          </div>
          <div class="control-row">
            <span class="status-pill ${saldoKg > 0 ? "amber" : "green"}">${saldoKg > 0 ? `${formatKg(saldoKg, 0)} ainda sem pedido` : "Meta coberta"}</span>
            <button class="ghost-button" type="button" data-export-goals-pdf>Exportar PDF vendas</button>
          </div>
        </div>
        <div class="inventory-machine-grid">${machineFocusCards}</div>
        <div class="data-table-wrap goals-table" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Máquina / produtos</th>
                <th>Capacidade</th>
                <th>Carteira maio</th>
                <th>A produzir</th>
                <th>Dias</th>
                <th>Folga até fim do mês</th>
                <th>Falta p/ meta</th>
                <th style="text-align:left">Foco</th>
              </tr>
            </thead>
            <tbody>${machineFocusTableRows || `<tr><td colspan="8" style="text-align:center;color:var(--muted)">Sem carteira por máquina para analisar.</td></tr>`}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-12 management-hero">
        <div class="panel-header">
          <div>
            <h2>Análise diária do objetivo</h2>
            <p>Ritmo de faturamento real vs ritmo necessário para fechar os ${formatKg(saldoKg, 0)} restantes em ~${diasRestantes} dias úteis.</p>
          </div>
        </div>
        <div class="management-grid">
          ${managementCard("Ritmo faturamento atual", `${formatKg(ritmoAtualKg, 0)}/dia nos ${diasFaturados} dias faturados · R$/dia ${formatBRL(faturadoVal / diasFaturados, 0)}.`, `Meta diária de referência: ${formatKg(metaDiaria, 0)}/dia.`)}
          ${managementCard("Ritmo necessário (saldo)", `${ritmoNecKg > 0 ? formatKg(ritmoNecKg, 0) + "/dia" : "Meta coberta pela carteira"} para fechar ${formatKg(saldoKg, 0)} em ${diasRestantes} dias úteis.`, ritmoNecKg > ritmoAtualKg ? "Acima do ritmo atual — acelerar captação." : "Dentro do ritmo — executável.")}
          ${managementCard("Cobertura pela carteira", `${pipelineOrders.length} pedidos · ${formatKg(pipelineKg, 0)} em aberto com entrega em maio. Atrasados: ${carteiraAtr.length} pedidos.`, "Faturar atrasados primeiro libera saldo imediato.")}
          ${managementCard("Projeção ao ritmo atual", `${formatKg(projecaoFinalKg, 0)} ao ritmo de ${formatKg(ritmoAtualKg, 0)}/dia até fim de maio.`, projecaoFinalKg >= targetKg ? "Meta atingível ao ritmo atual." : `Déficit projetado de ${formatKg(targetKg - projecaoFinalKg, 0)} — precisa acelerar.`)}
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Faturamento diário · maio 2026</h2>
            <p>Verde = atingiu meta diária (${formatKg(metaDiaria, 0)}/dia). Âmbar = abaixo da meta.</p>
          </div>
        </div>
        ${barList(dailyBars)}
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Carteira por prazo de entrega</h2>
            <p>Pipeline de kg a faturar agrupado por semana.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead><tr><th style="text-align:left">Semana</th><th>Pedidos</th><th>Peso (kg)</th><th>Valor (R$)</th></tr></thead>
            <tbody>
              ${weekRows.map(r => `<tr>
                <td style="text-align:left"><strong>${escapeHtml(r.label)}</strong></td>
                <td>${r.count}</td>
                <td>${formatKg(r.kg, 0)}</td>
                <td>${formatBRL(r.val, 0)}</td>
              </tr>`).join("")}
            </tbody>
            <tfoot><tr>
              <td style="text-align:left"><strong>Total pipeline</strong></td>
              <td>${weekRows.reduce((s, r) => s + r.count, 0)}</td>
              <td>${formatKg(pipelineKg, 0)}</td>
              <td>${formatBRL(pipelineVal, 0)}</td>
            </tr></tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Vendas · entrada diária de pedidos</h2>
            <p>Registre ao fim do dia o total captado. Acumulado de maio — mostra o fluxo de novos pedidos que alimentam a carteira e a meta.</p>
          </div>
          <span class="status-pill blue">${mayOrders.length} dia${mayOrders.length !== 1 ? "s" : ""} registrado${mayOrders.length !== 1 ? "s" : ""}</span>
        </div>
        ${mayOrders.length ? `
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Total captado maio", formatBRL(mayOrdersVal), `${formatKg(mayOrdersKg, 2)} registrados`, "green")}
          ${kpiCard("Média diária captada", formatBRL(mayOrdersVal / mayOrders.length), `${formatKg(mayOrdersKg / mayOrders.length, 0)}/dia`, "blue")}
          ${kpiCard("Cobertura da meta", formatPercent(mayOrdersKg / targetKg), `${formatKg(mayOrdersKg, 0)} de ${formatKg(targetKg, 0)} captados`, mayOrdersKg / targetKg >= 0.5 ? "green" : "amber")}
        </div>
        <p style="margin:12px 2px 0;font-size:0.84rem;color:var(--muted)">Para registrar mais dias, acesse a página <strong>Vendas</strong> no menu.</p>
        ` : `
        <div style="padding:24px 0;text-align:center;color:var(--muted);font-size:0.9rem">
          Nenhuma entrada registrada em maio ainda. <strong>Use a página Vendas</strong> para registrar o total captado ao fim de cada dia.
        </div>
        `}
      </article>

      <article class="panel span-12 representatives-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Rateio da meta por representante/canal</h2>
            <p>Volume proporcional ao peso de abril, R$/kg histórico e faturamento estimado para maio.</p>
          </div>
        </div>
        ${mayGoalTable(plan, targetKg)}
      </article>
    </div>
  `;
}

function renderFinance() {
  const throughMonth = latestMonth(2026);
  const ytd = totalSales(2026, throughMonth);
  const ytdWithPartial = totalSales(2026, 12, { includePartial: true });
  const total2025 = totalSales(2025);
  const forecast = (ytd.revenue / throughMonth) * 12;
  const target = getRevenueTarget();
  const mayPartial = salesRecord(2026, 5);
  const partialThroughLabel = mayPartial?.partialThrough
    ? new Date(mayPartial.partialThrough + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";

  const config = getConfig();
  const cmvYtd = ytd.weightKg * config.costPerKg;
  const grossMarginYtd = ytd.revenue - cmvYtd;
  const grossMarginPctYtd = ytd.revenue ? grossMarginYtd / ytd.revenue : 0;
  const fixedMonthly = config.fixedCostMonthly;
  const fixedYtd = fixedMonthly * throughMonth;
  const ebitdaYtd = grossMarginYtd - fixedYtd;
  const ebitdaPctYtd = ytd.revenue ? ebitdaYtd / ytd.revenue : 0;
  const breakEvenKg = config.costPerKg > 0 ? fixedMonthly / ((ytd.revenue / ytd.weightKg) - config.costPerKg) : 0;

  return `
    <div class="section-grid">
      ${kpiCard("Faturamento 2023", formatBRL(totalSales(2023).revenue, 0), `${formatKg(totalSales(2023).weightKg)} vendidos`, "blue")}
      ${kpiCard("Faturamento 2024", formatBRL(totalSales(2024).revenue, 0), `${formatPercent(change(totalSales(2024).revenue, totalSales(2023).revenue))} vs 2023`, "green")}
      ${kpiCard("Faturamento 2025", formatBRL(total2025.revenue, 0), `${formatPercent(change(total2025.revenue, totalSales(2024).revenue))} vs 2024`, "amber")}
      ${kpiCard("Parcial 2026", formatBRL(ytdWithPartial.revenue), `Projeção linear ${formatBRL(forecast)}${mayPartial ? ` · inclui maio parcial até ${partialThroughLabel}` : ""}`, "red")}

      <article class="panel span-12 management-hero">
        <div class="panel-header">
          <div>
            <h2>P&L estimado · jan-abr 2026</h2>
            <p>Demonstrativo simplificado usando custo R$/kg e custo fixo mensal configurados em Operação.</p>
          </div>
          <span class="status-pill ${grossMarginPctYtd >= 0.3 ? '' : 'amber'}">Margem ${formatPercent(grossMarginPctYtd)}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Receita bruta", formatBRL(ytd.revenue), `${formatKg(ytd.weightKg)} faturados`, "green")}
          ${kpiCard("CMV (custo variável)", formatBRL(cmvYtd, 0), `${formatKg(ytd.weightKg)} × R$ ${config.costPerKg.toFixed(2)}/kg`, "amber")}
          ${kpiCard("Margem bruta", formatBRL(grossMarginYtd, 0), `${formatPercent(grossMarginPctYtd)} sobre receita`, grossMarginPctYtd >= 0.3 ? "green" : "red")}
          ${kpiCard("EBITDA estimado", formatBRL(ebitdaYtd, 0), `${formatPercent(ebitdaPctYtd)} · após R$ ${(fixedYtd / 1e6).toFixed(2)}MM fixos`, ebitdaYtd > 0 ? "blue" : "red")}
        </div>
        <p style="margin:14px 2px 0; font-size:0.84rem; color:var(--muted)">
          <strong>Break-even mensal estimado:</strong> ${breakEvenKg > 0 ? `${formatKg(breakEvenKg)} (com R$/kg médio atual)` : "N/A"}.
          Para alterar custo/kg ou custo fixo, vá em <strong>Operação → Configurações</strong>.
        </p>
      </article>

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
        </div>
        ${financeTable()}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Sazonalidade · 2023 → 2026</h2>
            <p>Mesmo mês entre anos com variação YoY. Permite ler se janeiro/fev/mar/abr/etc historicamente são picos ou vales.</p>
          </div>
          <div class="control-row">
            ${metricButtons()}
          </div>
        </div>
        ${seasonalityTable(state.metric)}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Decomposição preço × volume · 2025 vs 2026</h2>
            <p>Quanto do crescimento jan-abr veio de peso e quanto veio de preço médio.</p>
          </div>
        </div>
        ${priceVolumeDecomposition()}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Comparativo jan-abr ano a ano</h2>
            <p>Recorte usado para comparar 2026 contra anos completos anteriores.</p>
          </div>
        </div>
        ${comparisonTable()}
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Tabela mensal — ${state.metric === "revenue" ? "Faturamento" : "Peso"}</h2>
            <p>Pivot mês × ano. Maio/2026 destacado em âmbar (parcial).</p>
          </div>
          <div class="control-row">
            ${metricButtons()}
          </div>
        </div>
        ${pivotTable(state.metric)}
      </article>
    </div>
  `;
}

// =================== CLIENTES ===================
function renderCustomers() {
  const allCustomers = customerAggregates();
  if (!allCustomers.length) {
    return `<div class="section-grid"><article class="panel span-12"><div class="empty-state-rich">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="6" width="18" height="14" rx="2"></rect>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </div>
      <h3>Sem clientes para mostrar</h3>
      <p>Importe NFs ou adicione pedidos na carteira para começar a análise de clientes.</p>
    </div></article></div>`;
  }

  const query = (state.customerQuery || "").trim().toLowerCase();
  const customers = query
    ? allCustomers.filter((c) =>
        c.group.toLowerCase().includes(query) ||
        c.states.some((s) => s.toLowerCase().includes(query)) ||
        c.representatives.some((r) => r.toLowerCase().includes(query)) ||
        c.cities.some((city) => city.toLowerCase().includes(query))
      )
    : allCustomers;

  const totals = customers.reduce((acc, c) => {
    acc.revenue += c.revenue;
    acc.weightKg += c.weightKg;
    acc.invoices += c.invoices;
    acc.backlogRevenue += c.backlogRevenue;
    acc.backlogWeightKg += c.backlogWeightKg;
    acc.backlogOrders += c.backlogOrders;
    acc.commercialRevenue += c.commercialRevenue;
    acc.commercialWeightKg += c.commercialWeightKg;
    return acc;
  }, { revenue: 0, weightKg: 0, invoices: 0, backlogRevenue: 0, backlogWeightKg: 0, backlogOrders: 0, commercialRevenue: 0, commercialWeightKg: 0 });

  const classified = abcClassify(customers, "commercialRevenue");
  const aCount = classified.filter((c) => c.abc === "A").length;
  const bCount = classified.filter((c) => c.abc === "B").length;
  const cCount = classified.filter((c) => c.abc === "C").length;
  const top = classified[0];
  const topShare = totals.commercialRevenue ? top.commercialRevenue / totals.commercialRevenue : 0;
  const invoiceRefDate = getInvoiceReferenceDate();
  const backlogRefDate = getBacklogReferenceDate();
  const invoiceRefLabel = formatIsoShort(invoiceRefDate);
  const backlogRefLabel = formatIsoShort(backlogRefDate);

  // Por estado
  const byState = new Map();
  customers.forEach((c) => {
    const customerStates = c.states.length ? c.states : ["—"];
    customerStates.forEach((uf) => {
      if (!byState.has(uf)) byState.set(uf, { uf, revenue: 0, weightKg: 0, customers: 0 });
      const agg = byState.get(uf);
      agg.revenue += c.commercialRevenue / customerStates.length;
      agg.weightKg += c.commercialWeightKg / customerStates.length;
      agg.customers += 1;
    });
  });
  const stateRows = [...byState.values()].sort((a, b) => b.revenue - a.revenue);

  const refDate = invoiceRefDate;
  const refDateObj = new Date(refDate + "T12:00:00");

  const tableRows = classified.map((c) => {
    const daysSince = c.lastDate
      ? Math.round((refDateObj - new Date(c.lastDate + "T12:00:00")) / 86400000)
      : null;
    const statusLabel = daysSince === null
      ? (c.backlogOrders ? "Carteira" : "Sem NF")
      : daysSince <= 3 ? "Ativo" : daysSince <= 14 ? "Acompanhar" : "Inativo";
    const statusClass = daysSince === null
      ? (c.backlogOrders ? "blue" : "red")
      : daysSince <= 3 ? "" : daysSince <= 14 ? "amber" : "red";
    const statusDetail = daysSince === null
      ? (c.nextDeliveryDate ? `entrega ${formatIsoShort(c.nextDeliveryDate)}` : "sem NF")
      : `${daysSince}d`;
    return `
      <tr>
        <td>
          <span class="status-pill ${c.abc === 'A' ? '' : c.abc === 'B' ? 'amber' : 'red'}">${c.abc}</span>
        </td>
        <td>
          <strong>${escapeHtml(c.group)}</strong>
          ${c.members.length > 1 ? `<br><small style="color:var(--muted)">${c.members.length} razões sociais</small>` : ""}
        </td>
        <td>${escapeHtml(c.states.length ? c.states.join(", ") : "—")}</td>
        <td>${escapeHtml(c.representatives.join(", "))}</td>
        <td>${c.invoices}</td>
        <td>${formatBRL(c.revenue)}<br><small style="color:var(--muted)">${formatKg(c.weightKg, 2)}</small></td>
        <td>${formatBRL(c.backlogRevenue)}<br><small style="color:var(--muted)">${formatKg(c.backlogWeightKg, 2)} · ${c.backlogOrders} pedido${c.backlogOrders !== 1 ? "s" : ""}</small></td>
        <td>${formatBRL(c.commercialRevenue)}<br><small style="color:var(--muted)">${formatKg(c.commercialWeightKg, 2)}</small></td>
        <td>${formatBRL(c.commercialPricePerKg)}/kg</td>
        <td>${formatPercent(c.share)}<br><small style="color:var(--muted)">${formatPercent(c.cumShare)} acum.</small></td>
        <td><span class="status-pill ${statusClass}">${statusLabel} (${statusDetail})</span></td>
      </tr>
    `;
  }).join("");

  const stateBars = stateRows.map((s) => {
    const w = Math.max(2, Math.round((s.revenue / Math.max(totals.commercialRevenue, 1)) * 100));
    return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(stateName(s.uf))} (${s.uf})<br><small style="color:var(--muted)">${s.customers} cliente${s.customers > 1 ? "s" : ""}</small></div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(s.revenue)}<br><small style="color:var(--muted)">${formatKg(s.weightKg, 2)}</small></div>
      </div>
    `;
  }).join("");

  return `
    <div class="section-grid">
      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Clientes · análise comercial</h2>
            <p>Curva ABC, agrupamento por grupo econômico, recência e cobertura geográfica das NFs ${refDateObj.toLocaleDateString("pt-BR", { month: "long" })}/2026.</p>
          </div>
          <span class="status-pill blue">${customers.length} cliente${customers.length > 1 ? "s" : ""}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Faturamento", formatBRL(totals.revenue), `${formatKg(totals.weightKg, 2)} · ${totals.invoices} NFs`, "green")}
          ${kpiCard("Maior cliente", escapeHtml(top.group), `${formatPercent(topShare)} · ${formatBRL(top.revenue)}`, "amber")}
          ${kpiCard("Pareto · classe A", `${aCount}`, `Top ${formatPercent(getConfig().abcThresholds.a)} = ${aCount} cliente${aCount > 1 ? "s" : ""}`, "blue")}
          ${kpiCard("Cobertura geográfica", `${stateRows.length} UF${stateRows.length > 1 ? "s" : ""}`, stateRows.slice(0, 3).map(s => s.uf).join(" · "), "red")}
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Ranking ABC de clientes</h2>
            <p>Ordenado por faturamento. <strong>A</strong> = Top ${formatPercent(getConfig().abcThresholds.a)} · <strong>B</strong> = até ${formatPercent(getConfig().abcThresholds.b)} · <strong>C</strong> = cauda longa. Clique no cabeçalho para ordenar.</p>
          </div>
          <span class="status-pill">A: ${aCount} · B: ${bCount} · C: ${cCount}</span>
        </div>
        <div class="control-row" style="margin-bottom:14px">
          <input class="search-input" id="customer-search" type="search" placeholder="Buscar cliente, UF, cidade ou representante…" value="${escapeHtml(state.customerQuery || "")}" style="max-width:380px">
          ${customers.length !== allCustomers.length ? `<span class="status-pill blue">${customers.length}/${allCustomers.length}</span>` : ""}
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th data-sort-key="abc">ABC</th>
                <th style="text-align:left" data-sort-key="client">Cliente / Grupo</th>
                <th style="text-align:left" data-sort-key="uf">UF</th>
                <th style="text-align:left" data-sort-key="rep">Representante</th>
                <th data-sort-key="nfs" data-sort-type="number">NFs</th>
                <th data-sort-key="weight" data-sort-type="number">Peso</th>
                <th data-sort-key="revenue" data-sort-type="number">Faturamento</th>
                <th data-sort-key="rkg" data-sort-type="number">R$/kg</th>
                <th data-sort-key="ticket" data-sort-type="number">Ticket médio</th>
                <th data-sort-key="share" data-sort-type="number">Participação</th>
                <th data-sort-key="rec" data-sort-type="number">Recência</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <p style="margin: 10px 2px 0; font-size: 0.82rem; color: var(--muted);">
          <strong>Recência</strong>: dias desde a última NF até ${refDateObj.toLocaleDateString("pt-BR")} ·
          <span class="status-pill" style="margin:0 4px">≤3d Ativo</span>
          <span class="status-pill amber" style="margin:0 4px">≤14d Acompanhar</span>
          <span class="status-pill red" style="margin:0 4px">+14d Inativo</span>
        </p>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Cobertura por estado</h2>
            <p>Faturamento distribuído entre UFs com cliente faturado no período.</p>
          </div>
        </div>
        <div class="bar-list">${stateBars}</div>
      </article>
    </div>
  `;
}

// =================== PRODUTOS ===================
function renderProducts() {
  const allItems = data.productMix2026?.items || [];
  if (!allItems.length) {
    return `<div class="section-grid"><article class="panel span-12"><div class="empty-state-rich">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7l9-4 9 4-9 4-9-4z"></path>
          <path d="M3 7v10l9 4 9-4V7"></path>
        </svg>
      </div>
      <h3>Sem produtos cadastrados</h3>
      <p>Os produtos aparecem aqui quando há NFs emitidas. Importe a próxima planilha de NF para popular o mix.</p>
    </div></article></div>`;
  }
  const query = (state.productQuery || "").trim().toLowerCase();
  const items = query
    ? allItems.filter((p) =>
        p.description.toLowerCase().includes(query) ||
        p.line.toLowerCase().includes(query) ||
        p.color.toLowerCase().includes(query) ||
        String(p.grammage).includes(query)
      )
    : allItems;

  const totals = items.reduce((acc, p) => {
    acc.revenue += p.revenue;
    acc.weightKg += p.weightKg;
    return acc;
  }, { revenue: 0, weightKg: 0 });

  const classified = abcClassify(items, "revenue");

  // Agrupamento por linha
  const byLine = new Map();
  items.forEach((p) => {
    if (!byLine.has(p.line)) byLine.set(p.line, { line: p.line, weightKg: 0, revenue: 0, skus: 0 });
    const agg = byLine.get(p.line);
    agg.weightKg += p.weightKg;
    agg.revenue += p.revenue;
    agg.skus += 1;
  });
  const lineRows = [...byLine.values()].sort((a, b) => b.revenue - a.revenue);

  // Por cor
  const byColor = new Map();
  items.forEach((p) => {
    const key = p.color;
    if (!byColor.has(key)) byColor.set(key, { color: p.color, weightKg: 0, revenue: 0 });
    const agg = byColor.get(key);
    agg.weightKg += p.weightKg;
    agg.revenue += p.revenue;
  });
  const colorRows = [...byColor.values()].sort((a, b) => b.revenue - a.revenue);

  // Por gramatura
  const byGrammage = new Map();
  items.forEach((p) => {
    const key = p.grammage;
    if (!byGrammage.has(key)) byGrammage.set(key, { grammage: p.grammage, weightKg: 0, revenue: 0, skus: 0 });
    const agg = byGrammage.get(key);
    agg.weightKg += p.weightKg;
    agg.revenue += p.revenue;
    agg.skus += 1;
  });
  const grammageRows = [...byGrammage.values()].sort((a, b) => a.grammage - b.grammage);

  // Por largura
  const byWidth = new Map();
  items.forEach((p) => {
    const key = p.width;
    if (!byWidth.has(key)) byWidth.set(key, { width: p.width, weightKg: 0, revenue: 0, skus: 0 });
    const agg = byWidth.get(key);
    agg.weightKg += p.weightKg;
    agg.revenue  += p.revenue;
    agg.skus     += 1;
  });
  const widthRows = [...byWidth.values()].sort((a, b) => b.weightKg - a.weightKg);

  const skuRows = classified.map((p) => `
    <tr>
      <td><span class="status-pill ${p.abc === 'A' ? '' : p.abc === 'B' ? 'amber' : 'red'}">${p.abc}</span></td>
      <td style="text-align:left">${escapeHtml(p.description)}</td>
      <td>${escapeHtml(p.line)}</td>
      <td>${escapeHtml(p.color)}</td>
      <td>${p.grammage} g</td>
      <td>${formatKg(p.weightKg, 2)}</td>
      <td>${formatBRL(p.revenue)}</td>
      <td>${formatBRL(p.pricePerKg)}/kg</td>
      <td>${formatPercent(p.share)}</td>
    </tr>
  `).join("");

  const lineBars = lineRows.map((l) => {
    const w = Math.max(2, Math.round((l.revenue / totals.revenue) * 100));
    const rkg = l.weightKg ? l.revenue / l.weightKg : 0;
    return `
      <div class="bar-row">
        <div class="bar-label"><strong>${escapeHtml(l.line)}</strong><br><small style="color:var(--muted)">${l.skus} SKU${l.skus > 1 ? "s" : ""} · R$ ${rkg.toFixed(2)}/kg</small></div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(l.revenue)}<br><small style="color:var(--muted)">${formatKg(l.weightKg, 2)}</small></div>
      </div>
    `;
  }).join("");

  const colorBars = colorRows.map((c) => {
    const w = Math.max(2, Math.round((c.revenue / totals.revenue) * 100));
    return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(c.color)}</div>
        <div class="bar-track"><div class="bar-fill blue" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(c.revenue)}<br><small style="color:var(--muted)">${formatKg(c.weightKg, 2)}</small></div>
      </div>
    `;
  }).join("");

  const grammageBars = grammageRows.map((g) => {
    const w = Math.max(2, Math.round((g.revenue / totals.revenue) * 100));
    const rkg = g.weightKg ? g.revenue / g.weightKg : 0;
    return `
      <div class="bar-row">
        <div class="bar-label">${g.grammage} g/m² <small style="color:var(--muted)">(${g.skus} SKUs)</small></div>
        <div class="bar-track"><div class="bar-fill amber" style="width:${w}%"></div></div>
        <div class="bar-value">${formatBRL(g.revenue)}<br><small style="color:var(--muted)">R$ ${rkg.toFixed(2)}/kg</small></div>
      </div>
    `;
  }).join("");

  const widthBars = widthRows.map((wRow) => {
    const w = Math.max(2, Math.round((wRow.weightKg / totals.weightKg) * 100));
    const rkg = wRow.weightKg ? wRow.revenue / wRow.weightKg : 0;
    return `
      <div class="bar-row">
        <div class="bar-label"><strong>${wRow.width} mm</strong><br><small style="color:var(--muted)">${wRow.skus} SKU${wRow.skus > 1 ? "s" : ""} · R$ ${rkg.toFixed(2)}/kg</small></div>
        <div class="bar-track"><div class="bar-fill${wRow.width === 1400 ? "" : wRow.width === 2100 ? " blue" : " amber"}" style="width:${w}%"></div></div>
        <div class="bar-value">${formatKg(wRow.weightKg, 0)}<br><small style="color:var(--muted)">${formatPercent(wRow.weightKg / totals.weightKg)}</small></div>
      </div>
    `;
  }).join("");

  return `
    <div class="section-grid">
      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Produtos faturados · mês vigente</h2>
            <p>Base de faturamento analisada no mês: SKUs com NF emitida dentro do período vigente de maio, por linha, cor e gramatura.</p>
          </div>
          <span class="status-pill blue">${items.length} SKUs</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Faturamento", formatBRL(totals.revenue), `${formatKg(totals.weightKg, 2)}`, "green")}
          ${kpiCard("Linhas ativas", `${lineRows.length}`, lineRows.map(l => l.line).join(" · "), "blue")}
          ${kpiCard("R$/kg médio", formatBRL(totals.revenue / totals.weightKg), "Média ponderada", "amber")}
          ${kpiCard("SKU mais faturado", escapeHtml(classified[0]?.description.split(" ").slice(0, 4).join(" ")), formatBRL(classified[0]?.revenue), "red")}
        </div>
      </article>

      <article class="panel span-7">
        <div class="panel-header">
          <div>
            <h2>Por largura</h2>
            <p>Volume e participação por largura de bobina. Verde = 1400 mm · Azul = 2100 mm · Âmbar = outros.</p>
          </div>
        </div>
        <div class="bar-list">${widthBars}</div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Ranking por largura</h2>
            <p>Comparativo kg, R$ e R$/kg por bitola.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Largura</th>
                <th>kg</th>
                <th>%</th>
                <th>R$/kg</th>
                <th>SKUs</th>
              </tr>
            </thead>
            <tbody>
              ${widthRows.map(wRow => {
                const rkg = wRow.weightKg ? wRow.revenue / wRow.weightKg : 0;
                return `<tr>
                  <td style="text-align:left"><strong>${wRow.width} mm</strong></td>
                  <td>${formatKg(wRow.weightKg, 0)}</td>
                  <td>${formatPercent(wRow.weightKg / totals.weightKg)}</td>
                  <td>${formatBRL(rkg)}/kg</td>
                  <td>${wRow.skus}</td>
                </tr>`;
              }).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total</strong></td>
                <td>${formatKg(totals.weightKg, 0)}</td>
                <td>100%</td>
                <td>${formatBRL(totals.revenue / totals.weightKg)}/kg</td>
                <td>${items.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-6">
        <div class="panel-header">
          <div>
            <h2>Por linha</h2>
            <p>NTLD, NTEI, NTED, TNT — linhas que efetivamente viraram NF no mês analisado.</p>
          </div>
        </div>
        <div class="bar-list">${lineBars}</div>
      </article>

      <article class="panel span-6">
        <div class="panel-header">
          <div>
            <h2>Por cor</h2>
            <p>Distribuição das cores faturadas no mês, não estoque nem carteira.</p>
          </div>
        </div>
        <div class="bar-list">${colorBars}</div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Por gramatura</h2>
            <p>Onde está o faturamento por g/m² dentro das NFs emitidas no mês vigente.</p>
          </div>
        </div>
        <div class="bar-list">${grammageBars}</div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Ranking ABC de SKUs faturados</h2>
            <p>Produtos faturados no mês vigente, ordenados por valor de NF. Clique no cabeçalho para ordenar.</p>
          </div>
        </div>
        <div class="control-row" style="margin-bottom:14px">
          <input class="search-input" id="product-search" type="search" placeholder="Buscar SKU, linha, cor ou gramatura…" value="${escapeHtml(state.productQuery || "")}" style="max-width:380px">
          ${items.length !== allItems.length ? `<span class="status-pill blue">${items.length}/${allItems.length}</span>` : ""}
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th data-sort-key="abc">ABC</th>
                <th style="text-align:left" data-sort-key="sku">SKU</th>
                <th style="text-align:left" data-sort-key="line">Linha</th>
                <th style="text-align:left" data-sort-key="color">Cor</th>
                <th data-sort-key="gram" data-sort-type="number">Gramatura</th>
                <th data-sort-key="weight" data-sort-type="number">Peso</th>
                <th data-sort-key="revenue" data-sort-type="number">Faturamento</th>
                <th data-sort-key="rkg" data-sort-type="number">R$/kg</th>
                <th data-sort-key="share" data-sort-type="number">Participação</th>
              </tr>
            </thead>
            <tbody>${skuRows}</tbody>
          </table>
        </div>
      </article>
    </div>
  `;
}

// =================== OPERAÇÃO ===================
function renderOperations() {
  const totals = data.dailyEntriesApril2026Totals;
  const aprilSales = salesRecord(2026, 4);
  const mayInvoices = data.mayInvoices2026;
  const today = mayInvoices?.period?.endDate || "2026-05-12";
  const productionDailyCapacityKg = {
    "Corte 1": 7000,
    "Corte 2": 9000
  };
  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
  const aprilDays = daysInMonth(2026, 4);
  const mayPeriodDate = mayInvoices?.period?.endDate ? new Date(mayInvoices.period.endDate + "T12:00:00") : new Date(2026, 4, 1);
  const mayDays = daysInMonth(mayPeriodDate.getFullYear(), mayPeriodDate.getMonth() + 1);
  const currentDay = mayPeriodDate.getDate();
  const daysRemaining = Math.max(mayDays - currentDay, 0);
  const todayLabel = mayPeriodDate.toLocaleDateString("pt-BR");
  const minLoadDays = 10;
  const avgSalesPrice = mayInvoices?.totals?.avgPrice || (aprilSales.revenue / aprilSales.weightKg);
  const currentMachineActuals = Object.fromEntries(Object.keys(productionDailyCapacityKg).map((name) => [name, 0]));
  (mayInvoices?.machines || []).forEach((machine) => {
    if (Object.prototype.hasOwnProperty.call(currentMachineActuals, machine.name)) {
      currentMachineActuals[machine.name] += machine.weightKg || 0;
    }
  });
  const remainingMonthCapacity = Object.entries(productionDailyCapacityKg).reduce((sum, [, daily]) => sum + daily * daysRemaining, 0);
  const producedToDateKg = Object.values(currentMachineActuals).reduce((sum, kg) => sum + kg, 0);
  const automaticMonthProductionKg = producedToDateKg + remainingMonthCapacity;
  const automaticMonthProductionValue = automaticMonthProductionKg * avgSalesPrice;
  const activeOrders = (data.carteiraOrders2026 || []).filter((order) => order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada");
  const stockAnalysis = buildBacklogStockAnalysis(activeOrders, getBacklogReferenceDate());
  const pcpMachines = Object.fromEntries(Object.keys(productionDailyCapacityKg).map((name) => [name, {
    name,
    dailyCapacity: productionDailyCapacityKg[name],
    produceKg: 0,
    produceValue: 0,
    orders: new Set(),
    lines: 0
  }]));
  const finishingLoad = { produceKg: 0, produceValue: 0, orders: new Set(), lines: 0 };

  stockAnalysis.needsProduction.forEach((line) => {
    const machine = pcpMachines[line.maquina] ? line.maquina : "Acabamento";
    const target = machine === "Acabamento" ? finishingLoad : pcpMachines[machine];
    target.produceKg += line.produceKg || 0;
    target.produceValue += line.produceValue || 0;
    target.lines += 1;
    target.orders.add(line.pedido);
  });

  const pcpRows = Object.values(pcpMachines).map((machine) => {
    const daysTaken = machine.dailyCapacity ? machine.produceKg / machine.dailyCapacity : 0;
    const monthCapacity = machine.dailyCapacity * mayDays;
    const producedToDate = currentMachineActuals[machine.name] || 0;
    const remainingCapacityKg = machine.dailyCapacity * daysRemaining;
    const automaticMonthKg = producedToDate + remainingCapacityKg;
    const utilization = monthCapacity ? machine.produceKg / monthCapacity : 0;
    const minLoadKg = machine.dailyCapacity * minLoadDays;
    const salesGapKg = Math.max(minLoadKg - machine.produceKg, 0);
    const commercialGapFullKg = Math.max(remainingCapacityKg - machine.produceKg, 0);
    return {
      ...machine,
      ordersCount: machine.orders.size,
      daysTaken,
      monthCapacity,
      producedToDate,
      remainingCapacityKg,
      automaticMonthKg,
      utilization,
      idleDays: Math.max(mayDays - daysTaken, 0),
      minLoadKg,
      salesGapKg,
      salesGapValue: salesGapKg * avgSalesPrice,
      commercialGapFullKg,
      commercialGapFullValue: commercialGapFullKg * avgSalesPrice,
      status: commercialGapFullKg > 0 ? "Precisa vender absorção" : "Carteira cobre produção"
    };
  });
  const totalPcpProduceKg = pcpRows.reduce((sum, row) => sum + row.produceKg, 0);
  const totalPcpDays = pcpRows.reduce((sum, row) => sum + row.daysTaken, 0);
  const totalPcpSalesGapKg = pcpRows.reduce((sum, row) => sum + row.salesGapKg, 0);
  const totalPcpSalesGapValue = pcpRows.reduce((sum, row) => sum + row.salesGapValue, 0);
  const totalCommercialGapFullKg = pcpRows.reduce((sum, row) => sum + row.commercialGapFullKg, 0);
  const totalCommercialGapFullValue = pcpRows.reduce((sum, row) => sum + row.commercialGapFullValue, 0);
  const pcpCards = pcpRows.map((row) => {
    const tone = row.daysTaken >= minLoadDays ? "green" : row.daysTaken >= 5 ? "amber" : "red";
    return `
      <article class="inventory-machine-card ${tone}">
        <span>${escapeHtml(row.name)}</span>
        <strong>${formatKg(row.automaticMonthKg, 0)}</strong>
        <small>Automático mês · carteira cobre ${row.daysTaken.toFixed(1).replace(".", ",")} dias · vender ${formatKg(row.commercialGapFullKg, 0)}</small>
      </article>
    `;
  }).join("");
  const pcpTableRows = pcpRows.map((row) => {
    const tone = row.commercialGapFullKg > 0 ? "red" : "";
    return `
      <tr>
        <td style="text-align:left"><strong>${escapeHtml(row.name)}</strong><br><small>${formatKg(row.dailyCapacity, 0)}/dia · ${daysRemaining} dias restantes</small></td>
        <td>${formatKg(row.producedToDate, 0)}</td>
        <td>${formatKg(row.remainingCapacityKg, 0)}</td>
        <td>${formatKg(row.automaticMonthKg, 0)}</td>
        <td>${formatKg(row.produceKg, 0)}<br><small>${row.daysTaken.toFixed(1).replace(".", ",")} dias</small></td>
        <td><span class="status-pill ${tone}">${formatKg(row.commercialGapFullKg, 0)}</span><br><small>${formatBRL(row.commercialGapFullValue, 0)}</small></td>
        <td>${formatKg(row.salesGapKg, 0)}<br><small>${minLoadDays} dias mínimos</small></td>
        <td><span class="status-pill ${tone}">${escapeHtml(row.status)}</span></td>
      </tr>
    `;
  }).join("");
  const pcpActionRows = pcpRows.map((row) => {
    const priority = row.commercialGapFullKg > 0
      ? `Vender ${formatKg(row.commercialGapFullKg, 0)} para absorver a produção automática dos próximos ${daysRemaining} dias.`
      : "Carteira atual cobre a capacidade restante da máquina.";
    return `
      <article class="priority-item">
        <span></span>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <p>${escapeHtml(priority)} A fábrica não deve parar por falta de pedido; se não vender, essa carga vira estoque acabado planejado.</p>
        </div>
      </article>
    `;
  }).join("");

  const machineActuals = {
    "Corte 1": totals.corte1Kg,
    "Corte 2": totals.corte2Kg
  };
  const finishingActualKg = totals.reboKg || 0;
  const productionCapacityMonthly = Object.fromEntries(
    Object.entries(productionDailyCapacityKg).map(([name, daily]) => [name, daily * aprilDays])
  );

  const machineRows = Object.entries(productionCapacityMonthly).map(([name, capacity]) => {
    const actual = machineActuals[name] || 0;
    const utilization = capacity ? actual / capacity : 0;
    const widthPct = Math.max(2, Math.min(100, Math.round(utilization * 100)));
    const status = utilization >= 0.85 ? "Alta utilização" : utilization >= 0.50 ? "Saudável" : "Ociosidade";
    const statusClass = utilization >= 0.85 ? "amber" : utilization >= 0.50 ? "" : "red";
    return `
      <div class="bar-row">
        <div class="bar-label">
          <strong>${name}</strong><br>
          <small style="color:var(--muted)">${formatKg(actual)} / ${formatKg(capacity)} no mês · ${formatKg(productionDailyCapacityKg[name], 0)}/dia · <span class="status-pill ${statusClass}" style="font-size:0.7rem">${status}</span></small>
        </div>
        <div class="bar-track"><div class="bar-fill ${utilization >= 0.85 ? "amber" : ""}" style="width:${widthPct}%"></div></div>
        <div class="bar-value">${formatPercent(utilization)}<br><small style="color:var(--muted)">${formatKg(Math.max(capacity - actual, 0))} disponível</small></div>
      </div>
    `;
  }).join("");

  const finishingRow = `
    <div class="bar-row">
      <div class="bar-label">
        <strong>Rebobinadeira</strong><br>
        <small style="color:var(--muted)">${formatKg(finishingActualKg)} em acabamento · sem meta produtiva</small>
      </div>
      <div class="bar-track"><div class="bar-fill blue" style="width:100%"></div></div>
      <div class="bar-value">Acabamento<br><small style="color:var(--muted)">corte de metragens menores</small></div>
    </div>
  `;

  const mayMachineRows = mayInvoices?.machines?.map((m) => {
    const isProductionMachine = Boolean(productionDailyCapacityKg[m.name]);
    const dailyCap = productionDailyCapacityKg[m.name] || 0;
    const cap = isProductionMachine ? dailyCap * mayDays : 0;
    const util = cap ? (m.weightKg / cap) : null;
    return `
      <tr>
        <td><strong>${escapeHtml(m.name)}</strong></td>
        <td>${formatKg(m.weightKg, 2)}</td>
        <td>${formatBRL(m.revenue)}</td>
        <td>${formatBRL(m.revenue / m.weightKg)}/kg</td>
        <td>${isProductionMachine ? `${formatKg(cap, 0)}<br><small style="color:var(--muted)">${formatKg(dailyCap, 0)}/dia</small>` : `<span class="status-pill blue">Acabamento</span>`}</td>
        <td>${util === null ? "Sem meta" : formatPercent(util)}</td>
      </tr>
    `;
  }).join("") || "";

  return `
    <div class="section-grid">
      <article class="panel span-12 current-tracker">
        <div class="panel-header">
          <div>
            <h2>Produção · plano automático de maio</h2>
            <p>Hoje é ${todayLabel}. Faltam ${daysRemaining} dias para encerrar maio. A produção puxa pela capacidade das duas máquinas e não para por falta de pedidos.</p>
          </div>
          <span class="status-pill blue">Atualizado em ${todayLabel}</span>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard(`Produzido até ${todayLabel}`, formatKg(producedToDateKg, 0), "Corte 1 + Corte 2 nas NFs de maio", "green")}
          ${kpiCard("Capacidade restante", formatKg(remainingMonthCapacity, 0), `${daysRemaining} dias · 16 t/dia produtivas`, "blue")}
          ${kpiCard("Produção automática maio", formatKg(automaticMonthProductionKg, 0), `${formatBRL(automaticMonthProductionValue, 0)} a preço médio de maio`, "amber")}
          ${kpiCard("Venda para absorver", formatKg(totalCommercialGapFullKg, 0), `${formatBRL(totalCommercialGapFullValue, 0)} além da carteira a produzir`, totalCommercialGapFullKg ? "red" : "green")}
        </div>
      </article>

      <article class="panel span-12 backlog-readiness-panel">
        <div class="panel-header">
          <div>
            <h2>PCP · produção puxada x carteira</h2>
            <p>Carteira ativa abatida do estoque pronto mostra a cobertura comercial. O restante da capacidade será produzido automaticamente e precisa ser vendido para não virar estoque.</p>
          </div>
          <span class="status-pill ${totalCommercialGapFullKg ? "red" : ""}">${daysRemaining} dias restantes</span>
        </div>
        <div class="commercial-kpi-grid">
          <article class="commercial-kpi amber"><span>Carteira a produzir</span><strong>${formatKg(totalPcpProduceKg, 0)}</strong><small>${formatBRL(stockAnalysis.totals.produceValue, 0)} após abater estoque acabado</small></article>
          <article class="commercial-kpi blue"><span>Produção restante automática</span><strong>${formatKg(remainingMonthCapacity, 0)}</strong><small>Corte 1 + Corte 2 até 31/05</small></article>
          <article class="commercial-kpi ${totalCommercialGapFullKg ? "red" : "green"}"><span>Comercial precisa vender</span><strong>${formatKg(totalCommercialGapFullKg, 0)}</strong><small>${formatBRL(totalCommercialGapFullValue, 0)} para absorver a produção puxada</small></article>
          <article class="commercial-kpi green"><span>Pronto para faturar</span><strong>${formatKg(stockAnalysis.totals.readyKg, 0)}</strong><small>Já existe em estoque, cobrar expedição/faturamento</small></article>
        </div>
        <div class="inventory-machine-grid" style="margin-top:14px">${pcpCards}</div>
        <div class="data-table-wrap inventory-table">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Máquina</th>
                <th>Produzido até hoje</th>
                <th>Produção restante</th>
                <th>Total automático mês</th>
                <th>Carteira a produzir</th>
                <th>Venda p/ absorver</th>
                <th>Gap p/ 10 dias</th>
                <th>Status PCP</th>
              </tr>
            </thead>
            <tbody>${pcpTableRows}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total produtivo</strong></td>
                <td>${formatKg(producedToDateKg, 0)}</td>
                <td>${formatKg(remainingMonthCapacity, 0)}</td>
                <td>${formatKg(automaticMonthProductionKg, 0)}</td>
                <td>${formatKg(totalPcpProduceKg, 0)}</td>
                <td>${formatKg(totalCommercialGapFullKg, 0)}<br><small>${formatBRL(totalCommercialGapFullValue, 0)}</small></td>
                <td>${formatKg(totalPcpSalesGapKg, 0)}<br><small>${formatBRL(totalPcpSalesGapValue, 0)}</small></td>
                <td>${totalCommercialGapFullKg ? "Vender para não virar estoque" : "Carteira absorve produção"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="stat-stack" style="margin-top:14px">
          <div><span>Acabamento / Rebobinadeira</span><strong>${formatKg(finishingLoad.produceKg, 0)}</strong><small>${finishingLoad.orders.size} pedidos · sem meta produtiva, sequenciar após base pronta.</small></div>
          <div><span>Leitura PCP</span><strong>${totalCommercialGapFullKg ? "Venda insuficiente" : "Carteira suficiente"}</strong><small>A máquina segue produzindo; o risco é gerar estoque sem venda se o comercial não absorver a capacidade restante.</small></div>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Diretriz PCP e comercial</h2>
            <p>Plano curto para ocupar os equipamentos e reduzir ociosidade sem produzir material sem pedido.</p>
          </div>
        </div>
        <div class="priority-grid">${pcpActionRows}</div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Capacidade vs entradas (abril)</h2>
            <p>Meta mensal calculada por dias corridos: Corte 1 = 7 t/dia e Corte 2 = 9 t/dia. Rebobinadeira aparece separada como acabamento.</p>
          </div>
        </div>
        <div class="bar-list">${machineRows}${finishingRow}</div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Produção em NFs de maio</h2>
            <p>Saída por máquina conforme NFs emitidas no mês vigente. Rebobinadeira é acabamento e não entra na meta.</p>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Máquina</th>
                <th>Peso</th>
                <th>Faturamento</th>
                <th>R$/kg</th>
                <th>Capacidade do mês</th>
                <th>Utilização (parcial)</th>
              </tr>
            </thead>
            <tbody>${mayMachineRows}</tbody>
          </table>
        </div>
      </article>

    </div>
  `;
}

function normalizeInventoryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function inventoryColorCatalog(records = []) {
  const fromStock = records.map((row) => row.color).filter(Boolean);
  const fromMix = (data.productMix2026?.items || []).map((row) => row.color).filter(Boolean);
  return [...new Set([...fromStock, ...fromMix].map(normalizeInventoryText))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function inventorySignatureFromText(text, colorCatalog = []) {
  const normalized = normalizeInventoryText(text);
  const lineOptions = ["NTEHH SMS", "NTEH SMS", "BASE VELA", "FLEXNTE", "NTEHH", "NTEH", "NTED", "NTEI", "NTLD", "NTEM", "SLEI", "TNT", "NT", "DS"];
  const line = lineOptions.find((item) => normalized.startsWith(item)) || normalized.split(" ")[0] || "";
  const widthMatch = normalized.match(/(\d{3,4})\s*MM/);
  const gramMatch = normalized.match(/(\d{1,3})\s*GR/);
  const color = colorCatalog.find((candidate) => normalized.includes(candidate)) || "";
  return {
    line,
    widthMm: widthMatch ? Number(widthMatch[1]) : (line === "TNT" ? 1400 : null),
    color,
    grammage: gramMatch ? Number(gramMatch[1]) : null
  };
}

function inventorySignatureFromRecord(row) {
  return {
    line: normalizeInventoryText(row.line),
    widthMm: Number(row.widthMm) || null,
    color: normalizeInventoryText(row.color),
    grammage: Number(row.grammage) || null
  };
}

function inventorySignatureFromMix(row) {
  return {
    line: normalizeInventoryText(row.line),
    widthMm: Number(row.width) || null,
    color: normalizeInventoryText(row.color),
    grammage: Number(row.grammage) || null
  };
}

function inventoryKey(sig, mode = "exact") {
  const line = sig.line || "";
  const width = sig.widthMm || "";
  const color = sig.color || "";
  const grammage = sig.grammage || "";
  if (mode === "noColor") return `${line}|${width}|${grammage}`;
  if (mode === "lineGrammage") return `${line}|${grammage}`;
  if (mode === "line") return line;
  return `${line}|${width}|${color}|${grammage}`;
}

function buildBacklogStockAnalysis(orders, today = getBacklogReferenceDate()) {
  const stockRecords = window.finishedGoodsStock2026?.records || [];
  const colors = inventoryColorCatalog(stockRecords);
  const stockBySku = new Map();

  stockRecords.forEach((row) => {
    const key = inventoryKey(inventorySignatureFromRecord(row));
    const kg = Math.max(Number(row.availableKg) || 0, 0);
    if (!key || !kg) return;
    if (!stockBySku.has(key)) {
      stockBySku.set(key, {
        kg: 0,
        descriptions: new Set(),
        machine: row.machine || "Sem máquina"
      });
    }
    const agg = stockBySku.get(key);
    agg.kg += kg;
    if (row.productName || row.description) agg.descriptions.add(row.productName || row.description);
  });

  const remainingStock = new Map([...stockBySku.entries()].map(([key, value]) => [key, value.kg]));
  const priorityOrders = [...orders].sort((a, b) => {
    const aLate = (a.dataEntrega || "") < today ? 0 : 1;
    const bLate = (b.dataEntrega || "") < today ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    return String(a.dataEntrega || "").localeCompare(String(b.dataEntrega || "")) || Number(a.pedido) - Number(b.pedido);
  });

  const lineMap = new Map();
  const orderMap = new Map();
  const totals = {
    kg: 0,
    value: 0,
    readyKg: 0,
    readyValue: 0,
    produceKg: 0,
    produceValue: 0,
    readyOrders: 0,
    partialOrders: 0,
    produceOrders: 0,
    readyLateOrders: 0,
    readyLateKg: 0,
    readyLateValue: 0
  };

  priorityOrders.forEach((order) => {
    const orderSummary = {
      pedido: order.pedido,
      client: order.cliente,
      status: order.situacao,
      delivery: order.dataEntrega,
      late: (order.dataEntrega || "") < today,
      kg: 0,
      value: 0,
      readyKg: 0,
      readyValue: 0,
      produceKg: 0,
      produceValue: 0,
      lines: []
    };

    (order.linhas || []).forEach((line) => {
      const requiredKg = Number(line.kg) || 0;
      const value = Number(line.valor) || 0;
      const price = requiredKg ? value / requiredKg : 0;
      const sig = inventorySignatureFromText(line.produto, colors);
      const key = inventoryKey(sig);
      const availableBefore = remainingStock.get(key) || 0;
      const readyKg = Math.min(requiredKg, availableBefore);
      const produceKg = Math.max(requiredKg - readyKg, 0);
      const readyValue = readyKg * price;
      const produceValue = produceKg * price;
      remainingStock.set(key, Math.max(availableBefore - readyKg, 0));

      const detail = {
        pedido: order.pedido,
        seq: line.seq,
        produto: line.produto,
        maquina: line.maquina || stockBySku.get(key)?.machine || "Sem máquina",
        key,
        requiredKg,
        value,
        price,
        availableBefore,
        readyKg,
        produceKg,
        readyValue,
        produceValue,
        status: produceKg <= 0 ? "Pronto" : readyKg > 0 ? "Parcial" : "Produzir",
        stockDescription: [...(stockBySku.get(key)?.descriptions || [])][0] || ""
      };
      lineMap.set(`${order.pedido}|${line.seq}`, detail);
      orderSummary.lines.push(detail);
      orderSummary.kg += requiredKg;
      orderSummary.value += value;
      orderSummary.readyKg += readyKg;
      orderSummary.readyValue += readyValue;
      orderSummary.produceKg += produceKg;
      orderSummary.produceValue += produceValue;
    });

    orderSummary.statusStock = orderSummary.produceKg <= 0 ? "Pronto para faturar" : orderSummary.readyKg > 0 ? "Parcial" : "Produzir";
    orderSummary.tone = orderSummary.produceKg <= 0 ? "" : orderSummary.readyKg > 0 ? "amber" : "red";
    orderMap.set(order.pedido, orderSummary);

    totals.kg += orderSummary.kg;
    totals.value += orderSummary.value;
    totals.readyKg += orderSummary.readyKg;
    totals.readyValue += orderSummary.readyValue;
    totals.produceKg += orderSummary.produceKg;
    totals.produceValue += orderSummary.produceValue;
    if (orderSummary.produceKg <= 0) totals.readyOrders += 1;
    else if (orderSummary.readyKg > 0) totals.partialOrders += 1;
    else totals.produceOrders += 1;
    if (orderSummary.late && orderSummary.produceKg <= 0) {
      totals.readyLateOrders += 1;
      totals.readyLateKg += orderSummary.readyKg;
      totals.readyLateValue += orderSummary.readyValue;
    }
  });

  return {
    lineMap,
    orderMap,
    totals,
    readyToBill: [...orderMap.values()]
      .filter((order) => order.produceKg <= 0)
      .sort((a, b) => Number(b.late) - Number(a.late) || String(a.delivery || "").localeCompare(String(b.delivery || ""))),
    needsProduction: [...lineMap.values()]
      .filter((line) => line.produceKg > 0)
      .sort((a, b) => b.produceKg - a.produceKg)
  };
}

function buildGoalSalesFocusData(targetKg = 450000) {
  const aprilSales = salesRecord(2026, 4);
  const avgPriceKg = aprilSales.revenue / aprilSales.weightKg;
  const mayActual = data.currentMayBilling2026 || {};
  const today = getBacklogReferenceDate();
  const carteiraAtivos = (data.carteiraOrders2026 || []).filter((order) => order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada");
  const pipelineOrders = carteiraAtivos.filter((order) => order.dataEntrega && (order.dataEntrega.startsWith("2026-05") || order.dataEntrega < today));
  const sumKg = (orders) => orders.reduce((sum, order) => sum + (Number(order.totalKg) || 0), 0);
  const sumValue = (orders) => orders.reduce((sum, order) => sum + (Number(order.totalValor) || 0), 0);
  const pipelineKg = sumKg(pipelineOrders);
  const pipelineValue = sumValue(pipelineOrders);
  const billedKg = Number(mayActual.weightKg) || 0;
  const billedValue = Number(mayActual.revenue) || 0;
  const coveredKg = billedKg + pipelineKg;
  const missingKg = Math.max(targetKg - coveredKg, 0);
  const billedDays = (mayActual.breakdown || []).length || 7;
  const remainingDays = 14;
  const targetDailyKg = targetKg / 20;
  const currentDailyKg = billedKg / Math.max(billedDays, 1);
  const neededDailyKg = missingKg / Math.max(remainingDays, 1);

  const config = getConfig();
  const machineCapacityKg = config.machineCapacityKg || {};
  const productionMachines = Object.keys(machineCapacityKg).filter((machine) => (Number(machineCapacityKg[machine]) || 0) > 0);
  const stockAnalysis = buildBacklogStockAnalysis(pipelineOrders, today);
  const machineMap = new Map();
  const ensureMachine = (name) => {
    const machine = machineForProductionFocus(name);
    if (!machineMap.has(machine)) {
      machineMap.set(machine, {
        name: machine,
        dailyCapacity: Number(machineCapacityKg[machine]) || 0,
        carteiraKg: 0,
        carteiraValue: 0,
        produceKg: 0,
        produceValue: 0,
        lateKg: 0,
        orders: new Set(),
        produceOrders: new Set(),
        products: new Set()
      });
    }
    return machineMap.get(machine);
  };

  productionMachines.forEach(ensureMachine);
  pipelineOrders.forEach((order) => {
    (order.linhas || []).forEach((line) => {
      const row = ensureMachine(line.maquina);
      const kg = Number(line.kg) || 0;
      row.carteiraKg += kg;
      row.carteiraValue += Number(line.valor) || 0;
      if ((order.dataEntrega || "") < today) row.lateKg += kg;
      row.orders.add(order.pedido);
      if (line.produto) row.products.add(line.produto);
    });
  });

  stockAnalysis.needsProduction.forEach((line) => {
    const row = ensureMachine(line.maquina);
    row.produceKg += line.produceKg || 0;
    row.produceValue += line.produceValue || 0;
    row.produceOrders.add(line.pedido);
    if (line.produto) row.products.add(line.produto);
  });

  const rawRows = [...machineMap.values()]
    .filter((row) => row.dailyCapacity > 0 || row.carteiraKg > 0 || row.produceKg > 0)
    .map((row) => {
      const remainingCapacityKg = row.dailyCapacity * remainingDays;
      const daysNeeded = row.dailyCapacity ? row.produceKg / row.dailyCapacity : 0;
      const capacityGapKg = remainingCapacityKg - row.produceKg;
      return {
        ...row,
        ordersCount: row.orders.size,
        produceOrdersCount: row.produceOrders.size,
        productCount: row.products.size,
        sampleProducts: [...row.products].slice(0, 4),
        remainingCapacityKg,
        daysNeeded,
        openCapacityKg: Math.max(capacityGapKg, 0),
        overloadKg: Math.max(-capacityGapKg, 0)
      };
    });

  const totalOpenCapacityKg = rawRows.reduce((sum, row) => sum + (row.dailyCapacity > 0 ? row.openCapacityKg : 0), 0);
  const machineRows = rawRows.map((row) => {
    const captureTargetKg = missingKg > 0 && totalOpenCapacityKg > 0 && row.dailyCapacity > 0
      ? Math.min(row.openCapacityKg, missingKg * (row.openCapacityKg / totalOpenCapacityKg))
      : 0;
    const status = row.overloadKg > 0
      ? "Sobrecarga"
      : captureTargetKg > 0
        ? "Captar para meta"
        : row.produceKg > 0
          ? "Produzir carteira"
          : "Sem pressão";
    const action = row.overloadKg > 0
      ? "Evitar promessa curta nesta máquina; vender com prazo maior e proteger pedidos já em carteira."
      : captureTargetKg > 0
        ? `Priorizar captação de produtos desta máquina: ${formatKg(captureTargetKg, 0)} para usar a folga produtiva.`
        : row.produceKg > 0
          ? "Converter e acompanhar carteira atual; foco menor em captação adicional."
          : "Sem foco comercial imediato.";
    return {
      ...row,
      captureTargetKg,
      captureTargetValue: captureTargetKg * avgPriceKg,
      status,
      action
    };
  }).sort((a, b) => b.overloadKg - a.overloadKg || b.captureTargetKg - a.captureTargetKg || b.produceKg - a.produceKg);

  const captureAllocatedKg = machineRows.reduce((sum, row) => sum + row.captureTargetKg, 0);
  const weekGroups = buildBacklogDeliveryBuckets(today).map((bucket) => {
    const orders = pipelineOrders.filter(bucket.filter);
    return { ...bucket, orders, count: orders.length, kg: sumKg(orders), value: sumValue(orders) };
  }).filter((bucket) => bucket.count);

  const topOrders = [...pipelineOrders]
    .sort((a, b) => (Number(b.totalValor) || 0) - (Number(a.totalValor) || 0))
    .slice(0, 8);

  return {
    targetKg,
    avgPriceKg,
    today,
    mayActual,
    billedKg,
    billedValue,
    billedDays,
    pipelineOrders,
    pipelineKg,
    pipelineValue,
    coveredKg,
    missingKg,
    targetDailyKg,
    currentDailyKg,
    neededDailyKg,
    remainingDays,
    machineRows,
    captureAllocatedKg,
    unallocatedCaptureKg: Math.max(missingKg - captureAllocatedKg, 0),
    stockAnalysis,
    weekGroups,
    topOrders
  };
}

function exportGoalsSalesPdf() {
  const report = buildGoalSalesFocusData(450000);
  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const logoUrl = new URL("./assets/spunflex-logo.png", window.location.href).href;
  const refDate = new Date(report.today + "T12:00:00").toLocaleDateString("pt-BR");
  const periodStart = report.mayActual.startDate ? formatIsoShort(report.mayActual.startDate) : "";
  const periodEnd = report.mayActual.endDate ? formatIsoShort(report.mayActual.endDate) : "";
  const machineRows = report.machineRows.map((row) => {
    const products = row.sampleProducts.length
      ? `${row.productCount} produto${row.productCount !== 1 ? "s" : ""}: ${row.sampleProducts.map((product) => escapeHtml(product)).join(", ")}${row.productCount > 4 ? "..." : ""}`
      : "Sem produto mapeado";
    const gapText = row.overloadKg > 0 ? `Sobrecarga ${formatKg(row.overloadKg, 0)}` : `Folga ${formatKg(row.openCapacityKg, 0)}`;
    return `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong><small>${products}</small></td>
        <td>${row.dailyCapacity ? `${formatKg(row.dailyCapacity, 0)}/dia` : "Sem meta"}</td>
        <td>${formatKg(row.carteiraKg, 0)}<small>${row.ordersCount} pedido${row.ordersCount !== 1 ? "s" : ""}</small></td>
        <td>${formatKg(row.produceKg, 0)}<small>${row.daysNeeded.toFixed(1).replace(".", ",")} dias</small></td>
        <td>${escapeHtml(gapText)}</td>
        <td>${row.captureTargetKg ? `${formatKg(row.captureTargetKg, 0)}<small>${formatBRL(row.captureTargetValue, 0)}</small>` : "-"}</td>
        <td><span class="pill ${row.overloadKg > 0 ? "red" : row.captureTargetKg > 0 ? "amber" : "green"}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(row.action)}</td>
      </tr>
    `;
  }).join("");

  const actionCards = report.machineRows.map((row, index) => `
    <article class="action-card ${row.overloadKg > 0 ? "red" : row.captureTargetKg > 0 ? "amber" : "green"}">
      <span>Prioridade ${index + 1}</span>
      <h2>${escapeHtml(row.name)}</h2>
      <strong>${row.captureTargetKg ? formatKg(row.captureTargetKg, 0) : row.overloadKg ? `Segurar ${formatKg(row.overloadKg, 0)}` : formatKg(row.produceKg, 0)}</strong>
      <p>${escapeHtml(row.action)}</p>
    </article>
  `).join("");

  const weekRows = report.weekGroups.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.label)}</strong></td>
      <td>${row.count}</td>
      <td>${formatKg(row.kg, 0)}</td>
      <td>${formatBRL(row.value, 0)}</td>
    </tr>
  `).join("");

  const orderRows = report.topOrders.map((order) => {
    const delivery = order.dataEntrega ? formatIsoShort(order.dataEntrega) : "-";
    const products = (order.linhas || []).slice(0, 3).map((line) => line.produto).filter(Boolean).join(", ");
    return `
      <tr>
        <td><strong>${escapeHtml(order.pedido)}</strong></td>
        <td><strong>${escapeHtml(order.cliente || "-")}</strong><small>${escapeHtml(order.representante || "-")}</small></td>
        <td>${escapeHtml(delivery)}</td>
        <td>${formatKg(Number(order.totalKg) || 0, 0)}</td>
        <td>${formatBRL(Number(order.totalValor) || 0, 0)}</td>
        <td>${escapeHtml(products || "-")}</td>
      </tr>
    `;
  }).join("");

  const reportHtml = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Meta maio - foco comercial por máquina</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin:0; color:#1f2937; background:#fff; font-family:Arial, Helvetica, sans-serif; font-size:10px; line-height:1.35; }
          header { display:flex; align-items:center; justify-content:space-between; gap:18px; padding-bottom:10px; border-bottom:2px solid #0ea5c6; }
          .brand { display:flex; align-items:center; gap:12px; }
          .brand img { width:118px; height:auto; object-fit:contain; }
          h1,h2,p { margin:0; }
          h1 { color:#111827; font-size:22px; line-height:1.05; }
          h2 { color:#111827; font-size:13px; }
          small { display:block; color:#6b7280; font-size:9px; line-height:1.25; margin-top:2px; }
          .meta { text-align:right; color:#4b5563; }
          .summary { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:12px 0; }
          .metric, .action-card { padding:8px 10px; border:1px solid #d1d5db; border-top:4px solid #0ea5c6; border-radius:6px; break-inside:avoid; }
          .metric.green, .action-card.green { border-top-color:#16a34a; }
          .metric.amber, .action-card.amber { border-top-color:#d97706; }
          .metric.red, .action-card.red { border-top-color:#dc2626; }
          .metric span, .action-card span { display:block; color:#6b7280; font-size:8px; font-weight:700; text-transform:uppercase; }
          .metric strong, .action-card strong { display:block; margin-top:4px; color:#111827; font-size:14px; }
          .actions { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:10px 0 12px; }
          .action-card p { margin-top:5px; color:#374151; }
          table { width:100%; border-collapse:collapse; margin-top:8px; }
          th { background:#e8f7fb; color:#111827; font-size:8px; text-align:left; text-transform:uppercase; }
          th,td { padding:5px 6px; border:1px solid #d1d5db; vertical-align:top; }
          td:nth-child(2), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7) { white-space:nowrap; }
          .pill { display:inline-block; padding:2px 6px; border-radius:999px; font-size:8px; font-weight:700; white-space:nowrap; }
          .pill.green { background:#dcfce7; color:#166534; }
          .pill.amber { background:#fef3c7; color:#92400e; }
          .pill.red { background:#fee2e2; color:#991b1b; }
          .grid-2 { display:grid; grid-template-columns:1fr 1.45fr; gap:10px; align-items:start; margin-top:12px; }
          .toolbar { position:sticky; top:0; display:flex; justify-content:flex-end; padding:8px 0; background:#fff; z-index:5; }
          .toolbar button { border:1px solid #0ea5c6; border-radius:6px; background:#0ea5c6; color:#fff; font-weight:700; padding:7px 12px; cursor:pointer; }
          @media print { .toolbar { display:none; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>
        <header>
          <div class="brand">
            <img src="${logoUrl}" alt="Spunflex">
            <div>
              <h1>Meta maio - plano comercial por máquina</h1>
              <small>Relatório para orientar o time de vendas sobre onde captar pedidos para fechar a meta. Rebobinadeira/acabamento alocada em Corte 1.</small>
            </div>
          </div>
          <div class="meta">
            <strong>Carteira ref. ${escapeHtml(refDate)}</strong>
            <small>Faturamento ${escapeHtml(periodStart)}-${escapeHtml(periodEnd)} · gerado em ${escapeHtml(generatedAt)}</small>
          </div>
        </header>

        <section class="summary">
          <article class="metric green"><span>Meta maio</span><strong>${formatKg(report.targetKg, 0)}</strong></article>
          <article class="metric"><span>Faturado</span><strong>${formatKg(report.billedKg, 0)}</strong><small>${formatBRL(report.billedValue, 0)}</small></article>
          <article class="metric amber"><span>Carteira maio</span><strong>${formatKg(report.pipelineKg, 0)}</strong><small>${formatBRL(report.pipelineValue, 0)}</small></article>
          <article class="metric ${report.missingKg ? "red" : "green"}"><span>Falta captar</span><strong>${report.missingKg ? formatKg(report.missingKg, 0) : "Meta coberta"}</strong></article>
          <article class="metric"><span>Ritmo necessário</span><strong>${formatKg(report.neededDailyKg, 0)}/dia</strong><small>${report.remainingDays} dias úteis</small></article>
          <article class="metric"><span>Captável nas máquinas</span><strong>${formatKg(report.captureAllocatedKg, 0)}</strong><small>${report.unallocatedCaptureKg ? `${formatKg(report.unallocatedCaptureKg, 0)} fora da folga` : "dentro da folga"}</small></article>
        </section>

        <section class="actions">
          ${actionCards}
        </section>

        <h2>Foco por máquina</h2>
        <table>
          <thead>
            <tr>
              <th>Máquina / produtos</th>
              <th>Capacidade</th>
              <th>Carteira maio</th>
              <th>A produzir</th>
              <th>Folga</th>
              <th>Captar p/ meta</th>
              <th>Status</th>
              <th>Ação para vendas</th>
            </tr>
          </thead>
          <tbody>${machineRows}</tbody>
        </table>

        <section class="grid-2">
          <div>
            <h2>Carteira por prazo</h2>
            <table>
              <thead><tr><th>Prazo</th><th>Pedidos</th><th>Peso</th><th>Valor</th></tr></thead>
              <tbody>${weekRows}</tbody>
            </table>
          </div>
          <div>
            <h2>Maiores pedidos em carteira para conversão</h2>
            <table>
              <thead><tr><th>Pedido</th><th>Cliente / rep</th><th>Entrega</th><th>Peso</th><th>Valor</th><th>Produtos</th></tr></thead>
              <tbody>${orderRows}</tbody>
            </table>
          </div>
        </section>
      </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("Pop-up bloqueado", "Permita pop-ups para abrir o relatório de metas.", "warning", 5000);
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(displayMachineLabels(reportHtml));
  reportWindow.document.close();
  reportWindow.focus();
  showToast("Relatório pronto", "A janela de impressão foi aberta. Use Salvar como PDF.", "success", 3200);
  setTimeout(() => reportWindow.print(), 700);
}

function exportLateBacklogPdf() {
  const today = getBacklogReferenceDate();
  const todayD = new Date(today + "T12:00:00");
  const allOrders = data.carteiraOrders2026 || [];
  const isFaturado = (order) => order.situacao === "Nota Gerada";
  const isCancelado = (order) => order.situacao === "Cancelado";
  const isAtivo = (order) => !isFaturado(order) && !isCancelado(order);
  const isAtrasado = (order) => isAtivo(order) && order.dataEntrega < today;
  const ativos = allOrders.filter(isAtivo);
  const atrasados = ativos
    .filter(isAtrasado)
    .sort((a, b) => String(a.dataEntrega || "").localeCompare(String(b.dataEntrega || "")) || Number(a.pedido) - Number(b.pedido));

  if (!atrasados.length) {
    showToast("Sem atrasados", "Não há pedidos atrasados para exportar.", "success", 2400);
    return;
  }

  const stockAnalysis = buildBacklogStockAnalysis(ativos, today);
  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const refDateLabel = todayD.toLocaleDateString("pt-BR");
  const logoUrl = new URL("./assets/spunflex-logo.png", window.location.href).href;
  const totals = atrasados.reduce((acc, order) => {
    acc.value += Number(order.totalValor) || 0;
    acc.kg += Number(order.totalKg) || 0;
    return acc;
  }, { value: 0, kg: 0 });

  const summaries = atrasados.map((order) => {
    const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00") : null;
    const delayDays = delivery ? Math.max(0, Math.round((todayD - delivery) / 86400000)) : 0;
    const stock = stockAnalysis.orderMap.get(order.pedido);
    const priority = stock?.produceKg <= 0 ? 1 : stock?.readyKg > 0 ? 2 : 3;
    const action = priority === 1
      ? "Separar, validar romaneio/faturamento e expedir."
      : priority === 2
        ? "Separar itens prontos e cobrar saldo pendente da produção."
        : "Cobrar produção antes de programar expedição.";
    const priorityLabel = priority === 1 ? "Pronto" : priority === 2 ? "Parcial" : "Produzir";
    return { order, stock, delayDays, priority, priorityLabel, action };
  }).sort((a, b) => a.priority - b.priority || b.delayDays - a.delayDays || (Number(b.order.totalValor) || 0) - (Number(a.order.totalValor) || 0));

  const priorityGroups = [
    { title: "Prioridade 1 · Prontos para expedição/faturamento", items: summaries.filter((item) => item.priority === 1), tone: "ready" },
    { title: "Prioridade 2 · Parciais, separar o pronto e cobrar saldo", items: summaries.filter((item) => item.priority === 2), tone: "partial" },
    { title: "Prioridade 3 · Dependem de produção antes da expedição", items: summaries.filter((item) => item.priority === 3), tone: "produce" }
  ];

  const groupTotal = (items) => items.reduce((acc, item) => {
    acc.value += Number(item.order.totalValor) || 0;
    acc.kg += Number(item.order.totalKg) || 0;
    acc.readyKg += Number(item.stock?.readyKg) || 0;
    acc.produceKg += Number(item.stock?.produceKg) || 0;
    return acc;
  }, { value: 0, kg: 0, readyKg: 0, produceKg: 0 });

  const summaryRows = summaries.map(({ order, stock, delayDays, priorityLabel, action, priority }) => {
    const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR") : "-";
    const location = `${order.cidade || "-"} / ${order.estado || "-"}`;
    return `
      <tr>
        <td><strong>${escapeHtml(order.pedido)}</strong></td>
        <td>
          <strong>${escapeHtml(order.cliente || "-")}</strong>
          <small>${escapeHtml(location)} · ${escapeHtml(order.representante || "-")}</small>
        </td>
        <td>${escapeHtml(delivery)}<small>${delayDays} dia${delayDays === 1 ? "" : "s"} atraso</small></td>
        <td>${formatKg(Number(order.totalKg) || 0, 0)}</td>
        <td>${formatBRL(Number(order.totalValor) || 0, 0)}</td>
        <td><span class="pill ${priority === 1 ? "ready" : priority === 2 ? "partial" : "produce"}">${priorityLabel}</span></td>
        <td>
          ${formatKg(Number(stock?.readyKg) || 0, 0)}
          <small>Produzir ${formatKg(Number(stock?.produceKg) || 0, 0)}</small>
        </td>
        <td>${escapeHtml(action)}</td>
      </tr>
    `;
  }).join("");

  const orderCards = priorityGroups.map((group) => {
    if (!group.items.length) return "";
    const total = groupTotal(group.items);
    const cards = group.items.map(({ order, stock, delayDays, action, priority }) => {
      const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR") : "-";
      const location = `${order.cidade || "-"} / ${order.estado || "-"}`;
      const lines = (order.linhas || []).map((line) => {
        const detail = stockAnalysis.lineMap.get(`${order.pedido}|${line.seq}`);
        const lineTone = detail?.produceKg <= 0 ? "ready" : detail?.readyKg > 0 ? "partial" : "produce";
        return `
          <tr>
            <td>${escapeHtml(line.seq || "-")}</td>
            <td>
              <strong>${escapeHtml(line.produto || "-")}</strong>
              <small>${escapeHtml(detail?.maquina || line.maquina || "-")}</small>
            </td>
            <td>${formatKg(Number(line.kg) || 0, 1)}</td>
            <td>${formatKg(Number(detail?.readyKg) || 0, 1)}</td>
            <td>${formatKg(Number(detail?.produceKg) || 0, 1)}</td>
            <td><span class="pill ${lineTone}">${escapeHtml(detail?.status || "Sem estoque")}</span></td>
          </tr>
        `;
      }).join("");

      return `
        <section class="order-card ${priority === 1 ? "ready" : priority === 2 ? "partial" : "produce"}">
          <div class="order-head">
            <div>
              <h3>Pedido ${escapeHtml(order.pedido)} · ${escapeHtml(order.cliente || "-")}</h3>
              <p>${escapeHtml(location)} · Rep. ${escapeHtml(order.representante || "-")}</p>
            </div>
            <div class="order-meta">
              <strong>${escapeHtml(delivery)}</strong>
              <span>${delayDays} dia${delayDays === 1 ? "" : "s"} atraso</span>
            </div>
          </div>
          <dl class="order-facts">
            <div><dt>Peso</dt><dd>${formatKg(Number(order.totalKg) || 0, 0)}</dd></div>
            <div><dt>Valor</dt><dd>${formatBRL(Number(order.totalValor) || 0, 0)}</dd></div>
            <div><dt>Pronto</dt><dd>${formatKg(Number(stock?.readyKg) || 0, 0)}</dd></div>
            <div><dt>Produzir</dt><dd>${formatKg(Number(stock?.produceKg) || 0, 0)}</dd></div>
            <div><dt>Situação</dt><dd>${escapeHtml(order.situacao || "-")}</dd></div>
            <div><dt>Frete/Pgto</dt><dd>${escapeHtml(order.frete || "-")} · ${escapeHtml(order.condicaoPgto || "-")}</dd></div>
          </dl>
          <div class="action-box"><strong>Ação da expedição:</strong> ${escapeHtml(action)}</div>
          <table class="line-table">
            <thead>
              <tr>
                <th>Seq.</th>
                <th>Produto</th>
                <th>Pedido</th>
                <th>Pronto</th>
                <th>Produzir</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
        </section>
      `;
    }).join("");

    return `
      <section class="priority-block ${group.tone}">
        <div class="priority-head">
          <h2>${escapeHtml(group.title)}</h2>
          <span>${group.items.length} pedido${group.items.length === 1 ? "" : "s"} · ${formatKg(total.kg, 0)} · ${formatBRL(total.value, 0)} · pronto ${formatKg(total.readyKg, 0)} · produzir ${formatKg(total.produceKg, 0)}</span>
        </div>
        ${cards}
      </section>
    `;
  }).join("");

  const reportHtml = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Pedidos atrasados · Expedição</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #1f2937;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.35;
          }
          header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding-bottom: 10px;
            border-bottom: 2px solid #0ea5c6;
          }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 118px; height: auto; object-fit: contain; }
          h1, h2, h3, p { margin: 0; }
          h1 { color: #111827; font-size: 22px; line-height: 1.05; }
          h2 { color: #111827; font-size: 15px; }
          h3 { color: #111827; font-size: 13px; }
          small { display: block; color: #6b7280; font-size: 10px; }
          .meta { text-align: right; color: #4b5563; }
          .summary {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin: 12px 0;
          }
          .metric {
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-top: 4px solid #0ea5c6;
            border-radius: 6px;
            break-inside: avoid;
          }
          .metric.red { border-top-color: #dc2626; }
          .metric.amber { border-top-color: #d97706; }
          .metric.green { border-top-color: #16a34a; }
          .metric span { display: block; color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .metric strong { display: block; margin-top: 4px; color: #111827; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; }
          th {
            background: #e8f7fb;
            color: #111827;
            font-size: 9px;
            text-align: left;
            text-transform: uppercase;
          }
          th, td { padding: 5px 6px; border: 1px solid #d1d5db; vertical-align: top; }
          td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(7) { white-space: nowrap; }
          .summary-table { margin: 10px 0 14px; }
          .pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 999px;
            color: #111827;
            font-size: 9px;
            font-weight: 700;
            white-space: nowrap;
          }
          .pill.ready { background: #dcfce7; color: #166534; }
          .pill.partial { background: #fef3c7; color: #92400e; }
          .pill.produce { background: #fee2e2; color: #991b1b; }
          .priority-block { margin-top: 12px; break-inside: avoid; }
          .priority-head {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            padding: 7px 9px;
            border-radius: 6px 6px 0 0;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-bottom: none;
          }
          .priority-head span { color: #4b5563; font-weight: 700; }
          .priority-block.ready .priority-head { background: #ecfdf5; }
          .priority-block.partial .priority-head { background: #fffbeb; }
          .priority-block.produce .priority-head { background: #fef2f2; }
          .order-card {
            padding: 9px;
            border: 1px solid #d1d5db;
            border-left: 5px solid #0ea5c6;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .order-card + .order-card { margin-top: 8px; }
          .order-card.ready { border-left-color: #16a34a; }
          .order-card.partial { border-left-color: #d97706; }
          .order-card.produce { border-left-color: #dc2626; }
          .order-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
          }
          .order-head p { color: #4b5563; font-size: 10px; margin-top: 2px; }
          .order-meta { text-align: right; }
          .order-meta strong { display: block; font-size: 13px; color: #111827; }
          .order-meta span { color: #dc2626; font-weight: 700; }
          .order-facts {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin: 0 0 8px;
          }
          .order-facts div {
            padding: 5px 6px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
          }
          dt { color: #6b7280; font-size: 8px; font-weight: 700; text-transform: uppercase; }
          dd { margin: 2px 0 0; color: #111827; font-weight: 700; }
          .action-box {
            margin-bottom: 8px;
            padding: 7px 9px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 5px;
            color: #1e3a8a;
            font-size: 11px;
          }
          .line-table th, .line-table td { padding: 4px 6px; }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 5;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 8px 0;
            background: #fff;
          }
          .toolbar button {
            border: 1px solid #0ea5c6;
            border-radius: 6px;
            background: #0ea5c6;
            color: #fff;
            font-weight: 700;
            padding: 7px 12px;
            cursor: pointer;
          }
          @media print {
            .toolbar { display: none; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>
        <header>
          <div class="brand">
            <img src="${logoUrl}" alt="Spunflex">
            <div>
              <h1>Pedidos atrasados para expedição</h1>
              <small>Relatório operacional para foco nos pedidos vencidos da carteira</small>
            </div>
          </div>
          <div class="meta">
            <strong>Referência: ${escapeHtml(refDateLabel)}</strong>
            <small>Gerado em ${escapeHtml(generatedAt)}</small>
          </div>
        </header>
        <section class="summary">
          <article class="metric red"><span>Pedidos atrasados</span><strong>${atrasados.length}</strong></article>
          <article class="metric"><span>Peso total</span><strong>${formatKg(totals.kg, 0)}</strong></article>
          <article class="metric"><span>Valor total</span><strong>${formatBRL(totals.value, 0)}</strong></article>
          <article class="metric green"><span>Prontos</span><strong>${priorityGroups[0].items.length}</strong></article>
          <article class="metric amber"><span>Parciais / produzir</span><strong>${priorityGroups[1].items.length + priorityGroups[2].items.length}</strong></article>
        </section>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente / Representante</th>
              <th>Entrega</th>
              <th>Peso</th>
              <th>Valor</th>
              <th>Status estoque</th>
              <th>Pronto</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
        ${orderCards}
      </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("Pop-up bloqueado", "Permita pop-ups para abrir o relatório em PDF.", "warning", 5000);
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(displayMachineLabels(reportHtml));
  reportWindow.document.close();
  reportWindow.focus();
  showToast("Relatório pronto", "A janela de impressão foi aberta. Use Salvar como PDF.", "success", 3200);
  setTimeout(() => {
    reportWindow.print();
  }, 700);
}

function renderInventory() {
  const stockPayload = window.finishedGoodsStock2026 || { records: [] };
  const stockRecords = stockPayload.records || [];
  if (!stockRecords.length) {
    return `
      <div class="section-grid">
        <article class="panel span-12">
          <div class="empty-state">Nenhum arquivo de estoque carregado. Gere a base stock-data.js a partir da planilha de estoque.</div>
        </article>
      </div>
    `;
  }

  const colors = inventoryColorCatalog(stockRecords);
  const activeOrders = (data.carteiraOrders2026 || []).filter((order) => order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada");
  const productMix = data.productMix2026?.items || [];
  const globalAvgPrice = data.mayInvoices2026?.totals?.avgPrice || (data.currentMayBilling2026.revenue / data.currentMayBilling2026.weightKg);
  const filters = state.inventoryFilters || {};
  const commercialProfileFor = (row) => {
    const text = `${row.segment || ""} ${row.line || ""} ${row.description || ""} ${row.className || ""}`.toUpperCase();
    if (/(HIGI|MEDICAL|HOSPITALAR|HFL|SMS)/.test(text)) return "Higiênico / medical";
    if (/(COLCH|ESTOF|MOLA)/.test(text)) return "Colchão / estofados";
    if (/(CONSTRU|INDUSTRIAL|AGRO)/.test(text)) return "Construção / industrial";
    if (/(MOVELEIRO|EMBALAGEM)/.test(text)) return "Moveleiro / embalagem";
    if (/(VELA|TNT|FLEXNTE|BASE VELA)/.test(text)) return "Distribuição / pronta entrega";
    if (/(DISTRIB)/.test(text)) return "Distribuidores / revenda";
    return "Outros clientes";
  };
  const weightedMaps = { exact: new Map(), noColor: new Map(), lineGrammage: new Map(), line: new Map() };

  const addWeighted = (map, key, kg, value) => {
    if (!key || !kg || !value) return;
    if (!map.has(key)) map.set(key, { kg: 0, value: 0 });
    const agg = map.get(key);
    agg.kg += kg;
    agg.value += value;
  };

  productMix.forEach((item) => {
    const sig = inventorySignatureFromMix(item);
    addWeighted(weightedMaps.exact, inventoryKey(sig), item.weightKg, item.revenue);
    addWeighted(weightedMaps.noColor, inventoryKey(sig, "noColor"), item.weightKg, item.revenue);
    addWeighted(weightedMaps.lineGrammage, inventoryKey(sig, "lineGrammage"), item.weightKg, item.revenue);
    addWeighted(weightedMaps.line, inventoryKey(sig, "line"), item.weightKg, item.revenue);
  });

  const avgFromMap = (map, key) => {
    const row = map.get(key);
    return row?.kg ? row.value / row.kg : null;
  };
  const priceFor = (sig) => {
    const exact = avgFromMap(weightedMaps.exact, inventoryKey(sig));
    if (exact) return { price: exact, source: "SKU vendido em maio" };
    const noColor = avgFromMap(weightedMaps.noColor, inventoryKey(sig, "noColor"));
    if (noColor) return { price: noColor, source: "linha/largura/gramatura" };
    const lineGrammage = avgFromMap(weightedMaps.lineGrammage, inventoryKey(sig, "lineGrammage"));
    if (lineGrammage) return { price: lineGrammage, source: "linha/gramatura" };
    const line = avgFromMap(weightedMaps.line, inventoryKey(sig, "line"));
    if (line) return { price: line, source: "média da linha" };
    return { price: globalAvgPrice, source: "média geral maio" };
  };

  const demandBySku = new Map();
  const demandByMachine = new Map();
  activeOrders.forEach((order) => {
    (order.linhas || []).forEach((line) => {
      const sig = inventorySignatureFromText(line.produto, colors);
      const kg = Number(line.kg) || 0;
      demandBySku.set(inventoryKey(sig), (demandBySku.get(inventoryKey(sig)) || 0) + kg);
      const machine = line.maquina || "Sem máquina";
      demandByMachine.set(machine, (demandByMachine.get(machine) || 0) + kg);
    });
  });

  const soldBySku = new Map();
  productMix.forEach((item) => {
    const key = inventoryKey(inventorySignatureFromMix(item));
    soldBySku.set(key, (soldBySku.get(key) || 0) + (Number(item.weightKg) || 0));
  });

  const grouped = new Map();
  stockRecords.forEach((row) => {
    const sig = inventorySignatureFromRecord(row);
    const skuKey = inventoryKey(sig);
    const key = `${skuKey}|${row.machine || "Sem máquina"}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        skuKey,
        sig,
        line: row.line || sig.line,
        widthMm: row.widthMm,
        color: row.color || sig.color,
        grammage: row.grammage,
        machine: row.machine || "Sem máquina",
        segment: row.segment || "-",
        className: row.className || "-",
        currentKg: 0,
        availableKg: 0,
        pieces: 0,
        descriptions: new Set(),
        productCodes: new Set(),
        needsRefile: false
      });
    }
    const agg = grouped.get(key);
    agg.currentKg += Number(row.currentKg) || 0;
    agg.availableKg += Number(row.availableKg) || 0;
    agg.pieces += Number(row.pieces) || 0;
    agg.needsRefile = agg.needsRefile || Boolean(row.needsRefile);
    if (row.productName || row.description) agg.descriptions.add(row.productName || row.description);
    if (row.productCode) agg.productCodes.add(row.productCode);
  });

  const stockRows = [...grouped.values()].map((row) => {
    const pricing = priceFor(row.sig);
    const availablePositive = Math.max(row.availableKg, 0);
    const demandKg = demandBySku.get(row.skuKey) || 0;
    const soldMayKg = soldBySku.get(row.skuKey) || 0;
    const surplusKg = row.availableKg - demandKg;
    const value = availablePositive * pricing.price;
    let status = "Sem venda";
    let tone = "red";
    if (row.availableKg < 0) {
      status = "Disponível negativo";
    } else if (demandKg > 0 && surplusKg >= 0) {
      status = "Cobre carteira";
      tone = "";
    } else if (demandKg > 0 && surplusKg < 0) {
      status = "Falta estoque";
      tone = "amber";
    } else if (soldMayKg > 0) {
      status = "Giro sem carteira";
      tone = "blue";
    }
    return {
      ...row,
      price: pricing.price,
      priceSource: pricing.source,
      availablePositive,
      demandKg,
      soldMayKg,
      surplusKg,
      value,
      status,
      tone,
      productCode: [...row.productCodes][0] || "",
      description: [...row.descriptions][0] || `${row.line} ${row.widthMm || ""}MM ${row.color} ${row.grammage || ""}GR`,
      clientProfile: commercialProfileFor(row)
    };
  });

  const totals = stockRows.reduce((acc, row) => {
    acc.currentKg += row.currentKg;
    acc.availableKg += row.availablePositive;
    acc.rawAvailableKg += row.availableKg;
    acc.value += row.value;
    acc.demandKg += row.demandKg;
    acc.soldMayKg += row.soldMayKg;
    if (row.availableKg < 0) acc.negativeKg += Math.abs(row.availableKg);
    if (row.demandKg <= 0 && row.availablePositive > 0) acc.noDemandSkus += 1;
    if (row.demandKg <= 0 && row.soldMayKg <= 0 && row.availablePositive > 0) {
      acc.noMovementSkus += 1;
      acc.noMovementKg += row.availablePositive;
      acc.noMovementValue += row.value;
    }
    return acc;
  }, { currentKg: 0, availableKg: 0, rawAvailableKg: 0, value: 0, demandKg: 0, soldMayKg: 0, negativeKg: 0, noDemandSkus: 0, noMovementSkus: 0, noMovementKg: 0, noMovementValue: 0 });

  const machineMap = new Map();
  stockRows.forEach((row) => {
    const key = row.machine || "Sem máquina";
    if (!machineMap.has(key)) machineMap.set(key, { machine: key, stockKg: 0, stockValue: 0, skus: 0, demandKg: 0, negativeKg: 0 });
    const agg = machineMap.get(key);
    agg.stockKg += row.availablePositive;
    agg.stockValue += row.value;
    agg.skus += 1;
    if (row.availableKg < 0) agg.negativeKg += Math.abs(row.availableKg);
  });
  demandByMachine.forEach((kg, machine) => {
    if (!machineMap.has(machine)) machineMap.set(machine, { machine, stockKg: 0, stockValue: 0, skus: 0, demandKg: 0, negativeKg: 0 });
    machineMap.get(machine).demandKg += kg;
  });
  const machineRows = [...machineMap.values()].sort((a, b) => b.stockKg - a.stockKg);

  const noMovementAll = stockRows
    .filter((row) => row.availablePositive > 0 && row.demandKg <= 0 && row.soldMayKg <= 0)
    .sort((a, b) => b.value - a.value);
  const optionValues = (rows, key, numeric = false) => {
    const values = [...new Set(rows.map((row) => row[key]).filter((value) => value !== undefined && value !== null && value !== "" && value !== "-"))];
    return values.sort((a, b) => numeric ? Number(a) - Number(b) : String(a).localeCompare(String(b), "pt-BR"));
  };
  const selectOptions = (values, selected, formatter = (value) => value) => values.map((value) => {
    const normalized = String(value);
    return `<option value="${escapeHtml(normalized)}" ${String(selected) === normalized ? "selected" : ""}>${escapeHtml(formatter(value))}</option>`;
  }).join("");
  const noMovementFiltered = noMovementAll.filter((row) => {
    const query = (filters.query || "").trim().toLowerCase();
    const minKg = Number(String(filters.minKg || "").replace(",", "."));
    const haystack = [
      row.description,
      row.line,
      row.color,
      row.segment,
      row.clientProfile,
      row.machine,
      row.grammage,
      row.widthMm
    ].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) &&
      (!filters.line || filters.line === "all" || row.line === filters.line) &&
      (!filters.width || filters.width === "all" || String(row.widthMm) === String(filters.width)) &&
      (!filters.grammage || filters.grammage === "all" || String(row.grammage) === String(filters.grammage)) &&
      (!filters.color || filters.color === "all" || row.color === filters.color) &&
      (!filters.profile || filters.profile === "all" || row.clientProfile === filters.profile) &&
      (!filters.machine || filters.machine === "all" || row.machine === filters.machine) &&
      (!Number.isFinite(minKg) || minKg <= 0 || row.availablePositive >= minKg);
  });
  const noMovementFilteredTotals = noMovementFiltered.reduce((acc, row) => {
    acc.kg += row.availablePositive;
    acc.value += row.value;
    acc.pieces += row.pieces || 0;
    acc.skus += 1;
    return acc;
  }, { kg: 0, value: 0, pieces: 0, skus: 0 });
  const groupNoMovement = (rows, keyFn, labelFn = (value) => value) => {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row) || "Sem classificação";
      if (!map.has(key)) map.set(key, { key, label: labelFn(key), kg: 0, value: 0, skus: 0 });
      const agg = map.get(key);
      agg.kg += row.availablePositive;
      agg.value += row.value;
      agg.skus += 1;
    });
    return [...map.values()].sort((a, b) => b.kg - a.kg);
  };
  const movementBarList = (rows, totalKg, fillClass = "") => rows.map((row) => {
    const width = totalKg ? Math.max(2, Math.round((row.kg / totalKg) * 100)) : 0;
    return `
      <div class="bar-row">
        <div class="bar-label"><strong>${escapeHtml(row.label)}</strong><br><small>${row.skus} SKU${row.skus > 1 ? "s" : ""} · ${formatBRL(row.value, 0)}</small></div>
        <div class="bar-track"><div class="bar-fill ${fillClass}" style="width:${width}%"></div></div>
        <div class="bar-value">${formatKg(row.kg, 0)}<br><small>${totalKg ? formatPercent(row.kg / totalKg) : "0%"}</small></div>
      </div>
    `;
  }).join("");
  const noMovementByLine = groupNoMovement(noMovementFiltered, (row) => row.line || "Outros");
  const noMovementByWidth = groupNoMovement(noMovementFiltered, (row) => row.widthMm ? `${row.widthMm} mm` : "Sem largura");
  const noMovementByGrammage = groupNoMovement(noMovementFiltered, (row) => row.grammage ? `${row.grammage} g` : "Sem gramatura");
  const noMovementByProfile = groupNoMovement(noMovementFiltered, (row) => row.clientProfile || "Outros clientes");
  const coverageRows = stockRows
    .filter((row) => row.demandKg > 0 || row.availablePositive > 0)
    .sort((a, b) => (b.demandKg - b.availablePositive) - (a.demandKg - a.availablePositive));
  const topValueRows = [...stockRows]
    .filter((row) => row.availablePositive > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const machineCards = machineRows.map((row) => {
    const coverage = row.demandKg ? row.stockKg / row.demandKg : null;
    const tone = row.negativeKg ? "red" : coverage === null ? "blue" : coverage >= 1 ? "green" : "amber";
    return `
      <article class="inventory-machine-card ${tone}">
        <span>${escapeHtml(row.machine)}</span>
        <strong>${formatKg(row.stockKg, 0)}</strong>
        <small>${formatBRL(row.stockValue, 0)} · ${row.skus} SKUs${row.demandKg ? ` · cobertura ${formatPercent(coverage)}` : ""}</small>
      </article>
    `;
  }).join("");

  const machineTable = machineRows.map((row) => {
    const coverage = row.demandKg ? row.stockKg / row.demandKg : null;
    const surplus = row.stockKg - row.demandKg;
    return `
      <tr>
        <td style="text-align:left"><strong>${escapeHtml(row.machine)}</strong></td>
        <td>${row.skus}</td>
        <td>${formatKg(row.stockKg, 0)}</td>
        <td>${formatBRL(row.stockValue, 0)}</td>
        <td>${row.demandKg ? formatKg(row.demandKg, 0) : "-"}</td>
        <td>${coverage === null ? "Sem carteira" : formatPercent(coverage)}</td>
        <td><span class="status-pill ${surplus >= 0 ? "" : "red"}">${formatKg(surplus, 0)}</span></td>
      </tr>
    `;
  }).join("");

  const coverageTable = coverageRows.map((row) => `
    <tr>
      <td style="text-align:left"><strong>${escapeHtml(row.description)}</strong><br><small>${escapeHtml(row.machine)} · ${escapeHtml(row.segment)} · ${row.needsRefile ? "requer refile" : row.priceSource}</small></td>
      <td>${formatKg(row.availablePositive, 0)}</td>
      <td>${row.demandKg ? formatKg(row.demandKg, 0) : "-"}</td>
      <td>${row.soldMayKg ? formatKg(row.soldMayKg, 0) : "-"}</td>
      <td>${formatBRL(row.price)}/kg</td>
      <td>${formatBRL(row.value, 0)}</td>
      <td><span class="status-pill ${row.tone}">${escapeHtml(row.status)}</span></td>
    </tr>
  `).join("");

  const noMovementTable = noMovementFiltered.map((row) => `
    <tr>
      <td style="text-align:left"><strong>${escapeHtml(row.description)}</strong><br><small>${escapeHtml(row.productCode || "")} ${escapeHtml(row.machine)} · ${row.needsRefile ? "requer refile" : row.priceSource}</small></td>
      <td>${escapeHtml(row.line || "Outros")}</td>
      <td>${row.widthMm ? `${row.widthMm} mm` : "-"}</td>
      <td>${row.grammage ? `${row.grammage} g` : "-"}</td>
      <td>${escapeHtml(row.color || "-")}</td>
      <td>${escapeHtml(row.clientProfile || "-")}</td>
      <td>${formatKg(row.availablePositive, 0)}</td>
      <td>${formatBRL(row.price)}/kg</td>
      <td>${formatBRL(row.value, 0)}</td>
      <td>${row.pieces ? row.pieces.toLocaleString("pt-BR") : "-"}</td>
    </tr>
  `).join("");

  const topValueTable = topValueRows.map((row) => `
    <tr>
      <td style="text-align:left"><strong>${escapeHtml(row.description)}</strong><br><small>${escapeHtml(row.priceSource)}</small></td>
      <td>${escapeHtml(row.machine)}</td>
      <td>${formatKg(row.availablePositive, 0)}</td>
      <td>${formatBRL(row.price)}/kg</td>
      <td>${formatBRL(row.value, 0)}</td>
      <td>${row.demandKg ? formatKg(row.demandKg, 0) : "-"}</td>
    </tr>
  `).join("");

  const inventoryFiltersChanged = Object.entries(filters).some(([key, value]) => key === "query" ? Boolean(value) : value && value !== "all");
  const lineOptions = selectOptions(optionValues(noMovementAll, "line"), filters.line);
  const widthOptions = selectOptions(optionValues(noMovementAll, "widthMm", true), filters.width, (value) => `${value} mm`);
  const grammageOptions = selectOptions(optionValues(noMovementAll, "grammage", true), filters.grammage, (value) => `${value} g`);
  const colorOptions = selectOptions(optionValues(noMovementAll, "color"), filters.color);
  const profileOptions = selectOptions(optionValues(noMovementAll, "clientProfile"), filters.profile);
  const machineOptions = selectOptions(optionValues(noMovementAll, "machine"), filters.machine);

  return `
    <div class="section-grid inventory-dashboard">
      <article class="panel span-12 inventory-hero">
        <div class="panel-header">
          <div>
            <h2>Estoque de produtos acabados · ${new Date(stockPayload.snapshotDate + "T12:00:00").toLocaleDateString("pt-BR")}</h2>
            <p>Base importada de ${escapeHtml(stockPayload.sourceFile)}. Valoração feita pelo preço médio de venda de maio por SKU, com fallback por linha/gramatura e média geral.</p>
          </div>
          <span class="status-pill blue">${stockRecords.length} itens ERP</span>
        </div>
        <div class="commercial-kpi-grid">
          <article class="commercial-kpi green"><span>Estoque disponível</span><strong>${formatKg(totals.availableKg, 0)}</strong><small>${formatKg(totals.currentKg, 0)} em estoque atual</small></article>
          <article class="commercial-kpi blue"><span>Valor estimado</span><strong>${formatBRL(totals.value, 0)}</strong><small>Precificado pelo R$/kg médio vendido em maio</small></article>
          <article class="commercial-kpi amber"><span>Carteira ativa</span><strong>${formatKg(totals.demandKg, 0)}</strong><small>${activeOrders.length} pedidos em aberto para comparar</small></article>
          <article class="commercial-kpi ${totals.availableKg >= totals.demandKg ? "green" : "red"}"><span>Cobertura geral</span><strong>${totals.demandKg ? formatPercent(totals.availableKg / totals.demandKg) : "Sem carteira"}</strong><small>Disponível vs carteira aberta</small></article>
          <article class="commercial-kpi red"><span>Sem venda/carteira</span><strong>${totals.noMovementSkus} SKUs</strong><small>${formatKg(totals.noMovementKg, 0)} · ${formatBRL(totals.noMovementValue, 0)}</small></article>
          <article class="commercial-kpi ${totals.negativeKg ? "red" : "green"}"><span>Saldo negativo</span><strong>${totals.negativeKg ? formatKg(totals.negativeKg, 0) : "Sem alerta"}</strong><small>Disponível ERP menor que zero</small></article>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Separação por máquina / corte</h2>
            <p>Estoque inferido por regra operacional: TNT/FLEXNTE e refile em Rebobinadeira; largura acima de 1400mm em Corte 2; demais itens em Corte 1.</p>
          </div>
        </div>
        <div class="inventory-machine-grid">${machineCards}</div>
        <div class="data-table-wrap inventory-table inventory-scroll-window">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Máquina</th>
                <th>SKUs</th>
                <th>Disponível</th>
                <th>Valor estoque</th>
                <th>Carteira</th>
                <th>Cobertura</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>${machineTable}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total</strong></td>
                <td>${machineRows.reduce((sum, row) => sum + row.skus, 0)}</td>
                <td>${formatKg(totals.availableKg, 0)}</td>
                <td>${formatBRL(totals.value, 0)}</td>
                <td>${formatKg(totals.demandKg, 0)}</td>
                <td>${totals.demandKg ? formatPercent(totals.availableKg / totals.demandKg) : "Sem carteira"}</td>
                <td>${formatKg(totals.availableKg - totals.demandKg, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-8">
        <div class="panel-header">
          <div>
            <h2>Estoque vs carteira de pedidos</h2>
            <p>Prioriza itens com falta, cobertura baixa ou saldo comercial relevante.</p>
          </div>
          <button class="ghost-button" type="button" data-view-jump="backlog">Abrir carteira</button>
        </div>
        <div class="data-table-wrap inventory-table inventory-scroll-window">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Produto</th>
                <th>Disponível</th>
                <th>Carteira</th>
                <th>Vendido mês</th>
                <th>Preço</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${coverageTable}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total exibido</strong></td>
                <td>${formatKg(coverageRows.reduce((sum, row) => sum + row.availablePositive, 0), 0)}</td>
                <td>${formatKg(coverageRows.reduce((sum, row) => sum + row.demandKg, 0), 0)}</td>
                <td>${formatKg(coverageRows.reduce((sum, row) => sum + row.soldMayKg, 0), 0)}</td>
                <td>-</td>
                <td>${formatBRL(coverageRows.reduce((sum, row) => sum + row.value, 0), 0)}</td>
                <td>${coverageRows.length} SKUs</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-4">
        <div class="panel-header">
          <div>
            <h2>Leitura executiva</h2>
            <p>O que agir primeiro no estoque acabado.</p>
          </div>
        </div>
        <div class="stat-stack">
          <div><span>Capital sem giro</span><strong>${formatBRL(totals.noMovementValue, 0)}</strong><small>Sem carteira e sem venda no mix de maio</small></div>
          <div><span>SKUs sem carteira</span><strong>${totals.noDemandSkus}</strong><small>Com saldo disponível e nenhum pedido aberto</small></div>
          <div><span>Preço médio aplicado</span><strong>${formatBRL(globalAvgPrice)}/kg</strong><small>Fallback quando não há histórico do SKU</small></div>
        </div>
      </article>

      <article class="panel span-12 inventory-filter-panel">
        <div class="panel-header">
          <div>
            <h2>Estoque sem venda · filtros comerciais</h2>
            <p>Separe o material disponível por tipo, largura, gramatura, cor, máquina e perfil de cliente para direcionar ofertas.</p>
          </div>
          ${inventoryFiltersChanged ? `<button class="ghost-button" type="button" data-inventory-clear>Limpar filtros</button>` : `<span class="status-pill red">${totals.noMovementSkus} SKUs sem venda</span>`}
        </div>
        <div class="inventory-filter-grid">
          <label>
            <span>Buscar</span>
            <input class="search-input" id="inventory-search" type="search" data-inventory-filter="query" placeholder="Produto, cor, aplicação, máquina..." value="${escapeHtml(filters.query || "")}">
          </label>
          <label>
            <span>Tipo</span>
            <select data-inventory-filter="line"><option value="all">Todos</option>${lineOptions}</select>
          </label>
          <label>
            <span>Largura</span>
            <select data-inventory-filter="width"><option value="all">Todas</option>${widthOptions}</select>
          </label>
          <label>
            <span>Gramatura</span>
            <select data-inventory-filter="grammage"><option value="all">Todas</option>${grammageOptions}</select>
          </label>
          <label>
            <span>Cor</span>
            <select data-inventory-filter="color"><option value="all">Todas</option>${colorOptions}</select>
          </label>
          <label>
            <span>Cliente alvo</span>
            <select data-inventory-filter="profile"><option value="all">Todos</option>${profileOptions}</select>
          </label>
          <label>
            <span>Máquina</span>
            <select data-inventory-filter="machine"><option value="all">Todas</option>${machineOptions}</select>
          </label>
          <label>
            <span>Kg maior que</span>
            <input type="number" min="0" step="100" data-inventory-filter="minKg" placeholder="Ex.: 500" value="${escapeHtml(filters.minKg || "")}">
          </label>
        </div>
        <div class="commercial-kpi-grid compact">
          <article class="commercial-kpi red"><span>Filtrado sem venda</span><strong>${formatKg(noMovementFilteredTotals.kg, 0)}</strong><small>${noMovementFilteredTotals.skus}/${totals.noMovementSkus} SKUs no recorte</small></article>
          <article class="commercial-kpi blue"><span>Valor para ofertar</span><strong>${formatBRL(noMovementFilteredTotals.value, 0)}</strong><small>Precificado pelo preço médio de venda de maio</small></article>
          <article class="commercial-kpi amber"><span>Peças / rolos</span><strong>${noMovementFilteredTotals.pieces ? noMovementFilteredTotals.pieces.toLocaleString("pt-BR") : "-"}</strong><small>Quando informado no estoque acabado</small></article>
          <article class="commercial-kpi green"><span>R$/kg médio</span><strong>${noMovementFilteredTotals.kg ? `${formatBRL(noMovementFilteredTotals.value / noMovementFilteredTotals.kg)}/kg` : "-"}</strong><small>Média ponderada do recorte</small></article>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Itens sem venda / sem carteira</h2>
            <p>Lista completa do capital parado em produto acabado, ordenada por valor estimado.</p>
          </div>
          <span class="status-pill red">${noMovementFilteredTotals.skus} SKUs</span>
        </div>
        <div class="inventory-analysis-grid">
          <article>
            <h3>Por tipo</h3>
            <div class="bar-list inventory-scroll-window">${movementBarList(noMovementByLine, noMovementFilteredTotals.kg)}</div>
          </article>
          <article>
            <h3>Por cliente alvo</h3>
            <div class="bar-list inventory-scroll-window">${movementBarList(noMovementByProfile, noMovementFilteredTotals.kg, "blue")}</div>
          </article>
          <article>
            <h3>Por largura</h3>
            <div class="bar-list inventory-scroll-window">${movementBarList(noMovementByWidth, noMovementFilteredTotals.kg, "amber")}</div>
          </article>
          <article>
            <h3>Por gramatura</h3>
            <div class="bar-list inventory-scroll-window">${movementBarList(noMovementByGrammage, noMovementFilteredTotals.kg, "green")}</div>
          </article>
        </div>
        <div class="data-table-wrap inventory-table inventory-scroll-tall">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Produto</th>
                <th>Tipo</th>
                <th>Largura</th>
                <th>Gram.</th>
                <th>Cor</th>
                <th>Cliente alvo</th>
                <th>Disponível</th>
                <th>Preço</th>
                <th>Valor</th>
                <th>Peças</th>
              </tr>
            </thead>
            <tbody>${noMovementTable || `<tr><td colspan="10" style="text-align:center;color:var(--muted)">Nenhum item sem venda/carteira encontrado para os filtros atuais.</td></tr>`}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total filtrado</strong></td>
                <td>${noMovementByLine.length} tipos</td>
                <td>${noMovementByWidth.length} larguras</td>
                <td>${noMovementByGrammage.length} gram.</td>
                <td>${optionValues(noMovementFiltered, "color").length} cores</td>
                <td>${noMovementByProfile.length} perfis</td>
                <td>${formatKg(noMovementFilteredTotals.kg, 0)}</td>
                <td>${noMovementFilteredTotals.kg ? `${formatBRL(noMovementFilteredTotals.value / noMovementFilteredTotals.kg)}/kg` : "-"}</td>
                <td>${formatBRL(noMovementFilteredTotals.value, 0)}</td>
                <td>${noMovementFilteredTotals.pieces ? noMovementFilteredTotals.pieces.toLocaleString("pt-BR") : "-"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-5">
        <div class="panel-header">
          <div>
            <h2>Top estoque valorizado</h2>
            <p>Produtos acabados com maior valor financeiro estimado.</p>
          </div>
        </div>
        <div class="data-table-wrap inventory-table compact inventory-scroll-window">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Produto</th>
                <th>Máq.</th>
                <th>Disp.</th>
                <th>R$/kg</th>
                <th>Valor</th>
                <th>Cart.</th>
              </tr>
            </thead>
            <tbody>${topValueTable}</tbody>
            <tfoot>
              <tr>
                <td style="text-align:left"><strong>Total exibido</strong></td>
                <td>${topValueRows.length} SKUs</td>
                <td>${formatKg(topValueRows.reduce((sum, row) => sum + row.availablePositive, 0), 0)}</td>
                <td>-</td>
                <td>${formatBRL(topValueRows.reduce((sum, row) => sum + row.value, 0), 0)}</td>
                <td>${formatKg(topValueRows.reduce((sum, row) => sum + row.demandKg, 0), 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </div>
  `;
}

// =================== FRETES ===================
function parseLocalizedNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const compact = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.\-+]/g, "");
  const sign = compact.startsWith("-") ? "-" : "";
  const unsigned = compact.replace(/^[-+]/, "");

  if (!/\d/.test(unsigned)) return fallback;

  const commaIndex = unsigned.lastIndexOf(",");
  const dotIndex = unsigned.lastIndexOf(".");
  let normalized = unsigned;

  if (commaIndex > -1 && dotIndex > -1) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = unsigned.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (commaIndex > -1) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, "");
  } else {
    normalized = unsigned.replace(/,/g, "");
  }

  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFreightFilters(filtersInput = {}) {
  const minRaw = String(filtersInput.minKg ?? "").trim();
  const hasMinNumber = /\d/.test(minRaw);
  const minKg = hasMinNumber ? Math.max(0, Math.round(parseLocalizedNumber(minRaw, 0))) : 0;
  const maxStopsRaw = String(filtersInput.maxStops ?? FREIGHT_DEFAULT_FILTERS.maxStops).trim();
  const parsedMaxStops = parseLocalizedNumber(maxStopsRaw, Number(FREIGHT_DEFAULT_FILTERS.maxStops));
  const maxStops = Math.min(5, Math.max(1, Math.trunc(parsedMaxStops)));
  const route = FREIGHT_ROUTE_FILTERS.has(filtersInput.route) ? filtersInput.route : FREIGHT_DEFAULT_FILTERS.route;
  const readiness = FREIGHT_READINESS_FILTERS.has(filtersInput.readiness) ? filtersInput.readiness : FREIGHT_DEFAULT_FILTERS.readiness;

  return {
    minKg,
    maxStops,
    route,
    readiness,
    filters: {
      minKg: hasMinNumber ? String(minKg) : "",
      maxStops: String(maxStops),
      route,
      readiness
    }
  };
}

function buildFreightPlanning(filtersInput = state.freightFilters || {}) {
  const truckCapacityKg = 16000;
  const weeklyTrips = 2;
  const weeklyCapacityKg = truckCapacityKg * weeklyTrips;
  const today = getBacklogReferenceDate();
  const todayD = new Date(today + "T12:00:00");
  const normalizedFilters = normalizeFreightFilters(filtersInput);
  const { minKg, maxStops, filters } = normalizedFilters;
  const allOrders = data.carteiraOrders2026 || [];
  const activeOrders = allOrders.filter((order) => order.situacao !== "Cancelado" && order.situacao !== "Nota Gerada");
  const stockAnalysis = buildBacklogStockAnalysis(activeOrders, today);
  const readyStatuses = new Set(["Produzido", "Autorizado Faturamento", "Gerado Romaneio", "Conferida"]);
  const northwestParanaCities = new Set([
    "MARINGA",
    "SARANDI",
    "PAICANDU",
    "UMUARAMA",
    "DOURADINA",
    "ARAPONGAS",
    "APUCARANA",
    "BELA VISTA DO PARAIS",
    "LONDRINA",
    "CAMBE",
    "ROLANDIA",
    "MANDAGUARI",
    "CIANORTE",
    "PARANAVAI"
  ]);

  const routeForOrder = (order) => {
    const state = order.estado || "";
    const city = normalizeInventoryText(order.cidade || "");
    const freightType = normalizeInventoryText(order.frete || "");

    if (freightType === "FOB") {
      return {
        key: "fob",
        label: "FOB · retira em Curitiba",
        note: "Cliente retira diretamente na fábrica da Spunflex; não entra na carreta nem em redespacho."
      };
    }

    if (state === "SP") {
      return {
        key: "sp",
        label: "SP / redespacho",
        note: "Pedido não FOB para entrega no estado ou descarga no redespacho do cliente em SP."
      };
    }

    if (state === "PR" && northwestParanaCities.has(city)) {
      return {
        key: "nwPr",
        label: "Noroeste PR",
        note: "Rota própria para Maringá, Umuarama, Douradina, Arapongas e região."
      };
    }

    return {
      key: "out",
      label: "Fora da rota",
      note: "Manter transportadora atual ou avaliar nova rota somente se houver viabilidade comercial."
    };
  };

  const readinessForOrder = (order, stock) => {
    if (readyStatuses.has(order.situacao) || stock?.produceKg <= 0) {
      return { key: "ready", label: "Pronto para carregar", tone: "green", priority: 0 };
    }
    if ((stock?.readyKg || 0) > 0) {
      return { key: "partial", label: "Parcial pronto", tone: "amber", priority: 1 };
    }
    return { key: "produce", label: "Aguardando produção", tone: "red", priority: 2 };
  };

  const candidates = activeOrders.map((order) => {
    const route = routeForOrder(order);
    const stock = stockAnalysis.orderMap.get(order.pedido);
    const readiness = readinessForOrder(order, stock);
    const deliveryDate = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00") : null;
    const daysToDelivery = deliveryDate ? Math.round((deliveryDate - todayD) / 86400000) : 99;
    const kg = Number(order.totalKg) || 0;
    const value = Number(order.totalValor) || 0;
    return {
      ...order,
      route,
      stock,
      readiness,
      daysToDelivery,
      kg,
      value
    };
  });

  const routeKeys = ["sp", "nwPr"];
  const ownRouteCandidates = candidates.filter((order) => routeKeys.includes(order.route.key));
  const fobOrders = candidates
    .filter((order) => order.route.key === "fob")
    .sort((a, b) =>
      a.daysToDelivery - b.daysToDelivery ||
      b.kg - a.kg ||
      String(a.cliente || "").localeCompare(String(b.cliente || ""), "pt-BR")
    );
  const filterOrder = (order) =>
    order.kg >= minKg &&
    (filters.route === "all" || order.route.key === filters.route) &&
    (filters.readiness === "all" || order.readiness.key === filters.readiness);
  const filteredCandidates = ownRouteCandidates.filter(filterOrder);
  const readyRouteCandidates = filteredCandidates.filter((order) => order.readiness.key !== "produce");
  const spPool = filteredCandidates.filter((order) => order.route.key === "sp");
  const nwPrPool = filteredCandidates.filter((order) => order.route.key === "nwPr");

  const sumFreight = (items) => items.reduce((acc, item) => {
    acc.kg += item.kg || 0;
    acc.value += item.value || 0;
    acc.readyKg += item.readiness.key !== "produce" ? item.kg || 0 : 0;
    acc.readyOrders += item.readiness.key !== "produce" ? 1 : 0;
    acc.orders += 1;
    return acc;
  }, { kg: 0, value: 0, readyKg: 0, readyOrders: 0, orders: 0 });

  const fillTrip = (pool) => {
    const rows = [];
    let loadedKg = 0;
    const sorted = [...pool]
      .filter((order) => order.readiness.key !== "produce")
      .sort((a, b) =>
        a.readiness.priority - b.readiness.priority ||
        a.daysToDelivery - b.daysToDelivery ||
        b.kg - a.kg
      );

    sorted.forEach((order) => {
      if (loadedKg >= truckCapacityKg) return;
      if (rows.length >= maxStops) return;
      const remaining = truckCapacityKg - loadedKg;
      if (order.kg <= remaining) {
        rows.push({ ...order, plannedKg: order.kg, splitLoad: false });
        loadedKg += order.kg;
        return;
      }
      if (remaining >= Math.max(minKg, 1) || !rows.length) {
        rows.push({ ...order, plannedKg: remaining, splitLoad: true });
        loadedKg += remaining;
      }
    });

    return { rows, loadedKg, utilization: loadedKg / truckCapacityKg };
  };

  const spTrip = fillTrip(spPool);
  const nwTrip = fillTrip(nwPrPool);
  const scheduledKg = spTrip.loadedKg + nwTrip.loadedKg;
  const scheduledUtilization = scheduledKg / weeklyCapacityKg;
  const eligibleTotals = sumFreight(ownRouteCandidates);
  const readyTotals = sumFreight(readyRouteCandidates);
  const filteredTotals = sumFreight(filteredCandidates);
  const fobTotals = sumFreight(fobOrders);
  const routeStats = [
    { key: "sp", label: "SP / redespacho", items: filteredCandidates.filter((order) => order.route.key === "sp"), note: "Pedidos não FOB cujo destino já está no estado de SP." },
    { key: "nwPr", label: "Noroeste PR", items: nwPrPool, note: "Pedidos não FOB em cidades compatíveis com a rota PR." }
  ].map((route) => ({ ...route, totals: sumFreight(route.items) }));

  return {
    filters,
    today,
    todayD,
    truckCapacityKg,
    weeklyTrips,
    weeklyCapacityKg,
    maxStops,
    minKg,
    candidates,
    ownRouteCandidates,
    fobOrders,
    filteredCandidates,
    readyRouteCandidates,
    spPool,
    nwPrPool,
    spTrip,
    nwTrip,
    scheduledKg,
    scheduledUtilization,
    eligibleTotals,
    readyTotals,
    filteredTotals,
    fobTotals,
    routeStats,
    sumFreight
  };
}

function freightOrderAction(order) {
  if (order.route?.key === "fob") return "Não programar na carreta; cliente retira na fábrica em Curitiba.";
  if (order.readiness.key === "ready") return "Programar na próxima carga.";
  if (order.readiness.key === "partial") return "Separar saldo pronto e confirmar se aceita embarque parcial.";
  return "Aguardar PCP liberar para entrar na carreta.";
}

function freightExportRows(scope, plan) {
  if (scope === "sp-trip") return plan.spTrip.rows;
  if (scope === "nw-trip") return plan.nwTrip.rows;
  if (scope === "candidates") return plan.filteredCandidates;
  if (scope === "routes") return plan.filteredCandidates;
  if (scope === "fob") return plan.fobOrders;
  return [
    ...plan.spTrip.rows.map((order) => ({ ...order, exportTrip: "Viagem SP / redespacho" })),
    ...plan.nwTrip.rows.map((order) => ({ ...order, exportTrip: "Viagem noroeste PR" }))
  ];
}

function exportFreightPdf(scope = "plan") {
  const plan = buildFreightPlanning();
  const rows = freightExportRows(scope, plan);
  const titles = {
    "plan": "Plano da carreta para expedição",
    "sp-trip": "Viagem SP / redespacho para expedição",
    "nw-trip": "Viagem noroeste PR para expedição",
    "routes": "Oportunidades de frete por rota",
    "candidates": "Pedidos candidatos para carreta",
    "fob": "Pedidos FOB · retirada em Curitiba"
  };
  const title = titles[scope] || titles.plan;
  const total = plan.sumFreight(rows);
  const routeSummarySource = scope === "fob"
    ? [{ label: "FOB · retira em Curitiba", note: "Pedidos excluídos da carreta e do redespacho.", totals: plan.fobTotals }]
    : plan.routeStats;
  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const logoUrl = new URL("./assets/spunflex-logo.png", window.location.href).href;
  const routeSummaryRows = routeSummarySource.map((route) => `
    <tr>
      <td><strong>${escapeHtml(route.label)}</strong><small>${escapeHtml(route.note)}</small></td>
      <td>${route.totals.orders}</td>
      <td>${formatKg(route.totals.kg, 0)}</td>
      <td>${formatKg(route.totals.readyKg, 0)}</td>
      <td>${formatBRL(route.totals.value, 0)}</td>
    </tr>
  `).join("");
  const tableRows = rows.map((order, index) => {
    const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR") : "-";
    const plannedKg = Number(order.plannedKg) || order.kg || 0;
    const trip = order.exportTrip || (scope === "sp-trip" ? "Viagem SP / redespacho" : scope === "nw-trip" ? "Viagem noroeste PR" : order.route?.label || "-");
    const lines = (order.linhas || []).map((line) => escapeHtml(line.produto || "")).filter(Boolean).slice(0, 3).join("<br>");
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(order.pedido)}</strong></td>
        <td><strong>${escapeHtml(order.cliente || "-")}</strong><small>${escapeHtml(order.cidade || "-")}/${escapeHtml(order.estado || "-")} · ${escapeHtml(order.representante || "-")}</small></td>
        <td>${escapeHtml(trip)}<small>${escapeHtml(order.route?.note || "")}</small></td>
        <td>${delivery}</td>
        <td>${formatKg(plannedKg, 0)}${order.splitLoad ? `<small>fracionar de ${formatKg(order.kg, 0)}</small>` : ""}</td>
        <td>${formatKg(order.kg || 0, 0)}</td>
        <td><span class="pill ${order.readiness.key}">${escapeHtml(order.readiness.label)}</span></td>
        <td>${escapeHtml(order.frete || "-")}</td>
        <td>${lines || "-"}</td>
        <td>${escapeHtml(freightOrderAction(order))}</td>
      </tr>
    `;
  }).join("");

  if (!rows.length) {
    showToast("Sem pedidos", "Nenhum pedido encontrado para exportar com os filtros atuais.", "warning", 3000);
    return;
  }

  const reportHtml = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin:0; color:#1f2937; font-family:Arial, Helvetica, sans-serif; font-size:10px; line-height:1.35; }
          header { display:flex; align-items:center; justify-content:space-between; gap:18px; padding-bottom:10px; border-bottom:2px solid #0ea5c6; }
          .brand { display:flex; align-items:center; gap:12px; }
          .brand img { width:118px; height:auto; object-fit:contain; }
          h1,h2,p { margin:0; }
          h1 { color:#111827; font-size:21px; line-height:1.05; }
          h2 { color:#111827; font-size:14px; margin:12px 0 6px; }
          small { display:block; color:#6b7280; font-size:9px; line-height:1.3; }
          .meta { text-align:right; color:#4b5563; }
          .summary { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0; }
          .metric { padding:8px 10px; border:1px solid #d1d5db; border-top:4px solid #0ea5c6; border-radius:6px; break-inside:avoid; }
          .metric span { display:block; color:#6b7280; font-size:8px; font-weight:700; text-transform:uppercase; }
          .metric strong { display:block; margin-top:4px; color:#111827; font-size:14px; }
          table { width:100%; border-collapse:collapse; margin-top:8px; }
          th { background:#e8f7fb; color:#111827; font-size:8px; text-align:left; text-transform:uppercase; }
          th,td { padding:5px 6px; border:1px solid #d1d5db; vertical-align:top; }
          td:nth-child(1), td:nth-child(2), td:nth-child(5), td:nth-child(6), td:nth-child(7), td:nth-child(9) { white-space:nowrap; }
          .pill { display:inline-block; padding:2px 6px; border-radius:999px; font-size:8px; font-weight:700; white-space:nowrap; }
          .pill.ready { background:#dcfce7; color:#166534; }
          .pill.partial { background:#fef3c7; color:#92400e; }
          .pill.produce { background:#fee2e2; color:#991b1b; }
          .toolbar { position:sticky; top:0; display:flex; justify-content:flex-end; padding:8px 0; background:#fff; z-index:5; }
          .toolbar button { border:1px solid #0ea5c6; border-radius:6px; background:#0ea5c6; color:#fff; font-weight:700; padding:7px 12px; cursor:pointer; }
          @media print { .toolbar { display:none; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>
        <header>
          <div class="brand">
            <img src="${logoUrl}" alt="Spunflex">
            <div>
              <h1>${escapeHtml(title)}</h1>
              <small>${scope === "fob" ? "Pedidos FOB: cliente retira direto na fábrica da Spunflex em Curitiba." : `Filtro: pedidos acima de ${formatKg(plan.minKg, 0)} · máximo ${plan.maxStops} descargas/NFs por viagem · capacidade ${formatKg(plan.truckCapacityKg, 0)}`}</small>
            </div>
          </div>
          <div class="meta">
            <strong>Ref. ${new Date(plan.today + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
            <small>Gerado em ${escapeHtml(generatedAt)}</small>
          </div>
        </header>
        <section class="summary">
          <article class="metric"><span>Pedidos/NFs</span><strong>${rows.length}</strong></article>
          <article class="metric"><span>${scope === "fob" ? "Kg FOB" : "Kg planejado"}</span><strong>${formatKg(rows.reduce((sum, row) => sum + (Number(row.plannedKg) || row.kg || 0), 0), 0)}</strong></article>
          <article class="metric"><span>Kg total pedido</span><strong>${formatKg(total.kg, 0)}</strong></article>
          <article class="metric"><span>Valor</span><strong>${formatBRL(total.value, 0)}</strong></article>
          <article class="metric"><span>${scope === "fob" ? "Operação" : "Limite operacional"}</span><strong>${scope === "fob" ? "Retira fábrica" : `${plan.maxStops} descargas`}</strong></article>
        </section>
        <h2>Resumo por rota</h2>
        <table>
          <thead><tr><th>Rota</th><th>Pedidos</th><th>Peso</th><th>Pronto/parcial</th><th>Valor</th></tr></thead>
          <tbody>${routeSummaryRows}</tbody>
        </table>
        <h2>${scope === "fob" ? "Lista FOB para conferência" : "Lista para expedição"}</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Pedido</th><th>Cliente / destino</th><th>Viagem / rota</th><th>Entrega</th><th>Kg carga</th><th>Kg pedido</th><th>Status</th><th>Frete</th><th>Produtos</th><th>Ação</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("Pop-up bloqueado", "Permita pop-ups para abrir o relatório de fretes.", "warning", 5000);
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(displayMachineLabels(reportHtml));
  reportWindow.document.close();
  reportWindow.focus();
  showToast("Relatório pronto", "A janela de impressão foi aberta. Use Salvar como PDF.", "success", 3200);
  setTimeout(() => reportWindow.print(), 700);
}

function renderFreights() {
  const plan = buildFreightPlanning();
  const {
    truckCapacityKg,
    weeklyTrips,
    weeklyCapacityKg,
    maxStops,
    minKg,
    filteredCandidates,
    spPool,
    nwPrPool,
    spTrip,
    nwTrip,
    scheduledUtilization,
    eligibleTotals,
    fobOrders,
    fobTotals,
    readyTotals,
    filteredTotals,
    routeStats,
    sumFreight
  } = plan;
  const filters = plan.filters;

  const routeOptions = [
    ["all", "Todas as rotas"],
    ["sp", "SP / redespacho"],
    ["nwPr", "Noroeste PR"]
  ].map(([value, label]) => `<option value="${value}" ${filters.route === value ? "selected" : ""}>${label}</option>`).join("");
  const readinessOptions = [
    ["all", "Todos os status"],
    ["ready", "Pronto"],
    ["partial", "Parcial pronto"],
    ["produce", "Aguardando produção"]
  ].map(([value, label]) => `<option value="${value}" ${filters.readiness === value ? "selected" : ""}>${label}</option>`).join("");

  const tripCard = (title, subtitle, trip, pool, tone = "blue", exportKey = "plan") => {
    const idleKg = Math.max(truckCapacityKg - trip.loadedKg, 0);
    const rows = trip.rows.map((order) => {
      const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";
      return `
        <tr>
          <td><strong>${escapeHtml(order.pedido)}</strong></td>
          <td style="text-align:left">${escapeHtml(order.cliente || "-")}<br><small>${escapeHtml(order.cidade || "-")}/${escapeHtml(order.estado || "-")}</small></td>
          <td>${delivery}</td>
          <td>${formatKg(order.plannedKg, 0)}${order.splitLoad ? `<br><small>fracionar de ${formatKg(order.kg, 0)}</small>` : ""}</td>
          <td><span class="status-pill ${order.readiness.tone}">${escapeHtml(order.readiness.label)}</span></td>
        </tr>
      `;
    }).join("");

    return `
      <article class="freight-trip-card ${tone}">
        <div class="freight-trip-head">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="freight-trip-actions">
            <button class="ghost-button" type="button" data-export-freight="${exportKey}">Exportar expedição</button>
            <span class="status-pill ${trip.utilization >= 0.85 ? "green" : trip.utilization >= 0.55 ? "amber" : "red"}">${formatPercent(trip.utilization)}</span>
          </div>
        </div>
        <div class="freight-load-bar" aria-hidden="true">
          <span style="width:${Math.min(trip.utilization * 100, 100).toFixed(1)}%"></span>
        </div>
        <div class="freight-trip-stats">
          <div><span>Carga</span><strong>${formatKg(trip.loadedKg, 0)}</strong></div>
          <div><span>Descargas/NFs</span><strong>${trip.rows.length}/${maxStops}</strong></div>
          <div><span>Capacidade</span><strong>${formatKg(truckCapacityKg, 0)}</strong></div>
          <div><span>Espaço livre</span><strong>${formatKg(idleKg, 0)}</strong></div>
        </div>
        <div class="data-table-wrap freight-trip-table">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th style="text-align:left">Cliente / destino</th>
                <th>Entrega</th>
                <th>Kg planejado</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sem carga pronta suficiente para esta rota.</td></tr>`}</tbody>
          </table>
        </div>
      </article>
    `;
  };

  const routeRows = routeStats.map((route) => `
    <tr>
      <td style="text-align:left"><strong>${escapeHtml(route.label)}</strong><br><small>${escapeHtml(route.note)}</small></td>
      <td>${route.totals.orders}</td>
      <td>${formatKg(route.totals.kg, 0)}</td>
      <td>${formatKg(route.totals.readyKg, 0)}</td>
      <td>${formatBRL(route.totals.value, 0)}</td>
      <td>${Math.ceil(route.totals.kg / truckCapacityKg) || 0}</td>
    </tr>
  `).join("");

  const candidateRows = [...filteredCandidates]
    .sort((a, b) =>
      a.route.key.localeCompare(b.route.key) ||
      a.readiness.priority - b.readiness.priority ||
      a.daysToDelivery - b.daysToDelivery ||
      b.kg - a.kg
    )
    .map((order) => {
      const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";
      const urgencyTone = order.daysToDelivery < 0 ? "red" : order.daysToDelivery <= 3 ? "amber" : "blue";
      const action = freightOrderAction(order);
      return `
        <tr>
          <td><strong>${escapeHtml(order.pedido)}</strong></td>
          <td style="text-align:left">${escapeHtml(order.cliente || "-")}<br><small>${escapeHtml(order.cidade || "-")}/${escapeHtml(order.estado || "-")} · ${escapeHtml(order.representante || "-")}</small></td>
          <td style="text-align:left">${escapeHtml(order.route.label)}<br><small>${escapeHtml(order.route.note)}</small></td>
          <td>${delivery}<br><span class="status-pill ${urgencyTone}">${order.daysToDelivery < 0 ? `${Math.abs(order.daysToDelivery)}d atraso` : `${order.daysToDelivery}d`}</span></td>
          <td><span class="status-pill ${order.readiness.tone}">${escapeHtml(order.readiness.label)}</span></td>
          <td>${escapeHtml(order.frete || "-")}</td>
          <td>${formatKg(order.kg, 0)}</td>
          <td>${formatBRL(order.value, 0)}</td>
          <td style="text-align:left">${escapeHtml(action)}</td>
        </tr>
      `;
    }).join("");

  const fobRows = fobOrders.map((order) => {
    const delivery = order.dataEntrega ? new Date(order.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";
    const urgencyTone = order.daysToDelivery < 0 ? "red" : order.daysToDelivery <= 3 ? "amber" : "blue";
    return `
      <tr>
        <td><strong>${escapeHtml(order.pedido)}</strong></td>
        <td style="text-align:left">${escapeHtml(order.cliente || "-")}<br><small>${escapeHtml(order.cidade || "-")}/${escapeHtml(order.estado || "-")} · ${escapeHtml(order.representante || "-")}</small></td>
        <td>${delivery}<br><span class="status-pill ${urgencyTone}">${order.daysToDelivery < 0 ? `${Math.abs(order.daysToDelivery)}d atraso` : `${order.daysToDelivery}d`}</span></td>
        <td><span class="status-pill ${order.readiness.tone}">${escapeHtml(order.readiness.label)}</span></td>
        <td>${formatKg(order.kg, 0)}</td>
        <td>${formatBRL(order.value, 0)}</td>
        <td style="text-align:left">${escapeHtml(freightOrderAction(order))}</td>
      </tr>
    `;
  }).join("");

  const weeklyGapKg = Math.max(weeklyCapacityKg - readyTotals.readyKg, 0);
  const fleetGainNote = readyTotals.readyKg >= weeklyCapacityKg
    ? "Carteira pronta já ocupa as duas viagens."
    : `Faltam ${formatKg(weeklyGapKg, 0)} prontos para ocupar 100% da semana.`;

  return `
    <div class="section-grid freight-dashboard">
      <article class="panel span-12 freight-hero">
        <div class="panel-header">
          <div>
            <h2>Fretes · carreta própria 16 t</h2>
            <p>Planejamento para aumentar a utilização da carreta em entregas próprias, redespacho em SP e noroeste do Paraná. Pedidos FOB ficam fora da carreta porque o cliente retira na fábrica em Curitiba.</p>
          </div>
          <div class="control-row">
            <button class="ghost-button" type="button" data-export-freight="plan">Exportar expedição</button>
            <span class="status-pill blue">Capacidade semanal ${formatKg(weeklyCapacityKg, 0)}</span>
          </div>
        </div>
        <div class="section-grid" style="gap:14px">
          ${kpiCard("Capacidade por viagem", formatKg(truckCapacityKg, 0), "Carreta completa", "blue")}
          ${kpiCard("Plano semanal", `${weeklyTrips} viagens`, `Até ${maxStops} descargas/NFs por viagem`, "green")}
          ${kpiCard("Carteira elegível", formatKg(eligibleTotals.kg, 0), `${eligibleTotals.orders} pedidos não FOB em SP/redespacho ou noroeste PR`, "amber")}
          ${kpiCard("FOB excluído", `${fobTotals.orders} pedidos`, `${formatKg(fobTotals.kg, 0)} · cliente retira em Curitiba`, fobTotals.orders ? "red" : "green")}
          ${kpiCard("Pronto para embarcar", formatKg(readyTotals.readyKg, 0), `${readyTotals.readyOrders} pedidos · ${fleetGainNote}`, readyTotals.readyKg >= weeklyCapacityKg ? "green" : "red")}
        </div>
      </article>

      <article class="panel span-12 freight-filter-panel">
        <div class="panel-header">
          <div>
            <h2>Filtros operacionais</h2>
            <p>Use para montar cargas práticas: preferência por pedidos acima de 1.000 kg, até 5 descargas/NFs por viagem e sem considerar FOB.</p>
          </div>
          <div class="control-row">
            <button class="ghost-button" type="button" data-export-freight="plan">Exportar plano</button>
            <button class="ghost-button" type="button" data-freight-clear>Limpar filtros</button>
          </div>
        </div>
        <div class="freight-filter-grid">
          <label>
            <span>Peso mínimo por pedido</span>
            <input id="freight-filter-min-kg" type="text" inputmode="numeric" pattern="[0-9.,]*" data-freight-filter="minKg" aria-label="Peso mínimo por pedido" value="${escapeHtml(filters.minKg)}">
          </label>
          <label>
            <span>Máx. descargas/NFs</span>
            <input id="freight-filter-max-stops" type="number" min="1" max="5" step="1" data-freight-filter="maxStops" aria-label="Máximo de descargas ou NFs" value="${escapeHtml(filters.maxStops)}">
          </label>
          <label>
            <span>Rota</span>
            <select id="freight-filter-route" data-freight-filter="route" aria-label="Rota">${routeOptions}</select>
          </label>
          <label>
            <span>Status da carga</span>
            <select id="freight-filter-readiness" data-freight-filter="readiness" aria-label="Status da carga">${readinessOptions}</select>
          </label>
        </div>
        <div class="freight-filter-summary">
          <span class="status-pill blue">${filteredCandidates.length} pedidos no filtro</span>
          <span class="status-pill amber">${formatKg(filteredTotals.kg, 0)} filtrados</span>
          <span class="status-pill">${formatKg(readyTotals.readyKg, 0)} prontos/parciais</span>
          <span class="status-pill red">${fobTotals.orders} FOB fora da carreta</span>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Plano sugerido das 2 viagens</h2>
            <p>Prioriza pedidos não FOB, prontos ou parciais, vencidos/curto prazo primeiro, respeitando 16 t e até ${maxStops} descargas/NFs por viagem.</p>
          </div>
          <div class="control-row">
            <button class="ghost-button" type="button" data-export-freight="plan">Exportar expedição</button>
            <span class="status-pill ${scheduledUtilization >= 0.85 ? "green" : scheduledUtilization >= 0.55 ? "amber" : "red"}">Uso planejado ${formatPercent(scheduledUtilization)}</span>
          </div>
        </div>
        <div class="freight-trip-grid">
          ${tripCard("Viagem 1 · São Paulo / redespacho", "Saída carregada domingo, descarga segunda em SP ou redespacho do cliente. FOB não entra nesta carga.", spTrip, spPool, "blue", "sp-trip")}
          ${tripCard("Viagem 2 · Noroeste do Paraná", "Após retorno a Curitiba, carregar pedidos não FOB prontos para a rota PR.", nwTrip, nwPrPool, "green", "nw-trip")}
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Oportunidade por rota</h2>
            <p>Mostra somente pedidos não FOB que podem alimentar a carreta própria.</p>
          </div>
          <div class="control-row">
            <button class="ghost-button" type="button" data-export-freight="routes">Exportar rotas</button>
            <span class="status-pill red">FOB excluído: ${fobTotals.orders} pedidos · ${formatKg(fobTotals.kg, 0)}</span>
          </div>
        </div>
        <div class="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Rota</th>
                <th>Pedidos</th>
                <th>Peso carteira</th>
                <th>Peso pronto/parcial</th>
                <th>Valor</th>
                <th>Viagens cheias</th>
              </tr>
            </thead>
            <tbody>${routeRows}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Pedidos candidatos para carreta</h2>
            <p>Lista filtrada para trabalho da expedição. O padrão prioriza pedidos acima de ${formatKg(minKg, 0)} e exclui todos os FOB.</p>
          </div>
          <button class="ghost-button" type="button" data-export-freight="candidates">Exportar candidatos</button>
        </div>
        <div class="data-table-wrap freight-candidate-table">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th style="text-align:left">Cliente / destino</th>
                <th style="text-align:left">Rota</th>
                <th>Entrega</th>
                <th>Status carga</th>
                <th>Frete</th>
                <th>Peso</th>
                <th>Valor</th>
                <th style="text-align:left">Ação</th>
              </tr>
            </thead>
            <tbody>${candidateRows || `<tr><td colspan="9" style="text-align:center;color:var(--muted)">Nenhum pedido elegível para a carreta no momento.</td></tr>`}</tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align:left"><strong>Total candidatos filtrados</strong><br><small>Somente pedidos não FOB considerados para a carreta</small></td>
                <td>${filteredTotals.orders} pedido${filteredTotals.orders !== 1 ? "s" : ""}</td>
                <td>Não FOB</td>
                <td>${formatKg(filteredTotals.kg, 0)}</td>
                <td>${formatBRL(filteredTotals.value, 0)}</td>
                <td style="text-align:left">Prontos/parciais: ${readyTotals.readyOrders} pedido${readyTotals.readyOrders !== 1 ? "s" : ""} · ${formatKg(readyTotals.readyKg, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>

      <article class="panel span-12 freight-fob-panel">
        <div class="panel-header">
          <div>
            <h2>Pedidos FOB · cliente retira em Curitiba</h2>
            <p>Esses pedidos não entram na carreta própria nem no redespacho. Total ativo: ${fobTotals.orders} pedido${fobTotals.orders !== 1 ? "s" : ""} · ${formatKg(fobTotals.kg, 0)} · ${formatBRL(fobTotals.value, 0)}.</p>
          </div>
          <button class="ghost-button" type="button" data-export-freight="fob">Exportar FOB</button>
        </div>
        <div class="data-table-wrap freight-fob-table">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th style="text-align:left">Cliente / destino</th>
                <th>Entrega</th>
                <th>Status carga</th>
                <th>Peso</th>
                <th>Valor</th>
                <th style="text-align:left">Ação</th>
              </tr>
            </thead>
            <tbody>${fobRows || `<tr><td colspan="7" style="text-align:center;color:var(--muted)">Nenhum pedido FOB ativo na carteira.</td></tr>`}</tbody>
          </table>
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Regra operacional proposta</h2>
            <p>Uso prático para transformar a carreta em rotina de expedição, sem competir com transportadoras dos clientes.</p>
          </div>
          <button class="ghost-button" type="button" data-export-freight="plan">Exportar expedição</button>
        </div>
        <div class="freight-rule-grid">
          ${managementCard("Rota SP e redespacho", "Consolidar pedidos não FOB de SP e entregas em redespacho do cliente, registrados como Transportadora Cristalina quando aplicável.", "A carreta descarrega em SP; o cliente segue com a transportadora dele a partir dali.")}
          ${managementCard("Rota noroeste PR", "Agrupar pedidos não FOB de Maringá, Sarandi, Umuarama, Douradina, Arapongas e região para ocupar a segunda viagem.", "Priorizar pedidos CIF prontos e com entrega mais próxima.")}
          ${managementCard("Meta de utilização", `Alvo mínimo: ${formatKg(truckCapacityKg * 0.85, 0)} por saída.`, "Abaixo disso, completar com redespacho SP ou aguardar carga pronta de curto prazo.")}
          ${managementCard("FOB fora da carga", `${fobTotals.orders} pedido${fobTotals.orders !== 1 ? "s" : ""} FOB ficam separados da programação da carreta.`, "Cliente retira direto na fábrica da Spunflex em Curitiba.")}
        </div>
      </article>
    </div>
  `;
}

// =================== CARTEIRA ===================
function renderBacklog() {
  const today = getBacklogReferenceDate();
  const todayD = new Date(today + "T12:00:00");
  const todayLabelShort = todayD.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const todayLabelFull = todayD.toLocaleDateString("pt-BR");
  const allOrders = data.carteiraOrders2026 || [];

  // Classification
  const isFaturado  = (o) => o.situacao === "Nota Gerada";
  const isCancelado = (o) => o.situacao === "Cancelado";
  const isAtrasado  = (o) => !isFaturado(o) && !isCancelado(o) && o.dataEntrega < today;
  const isAtivo     = (o) => !isFaturado(o) && !isCancelado(o);

  const ativos     = allOrders.filter(isAtivo).sort((a, b) => (a.dataEntrega || "").localeCompare(b.dataEntrega || ""));
  const atrasados  = ativos.filter(isAtrasado);
  const faturados  = allOrders.filter(isFaturado);
  const cancelados = allOrders.filter(isCancelado);

  // Totals
  const totalAtivo = ativos.reduce((a, o) => ({ val: a.val + o.totalValor, kg: a.kg + o.totalKg }), { val: 0, kg: 0 });
  const totalAtr   = atrasados.reduce((a, o) => ({ val: a.val + o.totalValor, kg: a.kg + o.totalKg }), { val: 0, kg: 0 });
  const hoje       = ativos.filter(o => o.dataEntrega === today);
  const totalHoje  = hoje.reduce((a, o) => ({ val: a.val + o.totalValor, kg: a.kg + o.totalKg }), { val: 0, kg: 0 });
  const backlogBuckets = buildBacklogDeliveryBuckets(today);
  const nearBucket = backlogBuckets.find((bucket) => bucket.key === "near");
  const semanaLabel = nearBucket?.label || "Próximos dias";
  const semana     = nearBucket ? ativos.filter(nearBucket.filter) : [];
  const totalSem   = semana.reduce((a, o) => ({ val: a.val + o.totalValor, kg: a.kg + o.totalKg }), { val: 0, kg: 0 });
  const stockAnalysis = buildBacklogStockAnalysis(ativos, today);
  const readyToBillList = stockAnalysis.readyToBill;
  const readyToBillTotals = readyToBillList.reduce((acc, order) => {
    acc.orders += 1;
    acc.kg += order.readyKg || 0;
    acc.value += order.readyValue || 0;
    if (order.late) acc.lateOrders += 1;
    return acc;
  }, { orders: 0, kg: 0, value: 0, lateOrders: 0 });
  const readyToBillRows = readyToBillList.map((order) => {
    const delivery = order.delivery ? new Date(order.delivery + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";
    const original = ativos.find((item) => item.pedido === order.pedido);
    return `
      <tr class="${order.late ? "commercial-row-red" : "commercial-row-blue"}">
        <td><strong>${order.pedido}</strong></td>
        <td style="text-align:left">${escapeHtml(order.client || "-")}<br><small>${escapeHtml(original?.representante || "-")}</small></td>
        <td>${delivery}</td>
        <td>${formatKg(order.readyKg, 0)}</td>
        <td>${formatBRL(order.readyValue, 0)}</td>
        <td><span class="status-pill ${order.late ? "red" : "blue"}">${order.late ? "Atrasado pronto" : "Pronto"}</span></td>
        <td style="text-align:left">Cobrar faturamento, romaneio e expedição.</td>
      </tr>
    `;
  }).join("");

  const productionRows = stockAnalysis.needsProduction.slice(0, 16).map((line) => `
    <tr>
      <td><strong>${line.pedido}</strong></td>
      <td style="text-align:left">${escapeHtml(line.produto)}<br><small>${escapeHtml(line.maquina)}</small></td>
      <td>${formatKg(line.requiredKg, 0)}</td>
      <td>${line.readyKg ? formatKg(line.readyKg, 0) : "-"}</td>
      <td><strong style="color:var(--red)">${formatKg(line.produceKg, 0)}</strong></td>
      <td>${formatBRL(line.produceValue, 0)}</td>
      <td><span class="status-pill ${line.readyKg ? "amber" : "red"}">${line.status}</span></td>
    </tr>
  `).join("");

  // Status color map
  const sitColor = (s) => ({
    "Nota Gerada": "green", "Gerado Romaneio": "blue", "Autorizado Faturamento": "blue",
    "Produzido": "amber", "Autorizado Produção": "", "Entrega Parcial": "amber",
    "Conferida": "green", "Cadastrada": "", "Cancelado": "red"
  }[s] || "");

  // Pipeline counts (by pedido, ativos only)
  const pipeline = ["Cadastrada","Autorizado Produção","Produzido","Autorizado Faturamento","Gerado Romaneio"];
  const pipeCount = {};
  pipeline.forEach(s => { pipeCount[s] = ativos.filter(o => o.situacao === s).length; });

  // Render one order row
  const orderRow = (o) => {
    const orderStock = stockAnalysis.orderMap.get(o.pedido);
    const deDt = o.dataEntrega ? new Date(o.dataEntrega + "T12:00:00") : null;
    const diff = deDt ? Math.round((deDt - todayD) / 86400000) : null;
    let delayBadge = "";
    if (diff !== null && diff < 0) delayBadge = `<span class="status-pill red" style="font-size:0.65rem;padding:1px 6px">+${Math.abs(diff)}d atraso</span>`;
    else if (diff === 0) delayBadge = `<span class="status-pill amber" style="font-size:0.65rem;padding:1px 6px">Hoje</span>`;
    const color = sitColor(o.situacao);
    const deStr = o.dataEntrega ? new Date(o.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" }) : "-";
    const linhasHtml = o.linhas.map((l) => {
      const lineStock = stockAnalysis.lineMap.get(`${o.pedido}|${l.seq}`);
      const tone = lineStock?.produceKg <= 0 ? "" : lineStock?.readyKg > 0 ? "amber" : "red";
      const stockText = lineStock
        ? `Pronto ${formatKg(lineStock.readyKg, 0)} · Produzir ${formatKg(lineStock.produceKg, 0)}`
        : "Sem leitura de estoque";
      return `
        <tr class="subrow backlog-stock-subrow">
          <td></td>
          <td colspan="2" style="padding-left:20px;color:var(--text-dim);font-size:0.78rem">↳ ${escapeHtml(l.produto)}<br><small>${escapeHtml(l.maquina || lineStock?.maquina || "-")}</small></td>
          <td style="text-align:right;color:var(--text-dim);font-size:0.78rem">${formatKg(l.kg,1)}</td>
          <td style="text-align:right;color:var(--text-dim);font-size:0.78rem">${formatBRL(l.valor)}</td>
          <td colspan="2" style="text-align:left;font-size:0.78rem">
            <span class="status-pill ${tone}" style="font-size:0.68rem">${lineStock?.status || "Sem estoque"}</span>
            <small style="display:block;color:var(--text-dim);margin-top:3px">${stockText}</small>
          </td>
          <td style="text-align:left;font-size:0.78rem;color:var(--text-dim)">${lineStock?.produceKg > 0 ? "Programar produção" : "Cobrar expedição/faturamento"}</td>
        </tr>
      `;
    }).join("");
    const stockPill = orderStock
      ? `<span class="status-pill ${orderStock.tone}" style="font-size:0.68rem">${orderStock.statusStock}</span><br><small style="color:var(--text-dim)">Pronto ${formatKg(orderStock.readyKg, 0)} · Produzir ${formatKg(orderStock.produceKg, 0)}</small>`
      : `<span class="status-pill red" style="font-size:0.68rem">Sem estoque</span>`;
    return `
      <tr class="carteira-row" data-ped="${o.pedido}">
        <td><strong>${o.pedido}</strong></td>
        <td style="text-align:left">${escapeHtml(o.cliente)}<br><span style="font-size:0.75rem;color:var(--text-dim)">${escapeHtml(o.cidade)}/${o.estado}</span></td>
        <td style="text-align:left;font-size:0.82rem">${escapeHtml(o.representante)}</td>
        <td style="text-align:right">${formatKg(o.totalKg,1)}</td>
        <td style="text-align:right">${formatBRL(o.totalValor)}</td>
        <td style="text-align:center">${deStr} ${delayBadge}</td>
        <td style="text-align:center"><span class="status-pill ${color}" style="font-size:0.72rem">${escapeHtml(o.situacao)}</span></td>
        <td style="text-align:left;font-size:0.78rem;color:var(--text-dim)">${escapeHtml(o.frete)} · ${escapeHtml(o.condicaoPgto)}<div style="margin-top:5px">${stockPill}</div></td>
      </tr>
      ${linhasHtml}
    `;
  };

  // Group by delivery date
  const byDate = {};
  ativos.filter(o => !isAtrasado(o)).forEach(o => {
    const k = o.dataEntrega || "sem-data";
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(o);
  });

  const dateLabel = (d) => {
    if (d === today) return `<strong style="color:var(--cyan)">${todayLabelShort} — HOJE</strong>`;
    const dt = new Date(d + "T12:00:00");
    const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const wday = dias[dt.getDay()];
    const str = dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
    return `<strong>${str} · ${wday}</strong>`;
  };

  const tableHeader = `
    <thead><tr>
      <th style="text-align:left;width:60px">Pedido</th>
      <th style="text-align:left">Cliente</th>
      <th style="text-align:left">Representante</th>
      <th>Peso</th><th>Valor</th>
      <th style="text-align:center">Entrega</th>
      <th style="text-align:center">Situação</th>
      <th style="text-align:left">Frete/Pgto</th>
    </tr></thead>`;

  const atrasadosSection = atrasados.length ? `
    <article class="panel span-12" style="border-top:2px solid var(--red,#e55)">
      <div class="panel-header">
        <div>
          <h2 style="color:var(--red,#e55)">Pedidos atrasados</h2>
          <p>Entrega prometida já venceu — analisar motivo do não faturamento.</p>
        </div>
        <div class="control-row">
          <button class="ghost-button" type="button" data-export-late-backlog>Exportar PDF expedição</button>
          <span class="status-pill red">${atrasados.length} atrasado${atrasados.length>1?"s":""} · ${formatKg(totalAtr.kg,0)} kg · ${formatBRL(totalAtr.val)}</span>
        </div>
      </div>
      <div class="data-table-wrap">
        <table>${tableHeader}<tbody>${atrasados.map(orderRow).join("")}</tbody></table>
      </div>
      <div style="margin-top:14px;padding:12px 16px;background:rgba(229,85,85,.08);border-radius:8px;font-size:0.83rem;line-height:1.6">
        <strong>Análise:</strong>
        <ul style="margin:6px 0 0 18px">
          <li><strong>Ped 7790 ZEFLEX</strong> (23.215 kg / R$ 412.899) — Situação <em>Entrega Parcial</em>: maior pedido da carteira, parcialmente entregue. Verificar saldo em produção e romaneio pendente para o restante.</li>
          <li><strong>Ped 7703 CRISTALFLEX</strong> (2.797 kg / R$ 52.720) — Situação <em>Cadastrada</em>: ainda não autorizado para produção. Urgente aprovar e agendar corte.</li>
          <li><strong>Ped 7809 ANTUARTE</strong> (2.352 kg / R$ 43.042) — Situação <em>Autorizado Produção</em>: em produção mas não faturado. Verificar disponibilidade de máquina.</li>
        </ul>
      </div>
    </article>` : "";

  const stockReadinessPanel = `
    <article class="panel span-12 backlog-readiness-panel">
      <div class="panel-header">
        <div>
          <h2>Carteira x estoque acabado</h2>
          <p>Alocação conservadora do estoque pronto: atrasados primeiro, depois entrega de hoje e próximas datas.</p>
        </div>
        <span class="status-pill ${stockAnalysis.totals.produceKg ? "amber" : ""}">${formatPercent(stockAnalysis.totals.readyKg / Math.max(stockAnalysis.totals.kg, 1))} pronto</span>
      </div>
      <div class="commercial-kpi-grid">
        <article class="commercial-kpi green"><span>Pronto para faturar</span><strong>${formatKg(stockAnalysis.totals.readyKg, 0)}</strong><small>${formatBRL(stockAnalysis.totals.readyValue, 0)} · ${stockAnalysis.totals.readyOrders} pedidos 100% prontos</small></article>
        <article class="commercial-kpi red"><span>A produzir</span><strong>${formatKg(stockAnalysis.totals.produceKg, 0)}</strong><small>${formatBRL(stockAnalysis.totals.produceValue, 0)} ainda sem estoque alocado</small></article>
        <article class="commercial-kpi amber"><span>Pedidos parciais</span><strong>${stockAnalysis.totals.partialOrders}</strong><small>Parte pronta e parte pendente de produção</small></article>
        <article class="commercial-kpi ${stockAnalysis.totals.readyLateOrders ? "red" : "green"}"><span>Atrasados já prontos</span><strong>${stockAnalysis.totals.readyLateOrders}</strong><small>${formatKg(stockAnalysis.totals.readyLateKg, 0)} · ${formatBRL(stockAnalysis.totals.readyLateValue, 0)} para cobrar expedição</small></article>
      </div>
    </article>

    <article class="panel span-7">
      <div class="panel-header">
        <div>
          <h2>Pedidos com estoque pronto</h2>
          <p>Fila para cobrar faturamento, romaneio e expedição imediatamente.</p>
        </div>
      </div>
      <div class="data-table-wrap backlog-stock-table">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th style="text-align:left">Cliente</th>
              <th>Entrega</th>
              <th>Kg pronto</th>
              <th>Valor</th>
              <th>Status</th>
              <th style="text-align:left">Ação</th>
            </tr>
          </thead>
          <tbody>${readyToBillRows || `<tr><td colspan="7" style="text-align:center;color:var(--muted)">Nenhum pedido 100% pronto com a alocação atual.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td style="text-align:left"><strong>Total para faturar</strong></td>
              <td style="text-align:left">${readyToBillTotals.orders} pedido${readyToBillTotals.orders === 1 ? "" : "s"}</td>
              <td>${readyToBillTotals.lateOrders ? `${readyToBillTotals.lateOrders} atrasado${readyToBillTotals.lateOrders === 1 ? "" : "s"}` : "-"}</td>
              <td>${formatKg(readyToBillTotals.kg, 0)}</td>
              <td>${formatBRL(readyToBillTotals.value, 0)}</td>
              <td>${readyToBillTotals.orders ? "Pronto" : "-"}</td>
              <td style="text-align:left">Cobrar faturamento e expedição.</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>

    <article class="panel span-5">
      <div class="panel-header">
        <div>
          <h2>Itens que faltam produzir</h2>
          <p>Maiores gargalos por linha de pedido.</p>
        </div>
      </div>
      <div class="data-table-wrap backlog-stock-table compact">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th style="text-align:left">Produto</th>
              <th>Kg pedido</th>
              <th>Pronto</th>
              <th>Produzir</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${productionRows || `<tr><td colspan="7" style="text-align:center;color:var(--muted)">Carteira coberta pelo estoque alocado.</td></tr>`}</tbody>
        </table>
      </div>
    </article>
  `;

  const dateGroups = Object.keys(byDate).sort().map(d => {
    const group = byDate[d];
    const gVal = group.reduce((a, o) => a + o.totalValor, 0);
    const gKg  = group.reduce((a, o) => a + o.totalKg, 0);
    return `
      <article class="panel span-12">
        <div class="panel-header" style="border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:10px;margin-bottom:0">
          <div>${dateLabel(d)}<p style="font-size:0.8rem;color:var(--text-dim);margin-top:2px">${group.length} pedido${group.length>1?"s":""} · ${formatKg(gKg,0)} kg · ${formatBRL(gVal)}</p></div>
        </div>
        <div class="data-table-wrap" style="margin-top:0">
          <table>${tableHeader}<tbody>${group.map(orderRow).join("")}</tbody></table>
        </div>
      </article>`;
  }).join("");

  // Status pipeline visual
  const pipelineHtml = `
    <div style="display:flex;gap:0;align-items:stretch;overflow:hidden;border-radius:10px;border:1px solid rgba(255,255,255,.08);margin-bottom:0">
      ${pipeline.map((s, i) => {
        const cnt = pipeCount[s] || 0;
        const colors = ["rgba(255,255,255,.06)","rgba(16,183,220,.12)","rgba(245,166,35,.12)","rgba(16,183,220,.2)","rgba(16,183,220,.3)"];
        return `<div style="flex:1;padding:12px 14px;background:${colors[i]};border-right:1px solid rgba(255,255,255,.06)">
          <div style="font-size:1.5rem;font-weight:700;color:var(--cyan)">${cnt}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">${s}</div>
        </div>`;
      }).join("")}
      <div style="flex:1;padding:12px 14px;background:rgba(40,200,120,.15)">
        <div style="font-size:1.5rem;font-weight:700;color:#2bc87a">${faturados.length}</div>
        <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">Nota Gerada</div>
      </div>
      <div style="flex:1;padding:12px 14px;background:rgba(229,85,85,.1)">
        <div style="font-size:1.5rem;font-weight:700;color:#e55">${cancelados.length}</div>
        <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">Cancelado</div>
      </div>
    </div>`;

  // Faturados collapsible
  const faturadosRows = faturados.map(o => `
    <tr>
      <td><strong>${o.pedido}</strong></td>
      <td style="text-align:left">${escapeHtml(o.cliente)}</td>
      <td style="text-align:left;font-size:0.82rem">${escapeHtml(o.representante)}</td>
      <td style="text-align:right">${formatKg(o.totalKg,1)}</td>
      <td style="text-align:right">${formatBRL(o.totalValor)}</td>
      <td style="text-align:center">${o.dataEntrega ? new Date(o.dataEntrega+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) : "-"}</td>
      <td style="text-align:center"><span class="status-pill green" style="font-size:0.72rem">Nota Gerada</span></td>
      <td style="text-align:left;font-size:0.78rem;color:var(--text-dim)">${escapeHtml(o.frete)} · ${escapeHtml(o.condicaoPgto)}</td>
    </tr>`).join("");

  const canceladosRows = cancelados.map(o => `
    <tr>
      <td><strong>${o.pedido}</strong></td>
      <td style="text-align:left">${escapeHtml(o.cliente)}</td>
      <td style="text-align:left;font-size:0.82rem">${escapeHtml(o.representante)}</td>
      <td style="text-align:right">${formatKg(o.totalKg,1)}</td>
      <td style="text-align:right">${formatBRL(o.totalValor)}</td>
      <td style="text-align:center">${o.dataEntrega ? new Date(o.dataEntrega+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) : "-"}</td>
      <td style="text-align:center"><span class="status-pill red" style="font-size:0.72rem">Cancelado</span></td>
      <td style="text-align:left;font-size:0.78rem;color:var(--text-dim)">${escapeHtml(o.frete)} · ${escapeHtml(o.condicaoPgto)}</td>
    </tr>`).join("");

  return `
    <div class="section-grid">

      <!-- KPIs -->
      ${kpiCard("Carteira em aberto", formatBRL(totalAtivo.val), `${formatKg(totalAtivo.kg,0)} kg · ${ativos.length} pedidos`, "green")}
      ${kpiCard("Atrasados", atrasados.length ? formatBRL(totalAtr.val) : "Sem atrasos", atrasados.length ? `${atrasados.length} pedidos · ${formatKg(totalAtr.kg,0)} kg` : "Carteira dentro do prazo", atrasados.length ? "red" : "green")}
      ${kpiCard(`Entrega hoje (${todayLabelShort})`, formatBRL(totalHoje.val), `${hoje.length} pedidos · ${formatKg(totalHoje.kg,0)} kg`, "amber")}
      ${kpiCard("Entrega próxima", formatBRL(totalSem.val + totalHoje.val), `${semanaLabel} · ${semana.length + hoje.length} pedidos · ${formatKg(totalSem.kg + totalHoje.kg,0)} kg`, "blue")}
      ${kpiCard("Pronto no estoque", formatKg(stockAnalysis.totals.readyKg, 0), `${formatBRL(stockAnalysis.totals.readyValue, 0)} já pode seguir para faturamento`, "green")}
      ${kpiCard("Falta produzir", formatKg(stockAnalysis.totals.produceKg, 0), `${formatBRL(stockAnalysis.totals.produceValue, 0)} sem estoque pronto`, stockAnalysis.totals.produceKg ? "red" : "green")}

      <!-- Pipeline de status -->
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Pipeline de status · maio 2026</h2>
            <p>Fluxo dos ${allOrders.length} pedidos da carteira geral — da captação ao faturamento.</p>
          </div>
          <span class="status-pill blue">Ref. ${todayLabelFull}</span>
        </div>
        ${pipelineHtml}
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:10px">
          <strong>Faturamento previsto (ativos):</strong> ${formatBRL(totalAtivo.val)} · ${formatKg(totalAtivo.kg,0)} kg
          &nbsp;|&nbsp; <strong>Cancelados:</strong> ${formatBRL(cancelados.reduce((a,o)=>a+o.totalValor,0))} perdidos
          &nbsp;|&nbsp; <strong>Faturados:</strong> ${formatBRL(faturados.reduce((a,o)=>a+o.totalValor,0))}
        </p>
      </article>

      ${stockReadinessPanel}

      <!-- Atrasados -->
      ${atrasadosSection}

      <!-- Por data de entrega -->
      ${dateGroups}

      <!-- Faturados (Nota Gerada) -->
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Já faturados — Nota Gerada (${faturados.length})</h2>
            <p>Pedidos com nota emitida. Total: ${formatBRL(faturados.reduce((a,o)=>a+o.totalValor,0))} · ${formatKg(faturados.reduce((a,o)=>a+o.totalKg,0),0)} kg</p>
          </div>
          <span class="status-pill green">Faturado</span>
        </div>
        <div class="data-table-wrap">
          <table>${tableHeader}<tbody>${faturadosRows}</tbody></table>
        </div>
      </article>

      <!-- Cancelados -->
      <article class="panel span-12">
        <div class="panel-header">
          <div>
            <h2>Cancelados (${cancelados.length})</h2>
            <p>Pedidos cancelados. Valor perdido: ${formatBRL(cancelados.reduce((a,o)=>a+o.totalValor,0))} · ${formatKg(cancelados.reduce((a,o)=>a+o.totalKg,0),0)} kg</p>
          </div>
          <span class="status-pill red">Cancelado</span>
        </div>
        <div class="data-table-wrap">
          <table>${tableHeader}<tbody>${canceladosRows}</tbody></table>
        </div>
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
  const todayDevices = new Set(todayLogs.map((log) => log.deviceType || deviceTypeFromLegacy(log.device))).size;

  return `
    <div class="section-grid">
      ${kpiCard("Usuários cadastrados", String(users.length), `${users.filter((user) => user.active !== false).length} ativos`, "blue")}
      ${kpiCard("Acessos hoje", String(todayLogs.filter((log) => log.status === "permitido").length), "Logins autorizados neste navegador", "green")}
      ${kpiCard("Tentativas negadas", String(deniedToday), "Falhas de senha ou usuario", deniedToday ? "red" : "amber")}
      ${kpiCard("Dispositivos hoje", String(todayDevices), "Computador, celular ou tablet identificados", "green")}

      <article class="panel span-12 cyber-brief-panel">
        <div class="panel-header">
          <div>
            <h2>Auditoria de segurança</h2>
            <p>Registro operacional de autenticação, navegação, alterações administrativas e contexto do dispositivo.</p>
          </div>
          <span class="status-pill amber">Sem backend</span>
        </div>
        <div class="cyber-brief-grid">
          ${managementCard("O que fica registrado", "Login, saída, tentativa negada, ativação por código, edição de usuário, alteração de permissões e página acessada.", "Retenção local: últimos 1.000 eventos neste navegador.")}
          ${managementCard("Contexto técnico", "Tipo de dispositivo, navegador, sistema operacional, tela, janela, idioma, fuso horário, rota e origem de acesso.", "Use para investigar uso indevido e comportamento fora do padrão.")}
          ${managementCard("Limite do GitHub Pages", "IP público, geolocalização real e auditoria centralizada exigem servidor ou autenticação dedicada.", "Próximo nível: backend com banco, logs imutáveis e MFA.")}
        </div>
      </article>

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
        ${createdAccessPanel()}
      </article>

      <article class="panel span-7 admin-users-panel">
        <div class="panel-header">
          <div>
            <h2>Usuários e permissões</h2>
            <p>Edite cadastro, redefina senha e acompanhe autorizacoes por pagina.</p>
          </div>
        </div>
        ${adminUsersTable(users)}
      </article>

      ${editUserPanel(users)}

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

function createdAccessPanel() {
  if (!state.lastCreatedAccess) {
    return `
      <div class="admin-notice">
        <strong>Validade do login</strong>
        <span>Neste site estatico, o usuario fica salvo neste navegador. Para liberar em outro computador, envie o login, senha e codigo de ativacao gerado apos o cadastro.</span>
      </div>
    `;
  }

  const permissions = state.lastCreatedAccess.permissions || [];
  const permissionLabels = permissions.length
    ? permissions
        .map((perm) => VIEW_DEFINITIONS.find((v) => v.id === perm)?.label || perm)
        .join(", ")
    : "Todas as páginas (admin)";

  return `
    <div class="created-access-card">
      <div>
        <span>${state.lastCreatedAccess.mode === "updated" ? "Acesso atualizado" : "Acesso criado"}</span>
        <strong>${escapeHtml(state.lastCreatedAccess.displayName)}</strong>
      </div>
      <dl>
        <div><dt>Login</dt><dd>${escapeHtml(state.lastCreatedAccess.username)}</dd></div>
        <div><dt>Senha</dt><dd>${escapeHtml(state.lastCreatedAccess.password)}</dd></div>
        <div><dt>Permissões salvas</dt><dd>${escapeHtml(permissionLabels)}</dd></div>
      </dl>
      <label>Código de ativação
        <textarea readonly>${escapeHtml(state.lastCreatedAccess.activationCode)}</textarea>
      </label>
      <div class="created-access-actions">
        <button class="ghost-button" type="button" data-copy-created-access="credentials">Copiar tudo</button>
        <button class="primary-button" type="button" data-copy-created-access="code">Copiar código</button>
      </div>
    </div>
  `;
}

function editUserPanel(users) {
  const user = users.find((item) => item.id === state.editingUserId);
  if (!user) return "";

  const admin = user.role === "admin";
  return `
    <article class="panel span-12 edit-user-panel">
      <div class="panel-header">
        <div>
          <h2>Editar usuário</h2>
          <p>Atualize cadastro, perfil, autorizacoes e gere uma nova senha quando necessario.</p>
        </div>
        <span class="status-pill ${admin ? "blue" : ""}">${admin ? "Admin" : "Usuário"}</span>
      </div>
      <div class="admin-form edit-user-form">
        <label>Nome
          <input id="edit-display-name" type="text" value="${escapeHtml(user.displayName || user.username)}">
        </label>
        <label>Login
          <input id="edit-username" type="text" value="${escapeHtml(user.username)}">
        </label>
        <label>Perfil
          <select id="edit-role">
            <option value="user" ${user.role !== "admin" ? "selected" : ""}>Usuário</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option>
          </select>
        </label>
        <label class="switch-label edit-active-label">
          <input id="edit-active" type="checkbox" ${user.active !== false ? "checked" : ""}>
          Usuário ativo
        </label>
        <label>Nova senha
          <div class="admin-password-row">
            <input id="edit-password" type="text" placeholder="Deixe vazio para manter a senha atual">
            <button class="ghost-button" id="generate-edit-password" type="button">Gerar</button>
          </div>
        </label>
        <fieldset class="permission-grid edit-permission-grid">
          <legend>Autorizações de páginas</legend>
          ${VIEW_DEFINITIONS.filter((view) => view.id !== "admin").map((view) => `
            <label><input type="checkbox" name="edit-user-permission" value="${view.id}" ${admin || (user.permissions || []).includes(view.id) ? "checked" : ""}> ${view.label}</label>
          `).join("")}
        </fieldset>
        <div class="edit-user-actions">
          <button class="primary-button" id="save-edit-user" type="button">Salvar alterações</button>
          <button class="ghost-button" type="button" data-cancel-edit-user>Cancelar</button>
        </div>
      </div>
    </article>
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
          <div class="table-actions">
            <button class="ghost-button table-action" type="button" data-edit-user="${user.id}">Editar</button>
            <button class="ghost-button danger-ghost table-action" type="button" data-delete-user="${user.id}" ${user.id === currentUser?.id || admin ? "disabled" : ""}>Excluir</button>
          </div>
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
      <td>
        <strong>${escapeHtml(log.deviceType || deviceTypeFromLegacy(log.device))}</strong>
        <small>${escapeHtml(log.browser || "Navegador nao identificado")} | ${escapeHtml(log.os || "SO nao identificado")}</small>
      </td>
      <td>
        <small>Tela: ${escapeHtml(log.screen || "-")} | Janela: ${escapeHtml(log.viewport || "-")}</small>
        <small>Idioma: ${escapeHtml(log.language || "-")} | Fuso: ${escapeHtml(log.timezone || "-")}</small>
      </td>
      <td>
        <small>${escapeHtml(log.path || "-")}</small>
        <small>${escapeHtml(log.referrer || "Acesso direto")}</small>
      </td>
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
            <th>Dispositivo</th>
            <th>Ambiente</th>
            <th>Origem</th>
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
    list.innerHTML = representativesPeriodTables();
    applyMachineDisplayLabels(list);
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
  const total = totalSales(year, 12, { includePartial: true });
  const closedMonths = data.monthlySales.filter((row) => row.year === year && !row.partial).length;
  const partialMonths = data.monthlySales.filter((row) => row.year === year && row.partial).length;
  const monthsForAvg = closedMonths || data.monthlySales.filter((row) => row.year === year).length;
  const avgRevenue = total.revenue / monthsForAvg;
  const avgWeight = total.weightKg / monthsForAvg;
  const monthsLabel = partialMonths
    ? `${closedMonths} fechados + ${partialMonths} parcial`
    : `${closedMonths}`;

  return `
    <div class="stat-strip">
      <div><span>Faturamento</span><strong>${formatBRL(total.revenue, year === 2026 ? 2 : 0)}</strong></div>
      <div><span>Peso</span><strong>${formatKg(total.weightKg)}</strong></div>
      <div><span>Média mensal</span><strong>${formatBRL(avgRevenue, year === 2026 ? 2 : 0)}</strong></div>
    </div>
    <div class="stat-strip" style="margin-top:10px">
      <div><span>Meses na base</span><strong>${monthsLabel}</strong></div>
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
      if (!record) return `<td>-</td>`;
      const value = formatMetric(record[metric], metric, year);
      if (record.partial) {
        const through = record.partialThrough
          ? new Date(record.partialThrough + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";
        return `<td><span style="color:var(--amber);font-weight:700">${value}</span><br><small style="color:var(--muted)">parcial até ${through}</small></td>`;
      }
      return `<td>${value}</td>`;
    }).join("");
    return `<tr><td>${month.name}</td>${cells}</tr>`;
  }).join("");

  const footer = years.map((year) => `<td>${formatMetric(totalSales(year, 12, { includePartial: true })[metric], metric, year)}</td>`).join("");

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

function representativesPeriodTables() {
  const currentRows = filteredRepresentativeRows(representativeCurrentRows());
  const previousRows = filteredRepresentativeRows(representativePreviousRows());
  const period = data.mayInvoices2026?.period || {};
  const periodStart = period.startDate ? new Date(period.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  const periodEnd = period.endDate ? new Date(period.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

  return `
    ${representativesTable(currentRows, {
      title: `Mês vigente atualizado · maio ${periodStart}–${periodEnd}`,
      note: "Somente NFs emitidas dentro do período vigente já carregado.",
      empty: "Nenhum representante encontrado em maio."
    })}
    ${representativesTable(previousRows, {
      title: "Mês anterior executado · abril fechado",
      note: "Fechamento executado do mês anterior para comparação e referência.",
      empty: "Nenhum representante encontrado em abril."
    })}
  `;
}

function representativesTable(rows, options = {}) {
  const totals = representativesTotals(rows);
  const tableRows = rows.map((rep, index) => {
    const avg = rep.weightKg ? rep.revenue / rep.weightKg : 0;
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="text-align:left">${escapeHtml(rep.name)}${rep.notes ? `<br><small>${escapeHtml(rep.notes)}</small>` : ""}</td>
        <td>${formatKg(rep.weightKg, 0)}</td>
        <td>${formatBRL(rep.revenue, 0)}</td>
        <td>${rep.weightKg ? formatBRL(avg) : "-"}</td>
        <td>${rep.invoiceCount ? `${rep.invoiceCount} NF${rep.invoiceCount === 1 ? "" : "s"}` : "-"}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="representatives-period-head">
      <div>
        <h3>${escapeHtml(options.title || "Representantes")}</h3>
        <p>${escapeHtml(options.note || "")}</p>
      </div>
      <span class="status-pill blue">${rows.length} representante${rows.length === 1 ? "" : "s"}</span>
    </div>
    <div class="data-table-wrap representatives-table goals-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left">Representante</th>
            <th>Peso</th>
            <th>Faturamento</th>
            <th>R$/kg</th>
            <th>NFs</th>
          </tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="6" style="text-align:center;color:var(--muted)">${escapeHtml(options.empty || "Nenhum representante encontrado.")}</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:left"><strong>Total</strong></td>
            <td>${formatKg(totals.weightKg, 0)}</td>
            <td>${formatBRL(totals.revenue, 0)}</td>
            <td>${totals.weightKg ? formatBRL(totals.revenue / totals.weightKg) : "-"}</td>
            <td>${totals.invoiceCount ? `${totals.invoiceCount} NFs` : "-"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function mayGoalTable(plan, targetKg) {
  // Faturado em maio por representante
  const fatByRep = {};
  (data.mayInvoices2026?.invoices || []).forEach(nf => {
    const key = (nf.representative || "").trim();
    if (!fatByRep[key]) fatByRep[key] = { kg: 0, val: 0 };
    fatByRep[key].kg  += nf.weightKg || 0;
    fatByRep[key].val += nf.revenue  || 0;
  });

  // Carteira ativa por representante
  const cartByRep = {};
  (data.carteiraOrders2026 || [])
    .filter(o => o.situacao !== "Cancelado" && o.situacao !== "Nota Gerada")
    .forEach(o => {
      const key = (o.representante || "").trim();
      if (!cartByRep[key]) cartByRep[key] = { kg: 0, val: 0, pedidos: 0 };
      cartByRep[key].kg     += o.totalKg    || 0;
      cartByRep[key].val    += o.totalValor || 0;
      cartByRep[key].pedidos++;
    });

  const rows = plan.map((row, index) => {
    const fat  = fatByRep[row.name]  || { kg: 0, val: 0 };
    const cart = cartByRep[row.name] || { kg: 0, val: 0, pedidos: 0 };
    const realizado = fat.kg + cart.kg;
    const pct    = row.targetKg > 0 ? realizado / row.targetKg : 0;
    const saldo  = Math.max(0, row.targetKg - realizado);
    const pill   = pct >= 1 ? "" : pct >= 0.5 ? "amber" : "red";

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatTon(row.targetKg)}<br><small style="color:var(--muted)">${formatBRL(row.targetRevenue, 0)}</small></td>
        <td>${fat.kg > 0 ? `${formatKg(fat.kg, 0)}<br><small style="color:var(--muted)">${formatBRL(fat.val, 0)}</small>` : `<span style="color:var(--muted)">—</span>`}</td>
        <td>${cart.kg > 0 ? `${formatKg(cart.kg, 0)}<br><small style="color:var(--muted)">${cart.pedidos} ped. · ${formatBRL(cart.val, 0)}</small>` : `<span style="color:var(--muted)">—</span>`}</td>
        <td style="text-align:center">
          <span class="status-pill ${pill}">${formatPercent(pct)}</span>
          <div style="background:var(--border);border-radius:4px;height:6px;margin-top:6px;overflow:hidden">
            <div style="width:${Math.min(pct * 100, 100).toFixed(1)}%;height:100%;background:${pct >= 1 ? "var(--green)" : pct >= 0.5 ? "var(--amber)" : "var(--red)"}"></div>
          </div>
        </td>
        <td>${saldo > 0 ? `<strong style="color:var(--red)">${formatKg(saldo, 0)}</strong>` : `<span style="color:var(--green)">✓ Meta coberta</span>`}</td>
      </tr>
    `;
  }).join("");

  const totalFat  = plan.reduce((s, r) => s + (fatByRep[r.name]?.kg  || 0), 0);
  const totalCart = plan.reduce((s, r) => s + (cartByRep[r.name]?.kg || 0), 0);
  const totalReal = totalFat + totalCart;
  const totalPct  = targetKg > 0 ? totalReal / targetKg : 0;

  return `
    <div class="data-table-wrap representatives-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left">Representante / Canal</th>
            <th>Meta maio</th>
            <th>Faturado maio</th>
            <th>Carteira ativa</th>
            <th>Progresso</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>Total</strong></td>
            <td>${formatTon(targetKg)}</td>
            <td>${formatKg(totalFat, 0)}</td>
            <td>${formatKg(totalCart, 0)}</td>
            <td style="text-align:center"><span class="status-pill ${totalPct >= 1 ? "" : "red"}">${formatPercent(totalPct)}</span></td>
            <td>${formatKg(Math.max(0, targetKg - totalReal), 0)}</td>
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
      if (!record) return `<td>-</td>`;
      const value = formatBRL(record.revenue, year === 2026 ? 2 : 0);
      if (record.partial) {
        const through = record.partialThrough
          ? new Date(record.partialThrough + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";
        return `<td><span style="color:var(--amber);font-weight:700">${value}</span><br><small style="color:var(--muted)">parcial até ${through}</small></td>`;
      }
      return `<td>${value}</td>`;
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
            ${years.map((year) => `<td>${formatBRL(totalSales(year, 12, { includePartial: true }).revenue, year === 2026 ? 2 : 0)}</td>`).join("")}
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

function representativeCurrentRows() {
  return (data.mayInvoices2026?.representatives || []).map((row) => ({ ...row }));
}

function representativePreviousRows() {
  return (data.representativesApril2026 || []).map((row) => ({ ...row, invoiceCount: row.invoiceCount || null }));
}

function sortRepresentativeRows(rows, sortKey = state.repSort) {
  return [...rows].sort((a, b) => {
    const aValue = sortKey === "avg" ? (a.weightKg ? a.revenue / a.weightKg : 0) : (a[sortKey] || 0);
    const bValue = sortKey === "avg" ? (b.weightKg ? b.revenue / b.weightKg : 0) : (b[sortKey] || 0);
    return bValue - aValue;
  });
}

function filteredRepresentativeRows(rows) {
  const query = normalize(state.repQuery);
  return sortRepresentativeRows(rows).filter((rep) => normalize(rep.name).includes(query));
}

function representativesTotals(rows) {
  return rows.reduce((acc, row) => {
    acc.weightKg += Number(row.weightKg) || 0;
    acc.revenue += Number(row.revenue) || 0;
    acc.invoiceCount += Number(row.invoiceCount) || 0;
    return acc;
  }, { weightKg: 0, revenue: 0, invoiceCount: 0 });
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

function totalSales(year, throughMonth = 12, { includePartial = false } = {}) {
  return data.monthlySales
    .filter((row) => row.year === year && row.month <= throughMonth && (includePartial || !row.partial))
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
  // Ignore partial months for projection/forecast logic
  const closed = data.monthlySales.filter((row) => row.year === year && !row.partial);
  return closed.length ? Math.max(...closed.map((row) => row.month)) : 0;
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
