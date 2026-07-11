const SOS_CONFIG = window.SOS_CONFIG || {};
const API = SOS_CONFIG.API_BASE || "https://sos.vsti.cl";

const state = {
  users: [],
  selectedUserId: null,
  selectedUser: null,
  detail: null,
  sessionUser: null,
  platformSettings: null,
  branding: null,
  sirens: [],
  physicalDevices: [],
  usersPage: 1,
  usersPageSize: 10,
  activeAdminSection: "users"
};

const els = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginPhoneInput: document.getElementById("loginPhoneInput"),
  loginCodeInput: document.getElementById("loginCodeInput"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),
  sessionUser: document.getElementById("sessionUser"),
  logoutButton: document.getElementById("logoutButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  controlCenterInput: document.getElementById("controlCenterInput"),
  roleFilter: document.getElementById("roleFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  refreshButton: document.getElementById("refreshButton"),
  pendingButton: document.getElementById("pendingButton"),
  toggleCreateButton: document.getElementById("toggleCreateButton"),
  closeCreateButton: document.getElementById("closeCreateButton"),
  summaryLabel: document.getElementById("summaryLabel"),
  usersList: document.getElementById("usersList"),
  detailCard: document.getElementById("detailCard"),
  toast: document.getElementById("toast"),
  createCard: document.getElementById("createCard"),
  createUserButton: document.getElementById("createUserButton"),
  clearCreateFormButton: document.getElementById("clearCreateFormButton"),
  bulkCreateButton: document.getElementById("bulkCreateButton"),
  bulkExampleButton: document.getElementById("bulkExampleButton"),
  bulkUsersText: document.getElementById("bulkUsersText"),
  bulkResult: document.getElementById("bulkResult"),
  reloadSettingsButton: document.getElementById("reloadSettingsButton"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  settingsStatus: document.getElementById("settingsStatus"),
  brandingAdminCard: document.getElementById("brandingAdminCard"),
  reloadBrandingButton: document.getElementById("reloadBrandingButton"),
  saveBrandingButton: document.getElementById("saveBrandingButton"),
  brandingStatus: document.getElementById("brandingStatus"),
  municipalityLogoFile: document.getElementById("municipalityLogoFile"),
  municipalityLogoUrlInput: document.getElementById("municipalityLogoUrlInput"),
  municipalityLogoPreview: document.getElementById("municipalityLogoPreview"),
  productLogoFile: document.getElementById("productLogoFile"),
  productLogoUrlInput: document.getElementById("productLogoUrlInput"),
  productLogoPreview: document.getElementById("productLogoPreview"),
  brandPrimaryColorInput: document.getElementById("brandPrimaryColorInput"),
  brandSecondaryColorInput: document.getElementById("brandSecondaryColorInput"),
  reloadSirensButton: document.getElementById("reloadSirensButton"),
  saveSirenButton: document.getElementById("saveSirenButton"),
  clearSirenButton: document.getElementById("clearSirenButton"),
  sirensList: document.getElementById("sirensList"),
  reloadDevicesButton: document.getElementById("reloadDevicesButton"),
  saveDeviceButton: document.getElementById("saveDeviceButton"),
  clearDeviceButton: document.getElementById("clearDeviceButton"),
  devicesList: document.getElementById("devicesList"),
  physicalDevicesAdminCard: document.getElementById("physicalDevicesAdminCard"),
  nearbyCategoryChips: document.getElementById("nearbyCategoryChips"),
  neighborCategoryList: document.getElementById("neighborCategoryList"),
  adminTabs: document.getElementById("adminTabs"),
  userFiltersCard: document.getElementById("userFiltersCard"),
  createCard: document.getElementById("createCard"),
  usersContentGrid: document.getElementById("usersContentGrid"),
  platformConfigCard: document.getElementById("platformConfigCard"),
  sirensAdminCard: document.getElementById("sirensAdminCard"),
  userPagination: document.getElementById("userPagination"),
  pagePrevButton: document.getElementById("pagePrevButton"),
  pageNextButton: document.getElementById("pageNextButton"),
  pageInfo: document.getElementById("pageInfo")
};

const ROLES = ["NEIGHBOR", "RESOLVER", "OPERATOR", "ADMIN", "SUPER_ADMIN"];
const NOTIFIABLE_CATEGORIES = [
  { code: "FIRE", label: "Incendio" },
  { code: "TRAFFIC_ACCIDENT", label: "Accidente tránsito" },
  { code: "URBAN_RISK", label: "Riesgo urbano" },
  { code: "MEDICAL", label: "Emergencia médica" },
  { code: "SECURITY", label: "Seguridad pública" },
  { code: "SOS_MANUAL", label: "SOS manual" },
  { code: "OTHER", label: "Otro" }
];
const BLOCKED_NEARBY_CATEGORIES = new Set(["VIF", "VIF_SILENT", "SILENT", "SILENT_SOS"]);

const DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES = [
  { type: "SOS_MANUAL", title: "SOS General", icon: "🚨", color: "#ef4444", priority: 1, enabled: true, order: 10 },
  { type: "MEDICAL", title: "Médica", icon: "🚑", color: "#22c55e", priority: 1, enabled: true, order: 20 },
  { type: "FIRE", title: "Incendio", icon: "🔥", color: "#f97316", priority: 1, enabled: true, order: 30 },
  { type: "SECURITY", title: "Seguridad", icon: "👮", color: "#8b5cf6", priority: 2, enabled: true, order: 40 },
  { type: "VIF", title: "VIF", icon: "🏠", color: "#a855f7", priority: 1, enabled: true, order: 50, sensitive: true },
  { type: "TRAFFIC_ACCIDENT", title: "Accidente", icon: "🚗", color: "#3b82f6", priority: 2, enabled: true, order: 60 },
  { type: "URBAN_RISK", title: "Riesgo", icon: "⚠️", color: "#eab308", priority: 3, enabled: true, order: 70 },
  { type: "OTHER", title: "Otro", icon: "📝", color: "#64748b", priority: 3, enabled: true, order: 80 }
];

let neighborCategoryDraft = [];

function normalizeNeighborCategories(rawCategories = []) {
  const received = Array.isArray(rawCategories)
    ? rawCategories.filter((raw) => raw && typeof raw === "object")
    : [];
  const source = received.length ? received : DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES;
  const defaultsByType = new Map(DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES.map(category => [category.type, { ...category }]));
  const byType = new Map();

  source.forEach((raw, index) => {
    const type = String(raw.type || raw.alert_type || raw.code || "").trim().toUpperCase();
    if (!type) return;
    const fallback = defaultsByType.get(type) || {};
    const priority = Number(raw.priority);
    const order = Number(raw.order);
    const title = String(raw.title_override || raw.title || raw.label || fallback.title || type).trim();
    const catalogTitle = String(raw.catalog_title || raw.base_title || raw.default_title || raw.title || fallback.title || title).trim();

    byType.set(type, {
      ...fallback,
      ...raw,
      type,
      title,
      catalog_title: catalogTitle,
      icon: String(raw.icon || fallback.icon || "🆘").trim(),
      color: String(raw.color || fallback.color || "#2563eb").trim(),
      priority: Number.isFinite(priority) ? priority : Number(fallback.priority || 3),
      enabled: raw.enabled !== false,
      order: Number.isFinite(order) ? order : Number(fallback.order || ((index + 1) * 10)),
      title_override: String(raw.title_override || "").trim()
    });
  });

  const categories = Array.from(byType.values()).sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
  if (!categories.some(category => category.enabled !== false)) {
    const firstAvailable = categories[0];
    if (firstAvailable) firstAvailable.enabled = true;
  }
  return categories;
}

function categoryDisplayTitle(category) {
  return String(category.title_override || category.title || category.catalog_title || category.type || "").trim();
}

function renderNeighborCategories(categories = DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES) {
  if (!els.neighborCategoryList) return;
  neighborCategoryDraft = normalizeNeighborCategories(categories);
  els.neighborCategoryList.innerHTML = neighborCategoryDraft.map(category => {
    const displayTitle = categoryDisplayTitle(category);
    const catalogTitle = category.catalog_title || category.title || category.type;
    const aliasValue = category.title_override || "";
    return `
      <label class="neighbor-category-row">
        <span class="neighbor-category-topline">
          <input class="neighbor-category-toggle" type="checkbox" data-neighbor-category-enabled="${escapeHtml(category.type)}" ${category.enabled !== false ? "checked" : ""}>
          <span class="neighbor-category-label">
            <span class="emoji">${escapeHtml(category.icon || "🆘")}</span>
            <span>
              <strong>${escapeHtml(displayTitle)}</strong>
              <small>Categoría base: ${escapeHtml(catalogTitle)}</small>
            </span>
          </span>
        </span>
        <span class="neighbor-category-fields">
          <span class="neighbor-category-field neighbor-category-field-alias">
            <span>Nombre visible local</span>
            <input class="neighbor-category-alias" type="text" value="${escapeHtml(aliasValue)}" placeholder="Opcional" data-neighbor-category-alias="${escapeHtml(category.type)}" aria-label="Nombre visible local ${escapeHtml(displayTitle)}">
          </span>
          <span class="neighbor-category-field neighbor-category-field-order">
            <span>Orden</span>
            <input class="neighbor-category-order" type="number" min="1" max="999" value="${Number(category.order || 100)}" data-neighbor-category-order="${escapeHtml(category.type)}" aria-label="Orden ${escapeHtml(displayTitle)}">
          </span>
        </span>
      </label>
    `;
  }).join("");
}

function collectNeighborCategories() {
  if (!els.neighborCategoryList) return DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES;
  const source = neighborCategoryDraft.length ? neighborCategoryDraft : DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES;
  const categories = source.map(category => {
    const enabledInput = els.neighborCategoryList.querySelector(`[data-neighbor-category-enabled="${category.type}"]`);
    const aliasInput = els.neighborCategoryList.querySelector(`[data-neighbor-category-alias="${category.type}"]`);
    const orderInput = els.neighborCategoryList.querySelector(`[data-neighbor-category-order="${category.type}"]`);
    const order = Number(orderInput?.value);
    const alias = String(aliasInput?.value || "").trim();
    const catalogTitle = category.catalog_title || category.title || category.type;

    return {
      ...category,
      catalog_title: catalogTitle,
      title_override: alias,
      title: alias || catalogTitle,
      enabled: Boolean(enabledInput?.checked),
      order: Number.isFinite(order) ? order : category.order
    };
  });

  if (!categories.some(category => category.enabled)) {
    const sos = categories.find(category => category.type === "SOS_MANUAL") || categories[0];
    if (sos) sos.enabled = true;
  }
  return normalizeNeighborCategories(categories);
}



function roleOptions() {
  return isSuperAdmin() ? ROLES : ROLES.filter((role) => role !== "SUPER_ADMIN");
}

const VALIDATION_STATUSES = [
  "PENDING_VERIFICATION",
  "PROVISIONAL_ACTIVE",
  "VALIDATED",
  "REJECTED",
  "SUSPENDED"
];

function getSessionToken() {
  return sessionStorage.getItem("sos_admin_session_token") || "";
}

function setSession(token, user) {
  sessionStorage.setItem("sos_admin_session_token", token);
  sessionStorage.setItem("sos_admin_session_user", JSON.stringify(user || {}));
  localStorage.removeItem("sos_admin_session_token");
  localStorage.removeItem("sos_admin_session_user");
}

function clearSession() {
  sessionStorage.removeItem("sos_admin_session_token");
  sessionStorage.removeItem("sos_admin_session_user");
  localStorage.removeItem("sos_admin_session_token");
  localStorage.removeItem("sos_admin_session_user");
}

function apiHeaders() {
  const sessionToken = getSessionToken();
  return {
    "Content-Type": "application/json",
    ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
  };
}

function showLogin(message = "") {
  els.loginView.hidden = false;
  els.appView.hidden = true;
  els.sessionUser.hidden = true;
  els.logoutButton.hidden = true;
  els.loginError.textContent = message;
  setConnection(false);
}

function isSuperAdmin() {
  return String(state.sessionUser?.role || "").toUpperCase() === "SUPER_ADMIN";
}

function showApp(user) {
  state.sessionUser = user || state.sessionUser;
  els.loginView.hidden = true;
  els.appView.hidden = false;
  els.sessionUser.hidden = false;
  els.logoutButton.hidden = false;
  els.sessionUser.textContent = `${state.sessionUser?.full_name || "ADMIN"} · ${state.sessionUser?.role || "ADMIN"} · ${state.sessionUser?.control_center_code || ""}`;

  if (state.sessionUser?.control_center_code && !isSuperAdmin()) {
    els.controlCenterInput.value = state.sessionUser.control_center_code;
    els.controlCenterInput.readOnly = true;
    els.controlCenterInput.title = "Centro asignado por sesión. Solo SUPER_ADMIN puede cambiarlo.";
  } else if (state.sessionUser?.control_center_code && !els.controlCenterInput.value) {
    els.controlCenterInput.value = state.sessionUser.control_center_code;
  }
}

async function panelLogin() {
  const phone = els.loginPhoneInput.value.trim();
  const code = els.loginCodeInput.value.trim();
  els.loginError.textContent = "";

  if (!phone) {
    els.loginError.textContent = "Ingresa el teléfono del administrador.";
    return;
  }

  try {
    els.loginButton.disabled = true;
    els.loginButton.textContent = code ? "Validando..." : "Enviando código...";

    const res = await fetch(`${API}/auth/panel-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        panel_type: "ADMIN",
        code: code || undefined,
        channel: SOS_CONFIG.DEMO_MODE ? "demo" : undefined
      })
    });

    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "No fue posible ingresar");
    }

    if (data.requires_verification) {
      els.loginError.textContent = data.demo_code
        ? `Código demo: ${data.demo_code}`
        : `Código enviado por ${data.otp_channel || "SMS"}.`;
      els.loginCodeInput.focus();
      return;
    }

    setSession(data.token, data.user);
    showApp(data.user);
    await loadPlatformSettings();
    await loadBranding();
    await loadSirens();
    await loadPhysicalDevices();
    await loadUsers();
  } catch (error) {
    console.error(error);
    clearSession();
    els.loginError.textContent = error.message;
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = "Entrar";
  }
}

async function checkStoredSession() {
  const token = getSessionToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    const res = await fetch(`${API}/auth/session`, { headers: apiHeaders() });
    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "Sesión inválida");
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(data.user.role)) {
      throw new Error("Este panel requiere rol ADMIN o SUPER_ADMIN.");
    }

    showApp(data.user);
    await loadPlatformSettings();
    await loadBranding();
    await loadSirens();
    await loadPhysicalDevices();
    await loadUsers();
  } catch (error) {
    console.error(error);
    clearSession();
    showLogin(error.message);
  }
}

function logout() {
  clearSession();
  state.users = [];
  state.selectedUserId = null;
  state.selectedUser = null;
  state.detail = null;
  els.usersList.innerHTML = "";
  els.detailCard.innerHTML = `<div class="empty-state">Selecciona un usuario para ver su ficha, validar su registro o cambiar su rol.</div>`;
  showLogin("Sesión cerrada.");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  setTimeout(() => {
    els.toast.hidden = true;
  }, 3000);
}

function setConnection(online) {
  els.connectionStatus.textContent = online ? "online" : "offline";
  els.connectionStatus.classList.toggle("online", online);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function shortId(id) {
  return String(id || "").slice(0, 8).toUpperCase();
}

function currentControlCenterCode() {
  if (!isSuperAdmin() && state.sessionUser?.control_center_code) {
    return String(state.sessionUser.control_center_code).trim().toUpperCase();
  }
  return (els.controlCenterInput.value || state.sessionUser?.control_center_code || "CC-VINA").trim().toUpperCase() || "CC-VINA";
}

function adminSectionCards() {
  return {
    users: [els.userFiltersCard, els.createCard, els.usersContentGrid],
    platform: [els.platformConfigCard],
    sirens: [els.sirensAdminCard],
    devices: [els.physicalDevicesAdminCard]
  };
}

function setAdminSection(section) {
  state.activeAdminSection = section || "users";
  const cards = adminSectionCards();
  Object.entries(cards).forEach(([key, nodes]) => {
    nodes.forEach((node) => {
      if (!node) return;
      if (key === state.activeAdminSection) {
        if (node.id === "createCard" && !node.dataset.userOpened) node.hidden = true;
        else node.hidden = false;
      } else {
        node.hidden = true;
      }
    });
  });

  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === state.activeAdminSection);
  });
}

function setupAdminSections() {
  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => setAdminSection(button.dataset.section || "users"));
  });
  setAdminSection("users");
}

function updateSirenPolicyUi() {
  const sirensEnabled = boolValue("cfgSirens");
  [
    "cfgSirenAuto",
    "cfgSirenManual",
    "cfgSirenMode",
    "cfgSirenDefaultDuration",
    "cfgSirenMaxDuration",
    "cfgSirenCooldown",
    "saveSirenButton"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !sirensEnabled;
  });

  document.querySelectorAll("[data-siren-policy]").forEach((node) => {
    node.classList.toggle("disabled-pane", !sirensEnabled);
  });

  if (!sirensEnabled) {
    setBool("cfgSirenAuto", false);
    setBool("cfgSirenManual", false);
  }
}

function updateVoicePolicyUi() {
  const voiceEnabled = boolValue("cfgSecureVoice");
  ["cfgVoiceRecording", "cfgVoiceSupervision", "cfgVoiceExpires", "cfgVoiceMax"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !voiceEnabled;
  });
  document.querySelectorAll("[data-voice-policy]").forEach((node) => {
    node.classList.toggle("disabled-pane", !voiceEnabled);
  });
  if (!voiceEnabled) {
    setBool("cfgVoiceRecording", false);
    setBool("cfgVoiceSupervision", false);
  }
}

function updatePolicyDependencies() {
  updateSirenPolicyUi();
  updateVoicePolicyUi();
}

function boolValue(id) {
  return document.getElementById(id)?.checked === true;
}

function setBool(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value === true;
}

function numberValue(id, fallback) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function csvValue(id) {
  return String(document.getElementById(id)?.value || "")
    .split(",")
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);
}

function selectedNearbyCategories() {
  return csvValue("cfgNearbyCategories").filter(code => !BLOCKED_NEARBY_CATEGORIES.has(code));
}

function setNearbyCategories(categories = []) {
  const clean = [...new Set((categories || [])
    .map(item => String(item || "").trim().toUpperCase())
    .filter(Boolean)
    .filter(code => !BLOCKED_NEARBY_CATEGORIES.has(code)))];
  const input = document.getElementById("cfgNearbyCategories");
  if (input) input.value = clean.join(",");
  renderNearbyCategoryChips(clean);
}

function renderNearbyCategoryChips(selected = selectedNearbyCategories()) {
  if (!els.nearbyCategoryChips) return;
  const selectedSet = new Set(selected);
  els.nearbyCategoryChips.innerHTML = NOTIFIABLE_CATEGORIES.map(category => `
    <button type="button" class="category-chip ${selectedSet.has(category.code) ? "active" : ""}" data-category="${escapeHtml(category.code)}">
      ${selectedSet.has(category.code) ? "✓ " : ""}${escapeHtml(category.label)}
    </button>
  `).join("");
}

function toggleNearbyCategory(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || BLOCKED_NEARBY_CATEGORIES.has(normalized)) return;
  const selected = new Set(selectedNearbyCategories());
  if (selected.has(normalized)) selected.delete(normalized);
  else selected.add(normalized);
  setNearbyCategories([...selected]);
}

async function loadPlatformSettings() {
  if (!getSessionToken()) return;
  const code = currentControlCenterCode();
  try {
    els.settingsStatus.textContent = "Cargando configuración...";
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/settings`, {
      headers: apiHeaders()
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible cargar configuración");
    state.platformSettings = data.settings;
    renderPlatformSettings(data.settings);
    els.settingsStatus.textContent = `Configuración cargada · ${data.control_center?.name || code}`;
  } catch (error) {
    console.error(error);
    els.settingsStatus.textContent = error.message;
    toast(error.message);
  }
}

function renderPlatformSettings(settings = {}) {
  const f = settings.features || {};
  const sp = settings.siren_policy || {};
  const vp = settings.voice_policy || {};
  const np = settings.notification_policy || {};
  const ip = settings.incident_policy || {};
  const rp = settings.resolver_policy || {};
  const neighborApp = settings.neighbor_app || {};

  setBool("cfgMobileApp", f.mobile_app_enabled !== false);
  setBool("cfgResolverApp", f.resolver_app_enabled !== false);
  setBool("cfgPhysicalButtons", f.physical_sos_buttons_enabled !== false);
  setBool("cfgSirens", f.sirens_enabled !== false);
  setBool("cfgSecureVoice", f.secure_voice_enabled !== false);
  setBool("cfgMultiReports", f.multi_report_incidents_enabled !== false);
  setBool("cfgResolverAutoAssign", f.resolver_auto_assignment_enabled !== false);

  setBool("cfgSirenAuto", sp.auto_activate_on_ticket === true);
  setBool("cfgSirenManual", sp.operator_manual_control_enabled !== false);
  document.getElementById("cfgSirenMode").value = sp.activation_mode || "MANUAL_ONLY";
  document.getElementById("cfgSirenDefaultDuration").value = sp.default_duration_seconds ?? 60;
  document.getElementById("cfgSirenMaxDuration").value = sp.max_duration_seconds ?? 180;
  document.getElementById("cfgSirenCooldown").value = sp.cooldown_seconds ?? 120;

  setBool("cfgVoiceRecording", vp.recording_enabled === true);
  setBool("cfgVoiceSupervision", vp.supervision_enabled !== false);
  document.getElementById("cfgVoiceExpires").value = vp.expires_minutes ?? 15;
  document.getElementById("cfgVoiceMax").value = vp.max_call_minutes ?? 30;

  setBool("cfgNearbyNotifications", np.nearby_neighbor_notifications_enabled === true);
  document.getElementById("cfgNearbyRadius").value = np.radius_meters ?? 300;
  setNearbyCategories(np.categories || ["FIRE", "TRAFFIC_ACCIDENT", "URBAN_RISK"]);

  document.getElementById("cfgDedupRadius").value = ip.dedup_radius_meters ?? 120;
  document.getElementById("cfgDedupWindow").value = ip.dedup_window_minutes ?? 120;
  document.getElementById("cfgResolverGpsAge").value = rp.max_location_age_seconds ?? 180;
  renderNeighborCategories(neighborApp.emergency_categories || DEFAULT_NEIGHBOR_EMERGENCY_CATEGORIES);
  updatePolicyDependencies();
}

function collectPlatformSettings() {
  const sirensEnabled = boolValue("cfgSirens");
  const voiceEnabled = boolValue("cfgSecureVoice");

  return {
    features: {
      mobile_app_enabled: boolValue("cfgMobileApp"),
      resolver_app_enabled: boolValue("cfgResolverApp"),
      physical_sos_buttons_enabled: boolValue("cfgPhysicalButtons"),
      sirens_enabled: boolValue("cfgSirens"),
      secure_voice_enabled: boolValue("cfgSecureVoice"),
      multi_report_incidents_enabled: boolValue("cfgMultiReports"),
      resolver_auto_assignment_enabled: boolValue("cfgResolverAutoAssign")
    },
    siren_policy: {
      activation_mode: document.getElementById("cfgSirenMode").value,
      auto_activate_on_ticket: sirensEnabled && boolValue("cfgSirenAuto"),
      operator_manual_control_enabled: sirensEnabled && boolValue("cfgSirenManual"),
      default_duration_seconds: numberValue("cfgSirenDefaultDuration", 60),
      max_duration_seconds: numberValue("cfgSirenMaxDuration", 180),
      cooldown_seconds: numberValue("cfgSirenCooldown", 120),
      auto_categories: ["FIRE", "SECURITY"]
    },
    voice_policy: {
      recording_enabled: voiceEnabled && boolValue("cfgVoiceRecording"),
      supervision_enabled: voiceEnabled && boolValue("cfgVoiceSupervision"),
      expires_minutes: numberValue("cfgVoiceExpires", 15),
      max_call_minutes: numberValue("cfgVoiceMax", 30)
    },
    notification_policy: {
      nearby_neighbor_notifications_enabled: boolValue("cfgNearbyNotifications"),
      radius_meters: numberValue("cfgNearbyRadius", 300),
      categories: selectedNearbyCategories(),
      channels: ["PUSH"],
      privacy_mode: "SAFE_AREA_ONLY"
    },
    incident_policy: {
      dedup_enabled: boolValue("cfgMultiReports"),
      dedup_radius_meters: numberValue("cfgDedupRadius", 120),
      dedup_window_minutes: numberValue("cfgDedupWindow", 120)
    },
    resolver_policy: {
      auto_assignment_enabled: boolValue("cfgResolverAutoAssign"),
      max_location_age_seconds: numberValue("cfgResolverGpsAge", 180),
      max_active_tickets: 1
    },
    neighbor_app: {
      emergency_categories: collectNeighborCategories()
    }
  };
}

async function savePlatformSettings() {
  const code = currentControlCenterCode();
  try {
    els.saveSettingsButton.disabled = true;
    els.settingsStatus.textContent = "Guardando...";
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/settings`, {
      method: "PUT",
      headers: apiHeaders(),
      body: JSON.stringify({ settings: collectPlatformSettings() })
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible guardar configuración");
    state.platformSettings = data.settings;
    renderPlatformSettings(data.settings);
    els.settingsStatus.textContent = "Configuración guardada";
    toast("Configuración plataforma guardada");
  } catch (error) {
    console.error(error);
    els.settingsStatus.textContent = error.message;
    toast(error.message);
  } finally {
    els.saveSettingsButton.disabled = false;
  }
}


function setBrandPreview(img, value) {
  if (!img) return;
  if (value) {
    img.src = value;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
  }
}

function readImageAsDataUrl(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  if (!/^image\//.test(file.type || "")) {
    return Promise.reject(new Error("El archivo debe ser una imagen"));
  }
  if (file.size > 1024 * 1024) {
    return Promise.reject(new Error("El logo pesa más de 1 MB. Usa una versión más liviana o pega una URL https."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible leer el logo"));
    reader.readAsDataURL(file);
  });
}

function renderBranding(controlCenter = {}) {
  state.branding = controlCenter;
  if (els.municipalityLogoUrlInput) els.municipalityLogoUrlInput.value = controlCenter.municipality_logo_url || "";
  if (els.productLogoUrlInput) els.productLogoUrlInput.value = controlCenter.product_logo_url || "";
  if (els.brandPrimaryColorInput) els.brandPrimaryColorInput.value = controlCenter.brand_primary_color || "#0f5f8f";
  if (els.brandSecondaryColorInput) els.brandSecondaryColorInput.value = controlCenter.brand_secondary_color || "#16a34a";
  setBrandPreview(els.municipalityLogoPreview, controlCenter.municipality_logo_url);
  setBrandPreview(els.productLogoPreview, controlCenter.product_logo_url);
}

async function loadBranding() {
  if (!getSessionToken()) return;
  const code = currentControlCenterCode();
  try {
    if (els.brandingStatus) els.brandingStatus.textContent = "Cargando branding...";
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/branding`, { headers: apiHeaders() });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible cargar branding");
    renderBranding(data.control_center);
    if (els.brandingStatus) els.brandingStatus.textContent = `Branding cargado · ${data.control_center?.name || code}`;
  } catch (error) {
    console.error(error);
    if (els.brandingStatus) els.brandingStatus.textContent = error.message;
    toast(error.message);
  }
}

async function saveBranding() {
  const code = currentControlCenterCode();
  try {
    if (els.saveBrandingButton) els.saveBrandingButton.disabled = true;
    if (els.brandingStatus) els.brandingStatus.textContent = "Guardando branding...";

    const uploadedMunicipalityLogo = await readImageAsDataUrl(els.municipalityLogoFile);
    const uploadedProductLogo = await readImageAsDataUrl(els.productLogoFile);

    const payload = {
      municipality_logo_url: uploadedMunicipalityLogo || els.municipalityLogoUrlInput?.value?.trim() || "",
      product_logo_url: uploadedProductLogo || els.productLogoUrlInput?.value?.trim() || "",
      brand_primary_color: els.brandPrimaryColorInput?.value || "#0f5f8f",
      brand_secondary_color: els.brandSecondaryColorInput?.value || "#16a34a"
    };

    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/branding`, {
      method: "PUT",
      headers: apiHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible guardar branding");
    renderBranding(data.control_center);
    if (els.brandingStatus) els.brandingStatus.textContent = "Branding guardado";
    toast("Branding municipal guardado");
  } catch (error) {
    console.error(error);
    if (els.brandingStatus) els.brandingStatus.textContent = error.message;
    toast(error.message);
  } finally {
    if (els.saveBrandingButton) els.saveBrandingButton.disabled = false;
  }
}

async function loadSirens() {
  if (!getSessionToken()) return;
  const code = currentControlCenterCode();
  try {
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/sirens`, {
      headers: apiHeaders()
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible cargar sirenas");
    state.sirens = data.sirens || [];
    renderSirens();
  } catch (error) {
    console.error(error);
    toast(error.message);
  }
}

function renderSirens() {
  if (!state.sirens.length) {
    els.sirensList.innerHTML = `<div class="empty-state">Sin sirenas registradas para este centro.</div>`;
    return;
  }
  els.sirensList.innerHTML = state.sirens.map(siren => `
    <div class="user-row" onclick="editSiren('${escapeHtml(siren.id)}')">
      <div>
        <div class="user-name">${escapeHtml(siren.name || siren.id)}</div>
        <div class="user-meta">${escapeHtml(siren.id)} · ${escapeHtml(siren.location || "Sin ubicación textual")}</div>
        <div class="user-meta">GPS: ${escapeHtml(siren.latitude ?? "-")}, ${escapeHtml(siren.longitude ?? "-")} · ${siren.enabled === false ? "Deshabilitada" : "Habilitada"}</div>
      </div>
      <div class="badges"><span class="badge role-RESOLVER">${escapeHtml(siren.activation_mode || "MANUAL_ONLY")}</span></div>
    </div>
  `).join("");
}

window.editSiren = function editSiren(id) {
  const siren = state.sirens.find(item => String(item.id) === String(id));
  if (!siren) return;
  document.getElementById("sirenIdInput").value = siren.id || "";
  document.getElementById("sirenNameInput").value = siren.name || "";
  document.getElementById("sirenLatitudeInput").value = siren.latitude ?? "";
  document.getElementById("sirenLongitudeInput").value = siren.longitude ?? "";
  document.getElementById("sirenLocationInput").value = siren.location || "";
  document.getElementById("sirenEnabledInput").value = siren.enabled === false ? "false" : "true";
  document.getElementById("sirenActivationModeInput").value = siren.activation_mode || "MANUAL_ONLY";
  document.getElementById("sirenDefaultDurationInput").value = siren.default_duration_seconds ?? 60;
  document.getElementById("sirenMaxDurationInput").value = siren.max_duration_seconds ?? 180;
  document.getElementById("sirenCooldownInput").value = siren.cooldown_seconds ?? 120;
};

function clearSirenForm() {
  ["sirenIdInput", "sirenNameInput", "sirenLatitudeInput", "sirenLongitudeInput", "sirenLocationInput"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("sirenEnabledInput").value = "true";
  document.getElementById("sirenActivationModeInput").value = "MANUAL_ONLY";
  document.getElementById("sirenDefaultDurationInput").value = 60;
  document.getElementById("sirenMaxDurationInput").value = 180;
  document.getElementById("sirenCooldownInput").value = 120;
}

async function saveSiren() {
  const code = currentControlCenterCode();
  const payload = {
    id: document.getElementById("sirenIdInput").value.trim(),
    name: document.getElementById("sirenNameInput").value.trim(),
    latitude: document.getElementById("sirenLatitudeInput").value.trim(),
    longitude: document.getElementById("sirenLongitudeInput").value.trim(),
    location: document.getElementById("sirenLocationInput").value.trim(),
    enabled: document.getElementById("sirenEnabledInput").value === "true",
    activation_mode: document.getElementById("sirenActivationModeInput").value,
    default_duration_seconds: numberValue("sirenDefaultDurationInput", 60),
    max_duration_seconds: numberValue("sirenMaxDurationInput", 180),
    cooldown_seconds: numberValue("sirenCooldownInput", 120)
  };
  if (!payload.id || !payload.name) {
    toast("Código y nombre de sirena son obligatorios");
    return;
  }
  try {
    els.saveSirenButton.disabled = true;
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/sirens`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible guardar sirena");
    toast("Sirena guardada");
    await loadSirens();
  } catch (error) {
    console.error(error);
    toast(error.message);
  } finally {
    els.saveSirenButton.disabled = false;
  }
}

function deviceMetadata(device = {}) {
  return device.metadata && typeof device.metadata === "object" ? device.metadata : {};
}

async function loadPhysicalDevices() {
  if (!getSessionToken() || !els.devicesList) return;
  const code = currentControlCenterCode();
  try {
    els.devicesList.innerHTML = `<div class="empty-state">Cargando botones físicos...</div>`;
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/devices?type=PHYSICAL_SOS`, {
      headers: apiHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "Endpoint de botones físicos pendiente en API");
    }
    state.physicalDevices = data.devices || [];
    renderPhysicalDevices();
  } catch (error) {
    console.error(error);
    state.physicalDevices = [];
    els.devicesList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br><br>El mantenedor visual ya está listo; falta habilitar el endpoint admin de dispositivos si este mensaje persiste.</div>`;
  }
}

function renderPhysicalDevices() {
  if (!els.devicesList) return;
  if (!state.physicalDevices.length) {
    els.devicesList.innerHTML = `<div class="empty-state">Sin botones físicos registrados para este centro.</div>`;
    return;
  }
  els.devicesList.innerHTML = state.physicalDevices.map(device => {
    const meta = deviceMetadata(device);
    const enabled = meta.enabled !== false && device.status !== "DISABLED";
    const lat = device.last_latitude ?? meta.latitude ?? "-";
    const lon = device.last_longitude ?? meta.longitude ?? "-";
    return `
      <div class="user-row" onclick="editPhysicalDevice('${escapeHtml(device.id)}')">
        <div>
          <div class="user-name">${escapeHtml(device.name || device.id)}</div>
          <div class="user-meta">${escapeHtml(device.id)} · ${escapeHtml(device.type || "PHYSICAL_SOS")} · Flespi ${escapeHtml(device.platform_id || "-")}</div>
          <div class="user-meta">GPS: ${escapeHtml(lat)}, ${escapeHtml(lon)} · SIM ${escapeHtml(meta.sim_phone || "-")}</div>
          <div class="user-meta">Último heartbeat: ${formatDate(device.last_seen)} · ${escapeHtml(meta.registered_address || "Sin dirección")}</div>
        </div>
        <div class="badges"><span class="badge ${enabled ? "account-active" : "account-inactive"}">${enabled ? "Habilitado" : "Deshabilitado"}</span></div>
      </div>
    `;
  }).join("");
}

window.editPhysicalDevice = function editPhysicalDevice(id) {
  const device = state.physicalDevices.find(item => String(item.id) === String(id));
  if (!device) return;
  const meta = deviceMetadata(device);
  document.getElementById("deviceIdInput").value = device.id || "";
  document.getElementById("deviceNameInput").value = device.name || "";
  document.getElementById("deviceTypeInput").value = device.type || "PHYSICAL_SOS";
  document.getElementById("devicePlatformIdInput").value = device.platform_id || "";
  document.getElementById("deviceSimPhoneInput").value = meta.sim_phone || meta.phone || "";
  document.getElementById("deviceLatitudeInput").value = device.last_latitude ?? meta.latitude ?? "";
  document.getElementById("deviceLongitudeInput").value = device.last_longitude ?? meta.longitude ?? "";
  document.getElementById("deviceAddressInput").value = meta.registered_address || meta.address || "";
  document.getElementById("deviceEnabledInput").value = (meta.enabled === false || device.status === "DISABLED") ? "false" : "true";
  document.getElementById("deviceHeartbeatInput").value = meta.heartbeat_timeout_seconds ?? 600;
  document.getElementById("deviceNotesInput").value = meta.notes || "";
};

function clearPhysicalDeviceForm() {
  ["deviceIdInput", "deviceNameInput", "devicePlatformIdInput", "deviceSimPhoneInput", "deviceLatitudeInput", "deviceLongitudeInput", "deviceAddressInput", "deviceNotesInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("deviceTypeInput").value = "PHYSICAL_SOS";
  document.getElementById("deviceEnabledInput").value = "true";
  document.getElementById("deviceHeartbeatInput").value = 600;
}

async function savePhysicalDevice() {
  const code = currentControlCenterCode();
  const payload = {
    id: document.getElementById("deviceIdInput").value.trim(),
    name: document.getElementById("deviceNameInput").value.trim(),
    type: document.getElementById("deviceTypeInput").value,
    platform_id: document.getElementById("devicePlatformIdInput").value.trim(),
    last_latitude: document.getElementById("deviceLatitudeInput").value.trim(),
    last_longitude: document.getElementById("deviceLongitudeInput").value.trim(),
    status: document.getElementById("deviceEnabledInput").value === "true" ? "OFFLINE" : "DISABLED",
    metadata: {
      enabled: document.getElementById("deviceEnabledInput").value === "true",
      sim_phone: document.getElementById("deviceSimPhoneInput").value.trim(),
      registered_address: document.getElementById("deviceAddressInput").value.trim(),
      heartbeat_timeout_seconds: numberValue("deviceHeartbeatInput", 600),
      notes: document.getElementById("deviceNotesInput").value.trim()
    }
  };
  if (!payload.id || !payload.name) {
    toast("Código y nombre del botón físico son obligatorios");
    return;
  }
  try {
    els.saveDeviceButton.disabled = true;
    const res = await fetch(`${API}/admin/control-centers/${encodeURIComponent(code)}/devices`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") throw new Error(data.message || "No fue posible guardar botón físico");
    toast("Botón SOS físico guardado");
    await loadPhysicalDevices();
  } catch (error) {
    console.error(error);
    toast(error.message);
  } finally {
    els.saveDeviceButton.disabled = false;
  }
}

function userBadges(user) {
  return `
    <span class="badge role-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
    <span class="badge status-${escapeHtml(user.validation_status)}">${escapeHtml(user.validation_status || "-")}</span>
    <span class="badge ${user.is_active ? "account-active" : "account-inactive"}">${user.is_active ? "Activo" : "Inactivo"}</span>
  `;
}

function buildUsersUrl() {
  const params = new URLSearchParams();
  params.set("control_center_code", currentControlCenterCode());
  params.set("limit", "300");

  if (els.roleFilter.value !== "ALL") {
    params.set("role", els.roleFilter.value);
  }

  if (els.statusFilter.value !== "ALL") {
    params.set("validation_status", els.statusFilter.value);
  }

  const q = els.searchInput.value.trim();
  if (q) {
    params.set("q", q);
  }

  return `${API}/admin/users?${params.toString()}`;
}

async function loadUsers() {
  try {
    els.refreshButton.disabled = true;
    els.refreshButton.textContent = "Actualizando...";

    const res = await fetch(buildUsersUrl(), {
      headers: apiHeaders()
    });

    const data = await res.json();

    if (res.status === 401) {
      clearSession();
      showLogin(data.message || "Sesión expirada");
      return;
    }

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "No fue posible cargar usuarios");
    }

    state.users = data.users || [];
    state.usersPage = 1;
    renderUsers();
    setConnection(true);

  } catch (error) {
    console.error(error);
    setConnection(false);
    toast(error.message);
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.textContent = "Actualizar usuarios";
  }
}

function renderUsers() {
  const total = state.users.length;
  const pageSize = state.usersPageSize || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  state.usersPage = Math.min(Math.max(1, state.usersPage || 1), totalPages);
  const start = (state.usersPage - 1) * pageSize;
  const pageUsers = state.users.slice(start, start + pageSize);

  els.summaryLabel.textContent = `${total} usuario(s)`;

  if (!total) {
    els.usersList.innerHTML = `<div class="empty-state">No hay usuarios para los filtros seleccionados.</div>`;
  } else {
    els.usersList.innerHTML = pageUsers
      .map(user => `
        <div class="user-row ${state.selectedUserId === user.id ? "active" : ""}" onclick="selectUser('${escapeHtml(user.id)}')">
          <div>
            <div class="user-name">${escapeHtml(user.full_name || "Sin nombre")}</div>
            <div class="user-meta">📞 ${escapeHtml(user.phone || "-")} · ${escapeHtml(user.declared_address || "Sin dirección")}</div>
            <div class="user-meta">Tickets: ${user.tickets_count || 0} · Último: ${formatDate(user.last_ticket_at)}</div>
          </div>
          <div class="badges">${userBadges(user)}</div>
        </div>
      `)
      .join("");
  }

  if (els.userPagination) {
    els.userPagination.hidden = total <= pageSize;
  }
  if (els.pageInfo) {
    const end = total ? Math.min(total, start + pageUsers.length) : 0;
    els.pageInfo.textContent = total
      ? `Página ${state.usersPage} de ${totalPages} · ${start + 1}-${end} de ${total}`
      : "Sin usuarios";
  }
  if (els.pagePrevButton) els.pagePrevButton.disabled = state.usersPage <= 1;
  if (els.pageNextButton) els.pageNextButton.disabled = state.usersPage >= totalPages;
}


window.selectUser = async function selectUser(userId) {
  state.selectedUserId = userId;
  renderUsers();
  await loadUserDetail(userId);
};

async function loadUserDetail(userId) {
  try {
    els.detailCard.innerHTML = `<div class="empty-state">Cargando ficha...</div>`;

    const res = await fetch(`${API}/admin/users/${encodeURIComponent(userId)}`, {
      headers: apiHeaders()
    });

    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "No fue posible cargar ficha");
    }

    state.detail = data;
    state.selectedUser = data.user;
    renderDetail();

  } catch (error) {
    console.error(error);
    toast(error.message);
    els.detailCard.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderDetail() {
  const user = state.selectedUser;
  const contacts = state.detail.emergency_contacts || [];
  const tickets = state.detail.tickets || [];
  const resolverLocation = state.detail.resolver_location;

  els.detailCard.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-name">${escapeHtml(user.full_name || "Sin nombre")}</div>
        <div class="detail-subtitle">${escapeHtml(user.phone || "-")} · ${escapeHtml(user.control_center_code || "-")}</div>
      </div>
      <div class="badges">${userBadges(user)}</div>
    </div>

    <div class="detail-section">
      <h3>Acciones rápidas</h3>
      <div class="action-grid">
        <button class="success-button" onclick="updateValidation('VALIDATED')">Validar vecino</button>
        <button class="warning-button" onclick="updateValidation('PROVISIONAL_ACTIVE')">Provisional</button>
        <button class="danger-button" onclick="updateValidation('REJECTED')">Rechazar</button>
        <button class="secondary-button" onclick="setActive(${user.is_active ? "false" : "true"})">
          ${user.is_active ? "Suspender" : "Reactivar"}
        </button>
      </div>
      <div class="hint-text">Rechazar deja el usuario inactivo. Validar lo deja activo.</div>
    </div>

    <div class="detail-section">
      <h3>Ficha</h3>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">ID</div><div class="info-value">${escapeHtml(user.id)}</div></div>
        <div class="info-item"><div class="info-label">Rol</div><div class="info-value">${escapeHtml(user.role)}</div></div>
        <div class="info-item"><div class="info-label">RUT</div><div class="info-value">${escapeHtml(user.rut || "-")}</div></div>
        <div class="info-item"><div class="info-label">Email</div><div class="info-value">${escapeHtml(user.email || "-")}</div></div>
        <div class="info-item"><div class="info-label">Dirección</div><div class="info-value">${escapeHtml(user.declared_address || "-")}</div></div>
        <div class="info-item"><div class="info-label">GPS domicilio</div><div class="info-value">${escapeHtml(user.latitude || "-")}, ${escapeHtml(user.longitude || "-")}</div></div>
        <div class="info-item"><div class="info-label">Creado</div><div class="info-value">${formatDate(user.created_at)}</div></div>
        <div class="info-item"><div class="info-label">Actualizado</div><div class="info-value">${formatDate(user.updated_at)}</div></div>
      </div>
    </div>

    <div class="detail-section">
      <h3>Editar datos básicos</h3>
      <div class="edit-grid">
        <label>Nombre completo<input id="editFullName" value="${escapeHtml(user.full_name || "")}"></label>
        <label>RUT<input id="editRut" value="${escapeHtml(user.rut || "")}"></label>
        <label>Email<input id="editEmail" value="${escapeHtml(user.email || "")}"></label>
        <label>Dirección<input id="editAddress" value="${escapeHtml(user.declared_address || "")}"></label>
        <label>Latitud<input id="editLatitude" value="${escapeHtml(user.latitude || "")}"></label>
        <label>Longitud<input id="editLongitude" value="${escapeHtml(user.longitude || "")}"></label>
      </div>
      <div class="toolbar">
        <button onclick="saveBasicData()">Guardar datos</button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Rol operacional</h3>
      <div class="toolbar">
        <select id="roleSelect">
          ${roleOptions().map(role => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
        <button onclick="saveRole()">Cambiar rol</button>
      </div>
      ${resolverLocation ? `
        <div class="contact-card">
          <strong>Ubicación resolutor</strong><br>
          Estado: ${escapeHtml(resolverLocation.status)}<br>
          GPS: ${escapeHtml(resolverLocation.latitude)}, ${escapeHtml(resolverLocation.longitude)}<br>
          Actualizado: ${formatDate(resolverLocation.updated_at)}
        </div>
      ` : ""}
    </div>

    <div class="detail-section">
      <h3>Contactos de emergencia</h3>
      ${contacts.length ? contacts.map(c => `
        <div class="contact-card">
          <strong>${escapeHtml(c.name)}</strong><br>
          ${escapeHtml(c.relationship || "-")}<br>
          📞 ${escapeHtml(c.phone)}
        </div>
      `).join("") : `<div class="empty-state">Sin contactos registrados.</div>`}
    </div>

    <div class="detail-section">
      <h3>Historial de tickets</h3>
      ${tickets.length ? tickets.map(t => `
        <div class="ticket-card">
          <strong>${escapeHtml(t.title || t.alert_type || "Ticket")}</strong><br>
          Folio #${shortId(t.id)} · ${escapeHtml(t.state)} · ${escapeHtml(t.source_type || "-")}<br>
          ${formatDate(t.created_at)}
        </div>
      `).join("") : `<div class="empty-state">Sin tickets asociados.</div>`}
    </div>
  `;
}

window.updateValidation = async function updateValidation(validationStatus) {
  if (!state.selectedUserId) return;

  const label = validationStatus === "VALIDATED"
    ? "validar y activar"
    : validationStatus === "REJECTED"
      ? "rechazar e inactivar"
      : "actualizar";

  if (!confirm(`¿Confirmas ${label} este usuario?`)) return;

  await postAction(`/admin/users/${state.selectedUserId}/validation`, {
    validation_status: validationStatus
  });

  toast("Estado de validación actualizado");
  await refreshSelected();
};

window.setActive = async function setActive(isActive) {
  if (!state.selectedUserId) return;

  const action = isActive ? "reactivar" : "suspender";
  if (!confirm(`¿Confirmas ${action} este usuario?`)) return;

  await postAction(`/admin/users/${state.selectedUserId}/active`, {
    is_active: isActive
  });

  toast("Estado activo actualizado");
  await refreshSelected();
};

window.saveRole = async function saveRole() {
  if (!state.selectedUserId) return;
  const role = document.getElementById("roleSelect").value;

  if (!confirm(`¿Cambiar rol a ${role}?`)) return;

  await postAction(`/admin/users/${state.selectedUserId}/role`, { role });
  toast("Rol actualizado");
  await refreshSelected();
};

window.saveBasicData = async function saveBasicData() {
  if (!state.selectedUserId) return;

  const payload = {
    full_name: document.getElementById("editFullName").value.trim(),
    rut: document.getElementById("editRut").value.trim(),
    email: document.getElementById("editEmail").value.trim(),
    declared_address: document.getElementById("editAddress").value.trim(),
    latitude: parseNullableNumber(document.getElementById("editLatitude").value),
    longitude: parseNullableNumber(document.getElementById("editLongitude").value)
  };

  await postAction(`/admin/users/${state.selectedUserId}/update`, payload);
  toast("Datos actualizados");
  await refreshSelected();
};

function parseNullableNumber(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function postAction(path, payload) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || data.status !== "ok") {
    throw new Error(data.message || "No fue posible ejecutar la acción");
  }

  return data;
}

async function refreshSelected() {
  const selected = state.selectedUserId;
  await loadUsers();
  if (selected) {
    state.selectedUserId = selected;
    await loadUserDetail(selected);
    renderUsers();
  }
}

function getCreateFormPayload() {
  const contacts = [];

  const c1Name = document.getElementById("newContact1Name").value.trim();
  const c1Phone = document.getElementById("newContact1Phone").value.trim();
  const c1Rel = document.getElementById("newContact1Rel").value.trim();

  if (c1Name && c1Phone) {
    contacts.push({
      name: c1Name,
      phone: c1Phone,
      relationship: c1Rel || null,
      priority: 1
    });
  }

  const c2Name = document.getElementById("newContact2Name").value.trim();
  const c2Phone = document.getElementById("newContact2Phone").value.trim();
  const c2Rel = document.getElementById("newContact2Rel").value.trim();

  if (c2Name && c2Phone) {
    contacts.push({
      name: c2Name,
      phone: c2Phone,
      relationship: c2Rel || null,
      priority: 2
    });
  }

  return {
    control_center_code: currentControlCenterCode(),
    full_name: document.getElementById("newFullName").value.trim(),
    phone: document.getElementById("newPhone").value.trim(),
    role: document.getElementById("newRole").value,
    validation_status: document.getElementById("newValidationStatus").value,
    is_active: document.getElementById("newIsActive").value === "true",
    email: document.getElementById("newEmail").value.trim() || null,
    rut: document.getElementById("newRut").value.trim() || null,
    declared_address: document.getElementById("newAddress").value.trim() || null,
    latitude: parseNullableNumber(document.getElementById("newLatitude").value),
    longitude: parseNullableNumber(document.getElementById("newLongitude").value),
    emergency_contacts: contacts
  };
}

async function createUserFromForm() {
  try {
    const payload = getCreateFormPayload();

    if (!payload.full_name || !payload.phone) {
      toast("Nombre y teléfono son obligatorios");
      return;
    }

    els.createUserButton.disabled = true;
    els.createUserButton.textContent = "Guardando...";

    const data = await postAction("/admin/users", payload);

    toast(data.operation === "created" ? "Usuario creado" : "Usuario actualizado");
    clearCreateForm(false);
    await loadUsers();

    if (data.user?.id) {
      await selectUser(data.user.id);
    }
  } catch (error) {
    console.error(error);
    toast(error.message);
  } finally {
    els.createUserButton.disabled = false;
    els.createUserButton.textContent = "Crear / actualizar usuario";
  }
}

function clearCreateForm(showToast = true) {
  [
    "newFullName", "newPhone", "newEmail", "newRut", "newAddress",
    "newLatitude", "newLongitude", "newContact1Name", "newContact1Phone",
    "newContact1Rel", "newContact2Name", "newContact2Phone", "newContact2Rel"
  ].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("newRole").value = "NEIGHBOR";
  document.getElementById("newValidationStatus").value = "PROVISIONAL_ACTIVE";
  document.getElementById("newIsActive").value = "true";

  if (showToast) toast("Formulario limpio");
}

function parseBulkUsers(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));

  const users = [];

  for (const line of lines) {
    const separator = line.includes("\t")
      ? "\t"
      : line.includes(";")
        ? ";"
        : ",";

    const parts = line.split(separator).map(part => part.trim());

    if (parts[0]?.toLowerCase() === "nombre" || parts[0]?.toLowerCase() === "full_name") {
      continue;
    }

    const [full_name, phone, role, email, rut, declared_address] = parts;

    if (!full_name || !phone) {
      users.push({
        _invalid: true,
        full_name: full_name || "",
        phone: phone || "",
        reason: "Nombre y teléfono son obligatorios"
      });
      continue;
    }

    const cleanRole = (role || "RESOLVER").toUpperCase();
    const finalRole = ROLES.includes(cleanRole) ? cleanRole : "RESOLVER";

    users.push({
      control_center_code: currentControlCenterCode(),
      full_name,
      phone,
      role: finalRole,
      email: email || null,
      rut: rut || null,
      declared_address: declared_address || null,
      validation_status: finalRole === "NEIGHBOR" ? "PROVISIONAL_ACTIVE" : "VALIDATED",
      is_active: true,
      emergency_contacts: []
    });
  }

  return users;
}

async function bulkCreateUsers() {
  try {
    const parsed = parseBulkUsers(els.bulkUsersText.value);
    const invalid = parsed.filter(u => u._invalid);
    const users = parsed.filter(u => !u._invalid);

    if (!users.length) {
      toast("No hay usuarios válidos para cargar");
      return;
    }

    const ok = confirm(`Se crearán/actualizarán ${users.length} usuarios. ¿Continuar?`);
    if (!ok) return;

    els.bulkCreateButton.disabled = true;
    els.bulkCreateButton.textContent = "Cargando...";

    const res = await fetch(`${API}/admin/users/bulk`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ users })
    });

    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "No fue posible cargar usuarios");
    }

    renderBulkResult(data, invalid);
    toast(`Carga lista: ${data.created} creados, ${data.updated} actualizados, ${data.failed} fallidos`);
    await loadUsers();

  } catch (error) {
    console.error(error);
    toast(error.message);
  } finally {
    els.bulkCreateButton.disabled = false;
    els.bulkCreateButton.textContent = "Crear usuarios masivamente";
  }
}

function renderBulkResult(data, invalid = []) {
  const failed = (data.results || []).filter(r => r.status === "error");

  els.bulkResult.hidden = false;
  els.bulkResult.innerHTML = `
    <strong>Resultado carga</strong><br>
    Total procesados: ${data.total}<br>
    Creados: ${data.created}<br>
    Actualizados: ${data.updated}<br>
    Fallidos backend: ${data.failed}<br>
    Líneas inválidas locales: ${invalid.length}
    ${failed.length ? `
      <div class="error-list">
        ${failed.map(f => `Línea ${f.index + 1}: ${escapeHtml(f.message)}`).join("<br>")}
      </div>
    ` : ""}
    ${invalid.length ? `
      <div class="error-list">
        ${invalid.map((f, i) => `Línea inválida ${i + 1}: ${escapeHtml(f.reason)}`).join("<br>")}
      </div>
    ` : ""}
  `;
}

function loadBulkExample() {
  els.bulkUsersText.value = [
    "Juan Pérez,+56911111111,RESOLVER,juan.perez@municipio.cl,,Base Municipal",
    "María González,+56922222222,RESOLVER,maria.gonzalez@municipio.cl,,Base Municipal",
    "Operador Central 01,+56933333333,OPERATOR,operador01@municipio.cl,,Central Municipal",
    "Administrador Municipal,+56944444444,ADMIN,admin@municipio.cl,,Central Municipal"
  ].join("\n");
}

function applyRoleDefaults() {
  const role = document.getElementById("newRole").value;

  if (role === "NEIGHBOR") {
    document.getElementById("newValidationStatus").value = "PROVISIONAL_ACTIVE";
  } else {
    document.getElementById("newValidationStatus").value = "VALIDATED";
  }

  document.getElementById("newIsActive").value = "true";
}

els.refreshButton.addEventListener("click", loadUsers);
els.pendingButton.addEventListener("click", () => {
  els.roleFilter.value = "NEIGHBOR";
  els.statusFilter.value = "PROVISIONAL_ACTIVE";
  loadUsers();
});

els.toggleCreateButton.addEventListener("click", () => {
  els.createCard.dataset.userOpened = "true";
  setAdminSection("users");
  els.createCard.hidden = false;
  window.scrollTo({ top: els.createCard.offsetTop - 80, behavior: "smooth" });
});

els.closeCreateButton.addEventListener("click", () => {
  delete els.createCard.dataset.userOpened;
  els.createCard.hidden = true;
});

els.createUserButton.addEventListener("click", createUserFromForm);
els.clearCreateFormButton.addEventListener("click", () => clearCreateForm(true));
els.bulkCreateButton.addEventListener("click", bulkCreateUsers);
els.bulkExampleButton.addEventListener("click", loadBulkExample);
document.getElementById("newRole").addEventListener("change", applyRoleDefaults);

els.loginButton.addEventListener("click", panelLogin);
els.loginPhoneInput.addEventListener("keydown", event => {
  if (event.key === "Enter") panelLogin();
});
els.logoutButton.addEventListener("click", logout);
els.reloadSettingsButton.addEventListener("click", loadPlatformSettings);
els.saveSettingsButton.addEventListener("click", savePlatformSettings);
els.reloadBrandingButton?.addEventListener("click", loadBranding);
els.saveBrandingButton?.addEventListener("click", saveBranding);
els.municipalityLogoFile?.addEventListener("change", async () => {
  try { setBrandPreview(els.municipalityLogoPreview, await readImageAsDataUrl(els.municipalityLogoFile)); } catch (error) { toast(error.message); }
});
els.productLogoFile?.addEventListener("change", async () => {
  try { setBrandPreview(els.productLogoPreview, await readImageAsDataUrl(els.productLogoFile)); } catch (error) { toast(error.message); }
});
els.reloadSirensButton.addEventListener("click", loadSirens);
els.saveSirenButton.addEventListener("click", saveSiren);
els.clearSirenButton.addEventListener("click", clearSirenForm);
els.reloadDevicesButton?.addEventListener("click", loadPhysicalDevices);
els.saveDeviceButton?.addEventListener("click", savePhysicalDevice);
els.clearDeviceButton?.addEventListener("click", clearPhysicalDeviceForm);
els.nearbyCategoryChips?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (button) toggleNearbyCategory(button.dataset.category);
});


[els.roleFilter, els.statusFilter].forEach(el => {
  el.addEventListener("change", loadUsers);
});

els.controlCenterInput.addEventListener("change", async () => {
  await loadPlatformSettings();
  await loadBranding();
  await loadSirens();
  await loadPhysicalDevices();
  await loadUsers();
});

let searchTimer = null;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 400);
});

els.pagePrevButton?.addEventListener("click", () => {
  state.usersPage = Math.max(1, (state.usersPage || 1) - 1);
  renderUsers();
});

els.pageNextButton?.addEventListener("click", () => {
  state.usersPage = (state.usersPage || 1) + 1;
  renderUsers();
});

["cfgSirens", "cfgSecureVoice"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", updatePolicyDependencies);
});

setupAdminSections();
localStorage.removeItem("sos_admin_token");
checkStoredSession();
