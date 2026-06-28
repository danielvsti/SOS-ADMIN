const SOS_CONFIG = window.SOS_CONFIG || {};
const API = SOS_CONFIG.API_BASE || "https://sos.vsti.cl";

const state = {
  users: [],
  selectedUserId: null,
  selectedUser: null,
  detail: null,
  sessionUser: null
};

const els = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginPhoneInput: document.getElementById("loginPhoneInput"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),
  sessionUser: document.getElementById("sessionUser"),
  logoutButton: document.getElementById("logoutButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  controlCenterInput: document.getElementById("controlCenterInput"),
  roleFilter: document.getElementById("roleFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  adminTokenInput: document.getElementById("adminTokenInput"),
  saveTokenButton: document.getElementById("saveTokenButton"),
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
  bulkResult: document.getElementById("bulkResult")
};

const ROLES = ["NEIGHBOR", "RESOLVER", "OPERATOR", "ADMIN"];
const VALIDATION_STATUSES = [
  "PENDING_VERIFICATION",
  "PROVISIONAL_ACTIVE",
  "VALIDATED",
  "REJECTED",
  "SUSPENDED"
];

function getLegacyAdminToken() {
  return localStorage.getItem("sos_admin_token") || "";
}

function getSessionToken() {
  return localStorage.getItem("sos_admin_session_token") || "";
}

function setSession(token, user) {
  localStorage.setItem("sos_admin_session_token", token);
  localStorage.setItem("sos_admin_session_user", JSON.stringify(user || {}));
}

function clearSession() {
  localStorage.removeItem("sos_admin_session_token");
  localStorage.removeItem("sos_admin_session_user");
}

function apiHeaders() {
  const legacyToken = getLegacyAdminToken();
  const sessionToken = getSessionToken();
  return {
    "Content-Type": "application/json",
    ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {}),
    ...(legacyToken ? { "x-admin-token": legacyToken } : {})
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

function showApp(user) {
  state.sessionUser = user || state.sessionUser;
  els.loginView.hidden = true;
  els.appView.hidden = false;
  els.sessionUser.hidden = false;
  els.logoutButton.hidden = false;
  els.sessionUser.textContent = `${state.sessionUser?.full_name || "ADMIN"} · ${state.sessionUser?.role || "ADMIN"}`;
}

async function panelLogin() {
  const phone = els.loginPhoneInput.value.trim();
  els.loginError.textContent = "";

  if (!phone) {
    els.loginError.textContent = "Ingresa el teléfono del administrador.";
    return;
  }

  try {
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Entrando...";

    const res = await fetch(`${API}/auth/panel-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, panel_type: "ADMIN" })
    });

    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || "No fue posible ingresar");
    }

    setSession(data.token, data.user);
    showApp(data.user);
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

    if (data.user.role !== "ADMIN") {
      throw new Error("Este panel requiere rol ADMIN.");
    }

    showApp(data.user);
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

function userBadges(user) {
  return `
    <span class="badge role-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
    <span class="badge status-${escapeHtml(user.validation_status)}">${escapeHtml(user.validation_status || "-")}</span>
    <span class="badge ${user.is_active ? "account-active" : "account-inactive"}">${user.is_active ? "Activo" : "Inactivo"}</span>
  `;
}

function buildUsersUrl() {
  const params = new URLSearchParams();
  params.set("control_center_code", els.controlCenterInput.value.trim() || "CC-VINA");
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
  els.summaryLabel.textContent = `${state.users.length} usuario(s)`;

  if (!state.users.length) {
    els.usersList.innerHTML = `<div class="empty-state">No hay usuarios para los filtros seleccionados.</div>`;
    return;
  }

  els.usersList.innerHTML = state.users
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
          ${ROLES.map(role => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
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
    control_center_code: els.controlCenterInput.value.trim() || "CC-VINA",
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
      control_center_code: els.controlCenterInput.value.trim() || "CC-VINA",
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
  els.createCard.hidden = false;
  window.scrollTo({ top: els.createCard.offsetTop - 80, behavior: "smooth" });
});

els.closeCreateButton.addEventListener("click", () => {
  els.createCard.hidden = true;
});

els.createUserButton.addEventListener("click", createUserFromForm);
els.clearCreateFormButton.addEventListener("click", () => clearCreateForm(true));
els.bulkCreateButton.addEventListener("click", bulkCreateUsers);
els.bulkExampleButton.addEventListener("click", loadBulkExample);
document.getElementById("newRole").addEventListener("change", applyRoleDefaults);

els.saveTokenButton.addEventListener("click", () => {
  localStorage.setItem("sos_admin_token", els.adminTokenInput.value.trim());
  toast("Token técnico guardado localmente");
});

els.loginButton.addEventListener("click", panelLogin);
els.loginPhoneInput.addEventListener("keydown", event => {
  if (event.key === "Enter") panelLogin();
});
els.logoutButton.addEventListener("click", logout);

[els.roleFilter, els.statusFilter, els.controlCenterInput].forEach(el => {
  el.addEventListener("change", loadUsers);
});

let searchTimer = null;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 400);
});

els.adminTokenInput.value = getLegacyAdminToken();
checkStoredSession();
