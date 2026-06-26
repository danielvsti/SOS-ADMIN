const API = "https://sos.vsti.cl";

const state = {
  users: [],
  selectedUserId: null,
  selectedUser: null,
  detail: null
};

const els = {
  connectionStatus: document.getElementById("connectionStatus"),
  controlCenterInput: document.getElementById("controlCenterInput"),
  roleFilter: document.getElementById("roleFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  adminTokenInput: document.getElementById("adminTokenInput"),
  saveTokenButton: document.getElementById("saveTokenButton"),
  refreshButton: document.getElementById("refreshButton"),
  pendingButton: document.getElementById("pendingButton"),
  summaryLabel: document.getElementById("summaryLabel"),
  usersList: document.getElementById("usersList"),
  detailCard: document.getElementById("detailCard"),
  toast: document.getElementById("toast")
};

const ROLES = ["NEIGHBOR", "RESOLVER", "OPERATOR", "ADMIN"];
const VALIDATION_STATUSES = [
  "PENDING_VERIFICATION",
  "PROVISIONAL_ACTIVE",
  "VALIDATED",
  "REJECTED",
  "SUSPENDED"
];

function getAdminToken() {
  return localStorage.getItem("sos_admin_token") || "";
}

function apiHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-admin-token": token } : {})
  };
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
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
    <span class="badge">${user.is_active ? "Activo" : "Inactivo"}</span>
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
    ? "validar"
    : validationStatus === "REJECTED"
      ? "rechazar"
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

els.refreshButton.addEventListener("click", loadUsers);
els.pendingButton.addEventListener("click", () => {
  els.roleFilter.value = "NEIGHBOR";
  els.statusFilter.value = "PROVISIONAL_ACTIVE";
  loadUsers();
});

els.saveTokenButton.addEventListener("click", () => {
  localStorage.setItem("sos_admin_token", els.adminTokenInput.value.trim());
  toast("Token guardado localmente");
});

[els.roleFilter, els.statusFilter, els.controlCenterInput].forEach(el => {
  el.addEventListener("change", loadUsers);
});

let searchTimer = null;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 400);
});

els.adminTokenInput.value = getAdminToken();
loadUsers();
