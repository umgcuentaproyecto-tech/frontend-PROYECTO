let LOCAL_SWIFT = 'GTBC6968'; // Valor por defecto, se actualizará desde el servidor

const API_CONFIG = {
    baseURL: window.__API_BASE_URL__ || '',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
};

class ApiClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
        this.headers = { ...config.headers };
        this.token = null;
    }

    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            // Obtener el token fresco del localStorage en cada solicitud
            const token = obtenerToken();
            const headers = {
                ...this.headers,
                ...(options.headers || {})
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    setToken(token) {
        this.token = token;
    }

    clearToken() {
        this.token = null;
    }
}

const apiClient = new ApiClient(API_CONFIG);

async function handleLoginSubmit(event) {
    event.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value;
    const recordar = document.getElementById('recordar').checked;
    const loginForm = document.getElementById('loginForm');
    const loginBtn = loginForm.querySelector('.btn-login');

    ocultarError();

    if (!usuario || !contrasena) {
        mostrarError('Por favor completa todos los campos');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading-spinner"></span> Verificando...';

    try {
        const response = await loginWithApi(usuario, contrasena);

        guardarToken(response.token);
        guardarEnLocalStorage('currentUser', response.user);

        if (recordar) {
            guardarEnLocalStorage('usuarioRecordado', usuario);
        } else {
            eliminarDelLocalStorage('usuarioRecordado');
        }

        mostrarExito('Bienvenido. Cargando menu principal...');
        setTimeout(() => {
            window.location.href = './modulos/dashboard.html';
        }, 900);
    } catch (error) {
        mostrarError(error.message || 'Error al iniciar sesion');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesion';
    }
}

async function loginWithApi(usuario, contrasena) {
    return await apiClient.post('/api/auth/login', { usuario, contrasena });
}

function initDashboard() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderMainMenu(user);
}

function initUsersModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (user.rol !== 'ADMIN') {
        mostrarAccesoDenegado();
        return;
    }

    renderUsersModule();
    loadUsers();
}

function initTransfersModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (!['ADMIN', 'OPERADOR'].includes(user.rol)) {
        mostrarAccesoDenegadoTransferencias();
        return;
    }

    renderTransfersModule();
    loadTransferConfig();
    loadTransferCatalogs();
    loadTransfers();
}

function initRetiroDespositoModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (!['ADMIN', 'OPERADOR', 'FINANZAS'].includes(user.rol)) {
        mostrarAccesoDenegado();
        return;
    }

    renderRetiroDespositoModule();
    loadAccountsForTransaction();
}

function initRetiroDespositoModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (!['ADMIN', 'OPERADOR', 'FINANZAS'].includes(user.rol)) {
        mostrarAccesoDenegado();
        return;
    }

    renderRetiroDespositoModule();
    loadAccountsForTransaction();
}

function renderRetiroDespositoModule() {
    const moduleRoot = document.getElementById('retiroDespositoModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <h2>Registrar Retiro o Depósito</h2>
            </div>

            <form id="transactionForm" class="admin-form">
                <div class="form-grid transfer-form-grid">
                    <div class="form-group">
                        <label for="tipoOperacion">Tipo de Operación</label>
                        <select id="tipoOperacion" required>
                            <option value="">Seleccione operación</option>
                            <option value="RETIRO">Retiro</option>
                            <option value="DEPOSITO">Depósito</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="cuentaOperacion">Cuenta</label>
                        <select id="cuentaOperacion" required>
                            <option value="">Seleccione cuenta</option>
                        </select>
                        <p id="cuentaResumen" class="field-help">Seleccione una cuenta para ver los detalles.</p>
                    </div>
                    <div class="form-group">
                        <label for="montoOperacion">Monto</label>
                        <input type="number" id="montoOperacion" min="0.01" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group form-grid-wide">
                        <label for="referencia">Referencia/Descripción</label>
                        <input type="text" id="referencia" placeholder="Motivo del retiro o depósito">
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Registrar Operación</button>
                    <button type="button" id="clearTransactionBtn" class="btn-secondary">Limpiar</button>
                </div>
            </form>
        </section>

        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Historial de Retiros y Depósitos</h2>
                    <p>Últimas operaciones realizadas.</p>
                </div>
                <button type="button" id="refreshTransactionsBtn" class="btn-secondary">Actualizar</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Cuenta</th>
                            <th>Tipo</th>
                            <th>Monto</th>
                            <th>Referencia</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="transactionsTableBody">
                        <tr><td colspan="6">Cargando historial...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('transactionForm').addEventListener('submit', saveTransaction);
    document.getElementById('clearTransactionBtn').addEventListener('click', resetTransactionForm);
    document.getElementById('refreshTransactionsBtn').addEventListener('click', loadTransactions);
    document.getElementById('cuentaOperacion').addEventListener('change', showAccountDetails);
}

async function loadAccountsForTransaction() {
    try {
        const response = await apiClient.get('/api/cuentas');
        const accounts = response.data || [];
        guardarEnLocalStorage('accountsForTransaction', accounts);
        renderAccountsSelectTransaction(accounts);
        loadTransactions();
    } catch (error) {
        showNotification('Error al cargar cuentas', 'error');
    }
}

function renderAccountsSelectTransaction(accounts) {
    const select = document.getElementById('cuentaOperacion');
    if (!select) return;

    const activeCuentas = accounts.filter(a => a.estado === 'ACTIVA');
    select.innerHTML = '<option value="">Seleccione cuenta</option>' + 
        activeCuentas.map(a => `
            <option value="${a.id_cuenta}" data-saldo="${a.saldo}" data-numero="${a.numero_cuenta}">
                ${a.numero_cuenta} - ${a.nombre_cliente}
            </option>
        `).join('');
}

function showAccountDetails() {
    const select = document.getElementById('cuentaOperacion');
    const resumenElement = document.getElementById('cuentaResumen');
    
    if (!select.value) {
        resumenElement.textContent = 'Seleccione una cuenta para ver los detalles.';
        return;
    }

    const accounts = obtenerDelLocalStorage('accountsForTransaction') || [];
    const account = accounts.find(a => a.id_cuenta == select.value);
    
    if (account) {
        resumenElement.textContent = `${account.nombre_cliente} - Saldo: ${formatMoney(account.saldo, account.moneda)} - Estado: ${account.estado}`;
    }
}

async function saveTransaction(event) {
    event.preventDefault();

    const tipoOperacion = document.getElementById('tipoOperacion').value;
    const cuentaId = document.getElementById('cuentaOperacion').value;
    const monto = parseFloat(document.getElementById('montoOperacion').value);
    const referencia = document.getElementById('referencia').value.trim() || 'Sin referencia';

    if (!tipoOperacion || !cuentaId || !monto || monto <= 0) {
        showNotification('Completa todos los campos correctamente', 'error');
        return;
    }

    const accounts = obtenerDelLocalStorage('accountsForTransaction') || [];
    const account = accounts.find(a => a.id_cuenta == cuentaId);

    if (!account) {
        showNotification('Cuenta no encontrada', 'error');
        return;
    }

    // Validar saldo para retiros
    if (tipoOperacion === 'RETIRO' && account.saldo < monto) {
        showNotification('Saldo insuficiente para realizar este retiro', 'error');
        return;
    }

    try {
        const response = await apiClient.post('/api/transacciones', {
            id_cuenta: cuentaId,
            tipo: tipoOperacion,
            monto: monto,
            referencia: referencia
        });

        showNotification(`${tipoOperacion === 'RETIRO' ? 'Retiro' : 'Depósito'} registrado exitosamente`, 'success');
        resetTransactionForm();
        loadAccountsForTransaction();
        loadTransactions();
    } catch (error) {
        showNotification(error.message || 'Error al registrar operación', 'error');
    }
}

function resetTransactionForm() {
    document.getElementById('transactionForm').reset();
    document.getElementById('cuentaResumen').textContent = 'Seleccione una cuenta para ver los detalles.';
}

async function loadTransactions() {
    try {
        const response = await apiClient.get('/api/transacciones');
        const transactions = response.data || [];
        guardarEnLocalStorage('transactionsCache', transactions);
        renderTransactionsTable(transactions);
    } catch (error) {
        showNotification('Error al cargar historial', 'error');
    }
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No hay transacciones registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map((transaction) => `
        <tr>
            <td>${new Date(transaction.created_at).toLocaleDateString('es-ES')} ${new Date(transaction.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</td>
            <td>${transaction.numero_cuenta}</td>
            <td><span class="role-badge" style="background: ${transaction.tipo === 'RETIRO' ? '#e74c3c' : '#27ae60'}">${transaction.tipo}</span></td>
            <td>${formatMoney(transaction.monto, transaction.moneda)}</td>
            <td>${transaction.referencia}</td>
            <td><span class="status-badge status-aprobada">Completada</span></td>
        </tr>
    `).join('');
}

function initClientesModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (!['ADMIN', 'OPERADOR'].includes(user.rol)) {
        mostrarAccesoDenegado();
        return;
    }

    renderClientesModule();
    loadClients();
}

function initCuentasModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);

    if (!['ADMIN', 'OPERADOR'].includes(user.rol)) {
        mostrarAccesoDenegado();
        return;
    }

    renderCuentasModule();
    loadAccounts();
    
    // Verificar si viene de crear un cliente
    const clientIdToCreateAccount = obtenerDelLocalStorage('clientIdToCreateAccount');
    if (clientIdToCreateAccount) {
        localStorage.removeItem('clientIdToCreateAccount');
        setTimeout(() => {
            openAccountModalWithClient(clientIdToCreateAccount);
        }, 500);
    }
}

function renderMainMenu(user) {
    const menu = document.getElementById('mainMenu');
    if (!menu) return;

    const modules = [
        {
            title: 'Administracion de usuarios',
            description: 'Crear usuarios internos, asignar roles y controlar accesos.',
            href: '/modulos/usuarios.html',
            roles: ['ADMIN'],
            status: 'Disponible'
        },
        {
            title: 'Clientes',
            description: 'Registro y mantenimiento de clientes bancarios.',
            href: '/modulos/clientes.html',
            roles: ['ADMIN', 'OPERADOR'],
            status: 'Disponible'
        },
        {
            title: 'Cuentas bancarias',
            description: 'Apertura de cuentas, consulta de saldos y estados.',
            href: '/modulos/cuentas.html',
            roles: ['ADMIN', 'OPERADOR'],
            status: 'Disponible'
        },
        {
            title: 'Retiros y Depósitos',
            description: 'Realice retiros o depósitos en cuentas internas o externas.',
            href: '/modulos/retiros-depositos.html',
            roles: ['ADMIN', 'OPERADOR'],
            status: 'Disponible'
        },
        {
            title: 'Transferencias',
            description: 'Operaciones locales e interbancarias con estado de aprobacion.',
            href: '/modulos/transferencias.html',
            roles: ['ADMIN', 'OPERADOR'],
            status: 'Disponible'
        },
        {
            title: 'Configuración de Bancos',
            description: 'Gestiona datos de los bancos participantes en la red interbancaria.',
            href: '/modulos/bancos.html',
            roles: ['ADMIN'],
            status: 'Disponible'
        },
        {
            title: 'Finanzas',
            description: 'Reportes financieros, conciliaciones y saldos generales.',
            href: '/modulos/finanzas.html',
            roles: ['ADMIN', 'FINANZAS'],
            status: 'Disponible'
        }
    ];

    menu.innerHTML = modules.map((module) => {
        const allowed = module.roles.includes(user.rol);
        const href = allowed ? module.href : '#';
        return `
            <a class="module-card ${allowed ? '' : 'module-card-disabled'}" href="${href}" data-allowed="${allowed}">
                <span class="module-status">${allowed ? module.status : 'Sin acceso'}</span>
                <h3>${module.title}</h3>
                <p>${module.description}</p>
            </a>
        `;
    }).join('');

    menu.querySelectorAll('[data-allowed="false"]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            showNotification('No tiene permisos para acceder a este modulo', 'error');
        });
    });
}

function renderUsersModule() {
    const moduleRoot = document.getElementById('usersModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Administracion de usuarios</h2>
                    <p>Solo el rol ADMIN puede crear, editar y consultar usuarios internos.</p>
                </div>
            </div>

            <form id="userForm" class="admin-form">
                <input type="hidden" id="editingUserId">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="nombre">Nombre</label>
                        <input type="text" id="nombre" required placeholder="Nombre del usuario">
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" required placeholder="usuario@banco.local">
                    </div>
                    <div class="form-group" id="passwordGroup">
                        <label for="password">Contraseña</label>
                        <input type="password" id="password" placeholder="Contraseña inicial (solo al crear)">
                        <small>Se requiere contraseña al crear un nuevo usuario</small>
                    </div>
                    <div class="form-group">
                        <label for="rol">Rol</label>
                        <select id="rol">
                            <option value="NUEVO_USUARIO">NUEVO_USUARIO</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="OPERADOR">OPERADOR</option>
                            <option value="FINANZAS">FINANZAS</option>
                            <option value="AUDITOR">AUDITOR</option>
                        </select>
                    </div>
                    <label class="toggle-row">
                        <input type="checkbox" id="activo" checked>
                        <span>Usuario activo</span>
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Guardar usuario</button>
                    <button type="button" id="cancelEditBtn" class="btn-secondary">Limpiar</button>
                </div>
            </form>
        </section>

        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Usuarios registrados</h2>
                    <p>Listado de personal interno y rol asignado.</p>
                </div>
                <button type="button" id="refreshUsersBtn" class="btn-secondary">Actualizar</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr><td colspan="5">Cargando usuarios...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('userForm').addEventListener('submit', saveUser);
    document.getElementById('cancelEditBtn').addEventListener('click', resetUserForm);
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5">Cargando usuarios...</td></tr>';

    try {
        const response = await apiClient.get('/api/users');
        const users = response.data || [];
        guardarEnLocalStorage('usersCache', users);
        renderUsersTable(users);
    } catch (error) {
        const users = obtenerDelLocalStorage('usersCache') || [];
        renderUsersTable(users);
        showNotification('Error al cargar usuarios. ' + error.message, 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay usuarios registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((user) => `
        <tr>
            <td>${user.nombre}</td>
            <td>${user.email}</td>
            <td><span class="role-badge">${user.rol}</span></td>
            <td>${user.activo ? 'Activo' : 'Inactivo'}</td>
            <td>
                <button type="button" class="table-action" data-edit="${user.id_usuario}">Editar</button>
                <button type="button" class="table-action" data-change-password="${user.id_usuario}">Contraseña</button>
                <button type="button" class="table-action table-action-danger" data-delete="${user.id_usuario}">Eliminar</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.edit);
            const selectedUser = users.find((user) => Number(user.id_usuario) === id);
            if (selectedUser) {
                fillUserForm(selectedUser);
            }
        });
    });

    tbody.querySelectorAll('[data-change-password]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.changePassword);
            const selectedUser = users.find((user) => Number(user.id_usuario) === id);
            if (selectedUser) {
                openChangePasswordDialog(selectedUser);
            }
        });
    });

    tbody.querySelectorAll('[data-delete]').forEach((button) => {
        button.addEventListener('click', () => {
            const id = Number(button.dataset.delete);
            showConfirmModal('Confirmar', '¿Está seguro?', () => {
                deleteUser(id);
            });
        });
    });
    
    // Reinicializar redimensionamiento de columnas
    setTimeout(() => {
        initResizableColumns();
    }, 50);
}

async function saveUser(event) {
    event.preventDefault();

    const id = document.getElementById('editingUserId').value;
    const password = document.getElementById('password').value.trim();
    const data = {
        nombre: document.getElementById('nombre').value.trim(),
        email: document.getElementById('email').value.trim(),
        rol: document.getElementById('rol').value,
        activo: document.getElementById('activo').checked
    };

    if (!data.nombre || !data.email) {
        showNotification('Nombre y email son requeridos', 'error');
        return;
    }

    // Si se está creando un nuevo usuario, requiere contraseña
    if (!id && !password) {
        showNotification('La contraseña es requerida al crear un nuevo usuario', 'error');
        return;
    }

    // Si hay contraseña, incluirla en el objeto de datos
    if (password) {
        data.password_hash = password;
    }

    try {
        if (id) {
            await apiClient.put(`/api/users/${id}`, data);
            showNotification('Usuario actualizado', 'success');
        } else {
            await apiClient.post('/api/users', data);
            showNotification('Usuario creado', 'success');
        }

        resetUserForm();
        loadUsers();
    } catch (error) {
        showNotification(error.message || 'No se pudo guardar el usuario', 'error');
    }
}

function fillUserForm(user) {
    document.getElementById('editingUserId').value = user.id_usuario;
    document.getElementById('nombre').value = user.nombre;
    document.getElementById('email').value = user.email;
    document.getElementById('rol').value = user.rol;
    document.getElementById('activo').checked = Boolean(user.activo);
    
    // Ocultar campo de contraseña cuando se edita un usuario existente
    const passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'none';
    }
}

function resetUserForm() {
    const form = document.getElementById('userForm');
    if (form) form.reset();
    document.getElementById('editingUserId').value = '';
    document.getElementById('rol').value = 'NUEVO_USUARIO';
    document.getElementById('activo').checked = true;
    
    // Mostrar campo de contraseña cuando se reinicia el formulario
    const passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'block';
    }
}

async function deleteUser(id) {
    try {
        await apiClient.delete(`/api/users/${id}`);
        showNotification('Usuario eliminado', 'success');
        loadUsers();
    } catch (error) {
        showNotification(error.message || 'No se pudo eliminar el usuario', 'error');
    }
}

function openChangePasswordDialog(user) {
    const dialogHTML = `
        <div class="modal-overlay" id="changePasswordModal">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>Cambiar contraseña</h3>
                    <button type="button" class="modal-close" id="closeChangePasswordBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Cambiar contraseña para: <strong>${user.nombre}</strong></p>
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label for="newPassword">Nueva contraseña</label>
                            <input type="password" id="newPassword" required placeholder="Ingrese la nueva contraseña">
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Confirmar contraseña</label>
                            <input type="password" id="confirmPassword" required placeholder="Confirme la nueva contraseña">
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn-primary">Cambiar contraseña</button>
                            <button type="button" class="btn-secondary" id="cancelChangePasswordBtn">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const container = document.body;
    container.insertAdjacentHTML('beforeend', dialogHTML);

    const modal = document.getElementById('changePasswordModal');
    const form = document.getElementById('changePasswordForm');
    const closeBtn = document.getElementById('closeChangePasswordBtn');
    const cancelBtn = document.getElementById('cancelChangePasswordBtn');

    function closeModal() {
        modal.remove();
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        if (!newPassword || !confirmPassword) {
            showNotification('Todos los campos son requeridos', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        try {
            await apiClient.post(`/api/users/${user.id_usuario}/change-password`, {
                password: newPassword
            });
            showNotification('Contraseña cambida exitosamente', 'success');
            closeModal();
            loadUsers();
        } catch (error) {
            showNotification(error.message || 'No se pudo cambiar la contraseña', 'error');
        }
    });

    // Cerrar modal al hacer clic fuera de él
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

function renderTransfersModule() {
    const moduleRoot = document.getElementById('transfersModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Nueva transferencia</h2>
                </div>
                <span id="localSwiftBadge" class="role-badge">SWIFT local</span>
            </div>

            <form id="transferForm" class="admin-form">
                <div class="form-grid transfer-form-grid">
                    <div class="form-group">
                        <label for="cuentaOrigen">Cuenta origen</label>
                        <select id="cuentaOrigen" required>
                            <option value="">Seleccione cuenta origen</option>
                        </select>
                        <p id="cuentaOrigenResumen" class="field-help">Seleccione una cuenta para ver los detalles.</p>
                    </div>
                    <div class="form-group">
                        <label for="swiftDestino">Banco destino</label>
                        <select id="swiftDestino" required>
                            <option value="">Seleccione banco destino</option>
                        </select>
                    </div>
                    <div class="form-group" id="cuentaDestinoManualGroup">
                        <label for="cuentaDestino">Cuenta destino</label>
                        <input type="text" id="cuentaDestino" required placeholder="Numero de cuenta destino">
                        <p id="cuentaDestinoValidacion" class="field-help">Ingrese la cuenta de destino</p>
                        <button type="button" id="validateAccountBtn" class="btn-info hidden" style="margin-top: 8px; width: 100%;">Validar Cuenta</button>
                    </div>
                    <div class="form-group hidden" id="cuentaDestinoLocalGroup">
                        <label for="cuentaDestinoSearch">Buscar cuenta destino</label>
                        <input type="text" id="cuentaDestinoSearch" placeholder="Buscar por cuenta o cliente">
                        <div id="cuentaDestinoLocalList" class="account-results"></div>
                    </div>
                    <div class="form-group hidden" id="cuentaDestinoSeleccionadaGroup">
                        <label for="cuentaDestinoSeleccionada">Cuenta destino seleccionada</label>
                        <input type="text" id="cuentaDestinoSeleccionada" readonly placeholder="Seleccione una cuenta del listado">
                        <p id="cuentaDestinoResumen" class="field-help">Seleccione una cuenta para ver los detalles.</p>
                    </div>
                    <div class="form-group">
                        <label for="monto">Monto</label>
                        <input type="number" id="monto" min="0.01" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group form-grid-wide">
                        <label for="descripcion">Descripcion</label>
                        <input type="text" id="descripcion" placeholder="Motivo o referencia de la transferencia">
                    </div>
                </div>
                
                <div id="validacionCuentaResult" class="validation-result hidden"></div>
                <input type="hidden" id="accountValidated" value="false">
                
                <div class="form-actions">
                    <button type="submit" class="btn-primary" disabled>Registrar transferencia</button>
                    <button type="button" id="clearTransferBtn" class="btn-secondary">Limpiar</button>
                </div>
            </form>
        </section>

        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Historial de transferencias</h2>
                    <p>Estados:APROBADA o RECHAZADA.</p>
                </div>
                <button type="button" id="refreshTransfersBtn" class="btn-secondary">Actualizar</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transaccion</th>
                            <th>Origen</th>
                            <th>Destino</th>
                            <th>Banco destino</th>
                            <th>Monto</th>
                            <th>Descripcion</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="transfersTableBody">
                        <tr><td colspan="7">Cargando transferencias...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Modal de validación de cuenta -->
        <div id="accountValidationModal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✅ Cuenta Validada</h3>
                    <button type="button" class="modal-close" onclick="document.getElementById('accountValidationModal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="validation-details">
                        <div class="detail-row">
                            <span class="detail-label">Número de Cuenta:</span>
                            <span class="detail-value" id="modalNumeroCuenta">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Nombre del Cliente:</span>
                            <span class="detail-value" id="modalNombreCliente">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Banco:</span>
                            <span class="detail-value" id="modalBanco">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Tipo de Cuenta:</span>
                            <span class="detail-value" id="modalTipoCuenta">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Estado:</span>
                            <span class="detail-value" id="modalEstado">-</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="document.getElementById('accountValidationModal').classList.add('hidden')">Continuar</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('transferForm').addEventListener('submit', saveTransfer);
    document.getElementById('validateAccountBtn').addEventListener('click', validateExternalAccount);
    document.getElementById('clearTransferBtn').addEventListener('click', resetTransferForm);
    document.getElementById('refreshTransfersBtn').addEventListener('click', loadTransfers);
    document.getElementById('swiftDestino').addEventListener('change', function() {
        updateDestinationAccountMode();
        clearValidationState();
    });
    document.getElementById('cuentaDestinoSearch').addEventListener('input', filterDestinationAccounts);
    document.getElementById('cuentaDestino').addEventListener('change', clearValidationState);
    document.getElementById('cuentaOrigen').addEventListener('change', showOriginAccountDetails);
    document.getElementById('monto').addEventListener('input', validateTransferAmount);
}

async function loadTransferConfig() {
    try {
        const response = await apiClient.get('/api/transferencias/config');
        if (response.data && response.data.local_swift) {
            LOCAL_SWIFT = response.data.local_swift;
            console.log(`✓ Configuración cargada. SWIFT local: ${LOCAL_SWIFT}`);
        }
    } catch (error) {
        console.warn('No se pudo obtener configuración del servidor, usando valor por defecto', error.message);
    }
}

async function loadTransferCatalogs() {
    try {
        const response = await apiClient.get('/api/transferencias/catalogos');
        const catalogs = response.data;
        if (catalogs) {
            guardarEnLocalStorage('transferCatalogs', catalogs);
            renderTransferCatalogs(catalogs);
        } else {
            throw new Error('Respuesta vacía del servidor');
        }
    } catch (error) {
        const cachedCatalogs = obtenerDelLocalStorage('transferCatalogs');
        if (cachedCatalogs) {
            renderTransferCatalogs(cachedCatalogs);
            showNotification('Usando datos en caché. ' + error.message, 'warning');
        } else {
            showNotification('No se pudieron cargar catalogos. ' + error.message, 'error');
        }
    }
}

function renderTransferCatalogs(catalogs) {
    const accountSelect = document.getElementById('cuentaOrigen');
    const bankSelect = document.getElementById('swiftDestino');
    const localSwiftBadge = document.getElementById('localSwiftBadge');

    if (localSwiftBadge) {
        localSwiftBadge.textContent = `SWIFT local: ${LOCAL_SWIFT}`;
    }

    if (accountSelect) {
        const accounts = catalogs?.accounts || [];
        if (accounts.length > 0) {
            accountSelect.innerHTML = '<option value="">Seleccione cuenta origen</option>' + accounts.map((account) => `
                <option value="${account.numero_cuenta}">
                    ${account.numero_cuenta} - ${account.cliente} - ${formatMoney(account.saldo, account.moneda)}
                </option>
            `).join('');
        } else {
            accountSelect.innerHTML = '<option value="">No hay cuentas disponibles</option>';
            console.warn('No se encontraron cuentas en los catálogos', catalogs);
        }
    }

    if (bankSelect) {
        const banks = catalogs?.banks || [];
        if (banks.length > 0) {
            bankSelect.innerHTML = '<option value="">Seleccione un banco</option>' + banks.map((bank) => `
                <option value="${bank.codigo_swift}">${bank.nombre} - ${bank.codigo_swift}</option>
            `).join('');
        } else {
            bankSelect.innerHTML = '<option value="">No hay bancos disponibles</option>';
            console.warn('No se encontraron bancos en los catálogos', catalogs);
        }
        bankSelect.value = '';
    }

    filterDestinationAccounts();
    updateDestinationAccountMode();
    showOriginAccountDetails();
}

function updateDestinationAccountMode() {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const bankSelect = document.getElementById('swiftDestino');
    const manualGroup = document.getElementById('cuentaDestinoManualGroup');
    const localGroup = document.getElementById('cuentaDestinoLocalGroup');
    const selectedGroup = document.getElementById('cuentaDestinoSeleccionadaGroup');
    const destinationInput = document.getElementById('cuentaDestino');
    const validateBtn = document.getElementById('validateAccountBtn');
    const submitBtn = document.querySelector('#transferForm button[type="submit"]');

    if (!catalogs || !bankSelect || !manualGroup || !localGroup || !selectedGroup || !destinationInput) return;

    const isInternalTransfer = bankSelect.value === LOCAL_SWIFT;

    manualGroup.classList.toggle('hidden', isInternalTransfer);
    localGroup.classList.toggle('hidden', !isInternalTransfer);
    selectedGroup.classList.toggle('hidden', !isInternalTransfer);
    destinationInput.readOnly = isInternalTransfer;

    // Mostrar botón de validación solo para transferencias externas
    if (validateBtn) {
        validateBtn.classList.toggle('hidden', isInternalTransfer);
    }

    if (isInternalTransfer) {
        filterDestinationAccounts();
        // Si es transferencia interna, no requiere validación manual
        document.getElementById('accountValidated').value = '';
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    } else {
        destinationInput.value = '';
        document.getElementById('accountValidated').value = 'false';
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }
}

function filterDestinationAccounts() {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const destinationList = document.getElementById('cuentaDestinoLocalList');
    const searchInput = document.getElementById('cuentaDestinoSearch');
    const originAccount = document.getElementById('cuentaOrigen')?.value;

    if (!catalogs || !destinationList) return;

    const search = (searchInput?.value || '').trim().toLowerCase();
    const accounts = (catalogs.accounts || []).filter((account) => {
        const text = `${account.numero_cuenta} ${account.cliente}`.toLowerCase();
        return account.numero_cuenta !== originAccount && text.includes(search);
    });

    if (accounts.length === 0) {
        document.getElementById('cuentaDestino').value = '';
        document.getElementById('cuentaDestinoSeleccionada').value = '';
        document.getElementById('cuentaDestinoResumen').textContent = 'No hay cuentas disponibles con ese criterio.';
        destinationList.innerHTML = '<div class="empty-results">No hay cuentas disponibles.</div>';
        return;
    }

    const currentDestination = document.getElementById('cuentaDestino').value;

    destinationList.innerHTML = accounts.map((account) => `
        <button type="button" class="account-result ${account.numero_cuenta === currentDestination ? 'account-result-selected' : ''}" data-account="${account.numero_cuenta}">
            <strong>${account.numero_cuenta}</strong>
            <span>${account.cliente}</span>
            <small>${account.tipo_cuenta} - ${formatMoney(account.saldo, account.moneda)}</small>
        </button>
    `).join('');

    destinationList.querySelectorAll('[data-account]').forEach((button) => {
        button.addEventListener('click', () => selectDestinationAccount(button.dataset.account));
    });
}

function selectDestinationAccount(accountNumber) {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const account = (catalogs?.accounts || []).find((item) => item.numero_cuenta === accountNumber);

    document.getElementById('cuentaDestino').value = accountNumber || '';
    document.getElementById('cuentaDestinoSeleccionada').value = accountNumber || '';

    if (account) {
        const resumenText = `${account.cliente} - ${account.tipo_cuenta} - ${formatMoney(account.saldo, account.moneda)}`;
        document.getElementById('cuentaDestinoResumen').textContent = resumenText;
        // Validar automáticamente para transferencias internas
        document.getElementById('accountValidated').value = 'true';
        const submitBtn = document.querySelector('#transferForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    } else {
        document.getElementById('cuentaDestinoResumen').textContent = 'Seleccione una cuenta para ver los detalles.';
        document.getElementById('accountValidated').value = 'false';
        const submitBtn = document.querySelector('#transferForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }

    document.querySelectorAll('.account-result').forEach((item) => {
        item.classList.toggle('account-result-selected', item.dataset.account === accountNumber);
    });
}

function showOriginAccountDetails() {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const accountNumber = document.getElementById('cuentaOrigen').value;
    const previousAccount = obtenerDelLocalStorage('previousOriginAccount');
    const resumenElement = document.getElementById('cuentaOrigenResumen');

    if (!resumenElement) return;

    // Si cambió la cuenta origen, limpiar campos
    if (previousAccount && previousAccount !== accountNumber && accountNumber) {
        limpiarCamposDestino();
    }

    // Guardar la cuenta origen actual
    if (accountNumber) {
        guardarEnLocalStorage('previousOriginAccount', accountNumber);
    }

    if (!accountNumber) {
        resumenElement.textContent = 'Seleccione una cuenta para ver los detalles.';
        return;
    }

    const account = (catalogs?.accounts || []).find((item) => item.numero_cuenta === accountNumber);
    if (account) {
        resumenElement.textContent = `${account.cliente} - ${account.tipo_cuenta} - ${formatMoney(account.saldo, account.moneda)}`;
    }

    validateTransferAmount();
}

function limpiarCamposDestino() {
    // Limpiar select del banco destino
    if (document.getElementById('swiftDestino')) {
        document.getElementById('swiftDestino').value = '';
    }
    // Limpiar campos de destino
    if (document.getElementById('cuentaDestino')) {
        document.getElementById('cuentaDestino').value = '';
    }
    if (document.getElementById('cuentaDestinoSearch')) {
        document.getElementById('cuentaDestinoSearch').value = '';
    }
    if (document.getElementById('cuentaDestinoSeleccionada')) {
        document.getElementById('cuentaDestinoSeleccionada').value = '';
    }
    if (document.getElementById('monto')) {
        document.getElementById('monto').value = '';
    }
    if (document.getElementById('cuentaDestinoLocalList')) {
        document.getElementById('cuentaDestinoLocalList').innerHTML = '';
    }
}

function validateTransferAmount() {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const accountNumber = document.getElementById('cuentaOrigen').value;
    const monto = Number(document.getElementById('monto').value || 0);
    const originAccount = (catalogs?.accounts || []).find((item) => item.numero_cuenta === accountNumber);
    const resumenElement = document.getElementById('cuentaOrigenResumen');

    if (!resumenElement) return;

    if (!accountNumber || monto === 0) {
        if (accountNumber && originAccount) {
            resumenElement.textContent = `${originAccount.cliente} - ${originAccount.tipo_cuenta} - ${formatMoney(originAccount.saldo, originAccount.moneda)}`;
        }
        return;
    }

    if (originAccount) {
        const hasEnoughFunds = Number(originAccount.saldo) >= monto;
        const fundStatus = hasEnoughFunds
            ? `${formatMoney(originAccount.saldo, originAccount.moneda)}`
            : `${formatMoney(originAccount.saldo, originAccount.moneda)} ⚠️ Fondos insuficientes`;

        resumenElement.textContent = `${originAccount.cliente} - ${originAccount.tipo_cuenta} - ${fundStatus}`;
        resumenElement.style.color = hasEnoughFunds ? 'inherit' : '#e74c3c';
    }
}

async function validateDestinationAccountField() {
    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const swiftDestino = document.getElementById('swiftDestino')?.value;
    const cuentaDestino = document.getElementById('cuentaDestino')?.value?.trim();
    const validacionElement = document.getElementById('cuentaDestinoValidacion');
    
    if (!validacionElement || !cuentaDestino) {
        if (validacionElement) {
            validacionElement.textContent = 'Ingrese la cuenta de destino';
            validacionElement.style.color = 'inherit';
        }
        return;
    }

    // Si es una transferencia local, no hacer validación adicional
    if (swiftDestino === LOCAL_SWIFT) {
        return;
    }

    // Es una transferencia interbancaria, validar con el API
    if (!swiftDestino) {
        validacionElement.textContent = 'Seleccione primero el banco destino';
        validacionElement.style.color = '#e74c3c';
        return;
    }

    try {
        validacionElement.textContent = 'Validando cuenta...';
        validacionElement.style.color = '#3498db';

        const response = await apiClient.post('/api/transferencias/validar-cuenta-destino', {
            cuenta_destino: cuentaDestino,
            swift_destino: swiftDestino
        });

        if (response.success && response.data) {
            const data = response.data;
            validacionElement.textContent = 'Cuenta validada';
            validacionElement.style.color = '#27ae60';
        } else {
            validacionElement.textContent = response.message || 'No se pudo validar la cuenta';
            validacionElement.style.color = '#e74c3c';
        }
    } catch (error) {
        validacionElement.textContent = `Error: ${error.message || 'No se pudo conectar con el banco destino'}`;
        validacionElement.style.color = '#e74c3c';
    }
}

async function loadTransfers() {
    const tbody = document.getElementById('transfersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6">Cargando transferencias...</td></tr>';

    try {
        const response = await apiClient.get('/api/transferencias');
        const transfers = response.data || [];
        guardarEnLocalStorage('transfersCache', transfers);
        renderTransfersTable(transfers);
    } catch (error) {
        const transfers = obtenerDelLocalStorage('transfersCache') || [];
        renderTransfersTable(transfers);
        showNotification('Error al cargar transferencias. ' + error.message, 'error');
    }
}

function renderTransfersTable(transfers) {
    const tbody = document.getElementById('transfersTableBody');
    if (!tbody) return;

    if (transfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay transferencias registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = transfers.map((transfer) => {
        const descripcion = transfer.descripcion || '-';
        const descripcionTruncada = descripcion.length > 50 ? descripcion.substring(0, 50) + '...' : descripcion;
        
        return `
        <tr>
            <td><span class="transaction-code">${transfer.transaction_id || '-'}</span></td>
            <td>${transfer.cuenta_origen}<br><small>${transfer.swift_origen}</small></td>
            <td>${transfer.cuenta_destino}<br><small>${transfer.swift_destino}</small></td>
            <td>${transfer.banco_destino || transfer.swift_destino}</td>
            <td>${formatMoney(transfer.monto, transfer.moneda)}</td>
            <td title="${descripcion}">${descripcionTruncada}</td>
            <td><span class="status-badge status-${String(transfer.estado).toLowerCase()}">${transfer.estado}</span></td>
        </tr>
    `;
    }).join('');
}

function clearValidationState() {
    document.getElementById('accountValidated').value = 'false';
    const validationDiv = document.getElementById('validacionCuentaResult');
    if (validationDiv) {
        validationDiv.classList.add('hidden');
        validationDiv.innerHTML = '';
    }
    const submitBtn = document.querySelector('#transferForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
}

async function validateExternalAccount(event) {
    if (event) event.preventDefault();

    const swiftDestino = document.getElementById('swiftDestino').value;
    const cuentaDestino = document.getElementById('cuentaDestino').value.trim();
    const isInternalTransfer = swiftDestino === LOCAL_SWIFT;

    const validationDiv = document.getElementById('validacionCuentaResult');
    const submitBtn = document.querySelector('#transferForm button[type="submit"]');

    if (!swiftDestino) {
        validationDiv.classList.remove('hidden');
        validationDiv.className = 'validation-result error';
        validationDiv.innerHTML = 'Debe seleccionar un banco destino';
        return;
    }

    if (!cuentaDestino) {
        validationDiv.classList.remove('hidden');
        validationDiv.className = 'validation-result error';
        validationDiv.innerHTML = 'Debe ingresar una cuenta destino';
        return;
    }

    // Si es transferencia interna, validar contra catálogo local
    if (isInternalTransfer) {
        const catalogs = obtenerDelLocalStorage('transferCatalogs');
        const accountExists = catalogs?.accounts?.some(acc => acc.numero_cuenta === cuentaDestino);

        if (accountExists) {
            const account = catalogs.accounts.find(acc => acc.numero_cuenta === cuentaDestino);
            validationDiv.classList.add('hidden');
            document.getElementById('accountValidated').value = 'true';
            submitBtn.disabled = false;
            showAccountValidationModal({
                numeroCuenta: account.numero_cuenta,
                nombreCliente: account.cliente,
                banco: account.banco || 'Banco Local',
                tipoCuenta: account.tipo_cuenta || 'No especificado',
                estado: 'ACTIVA'
            });
        } else {
            validationDiv.classList.remove('hidden');
            validationDiv.className = 'validation-result error';
            validationDiv.innerHTML = 'Cuenta no encontrada';
            document.getElementById('accountValidated').value = 'false';
            submitBtn.disabled = true;
        }
        return;
    }

    // Si es transferencia externa, validar contra servidor
    try {
        submitBtn.disabled = true;
        const response = await apiClient.post('/api/transferencias/validar-cuenta-externa', {
            numeroCuenta: cuentaDestino,
            codigoSwift: swiftDestino
        });

        if (response.success && response.data) {
            validationDiv.classList.add('hidden');
            document.getElementById('accountValidated').value = 'true';
            submitBtn.disabled = false;
            
            // Mostrar modal con datos de la cuenta
            showAccountValidationModal(response.data);
        } else {
            validationDiv.classList.remove('hidden');
            validationDiv.className = 'validation-result error';
            validationDiv.innerHTML = response.message || 'Cuenta no encontrada';
            document.getElementById('accountValidated').value = 'false';
            submitBtn.disabled = true;
        }
    } catch (error) {
        validationDiv.classList.remove('hidden');
        validationDiv.className = 'validation-result error';
        validationDiv.innerHTML = error.message || 'Error al validar la cuenta';
        document.getElementById('accountValidated').value = 'false';
        submitBtn.disabled = true;
    }
}

function showAccountValidationModal(accountData) {
    const modal = document.getElementById('accountValidationModal');
    if (!modal) return;
    
    // Llenar los datos del modal
    document.getElementById('modalNumeroCuenta').textContent = accountData.numeroCuenta || accountData.numero_cuenta || '-';
    document.getElementById('modalNombreCliente').textContent = accountData.nombreCliente || accountData.nombre || 'Cliente Externo';
    document.getElementById('modalBanco').textContent = accountData.banco || '-';
    document.getElementById('modalTipoCuenta').textContent = accountData.tipoCuenta || accountData.tipo_cuenta || 'DESCONOCIDO';
    document.getElementById('modalEstado').textContent = accountData.estado || 'ACTIVO';
    
    // Mostrar el modal
    modal.classList.remove('hidden');
}

async function saveTransfer(event) {
    event.preventDefault();

    const isAccountValidated = document.getElementById('accountValidated').value === 'true';
    if (!isAccountValidated) {
        showNotification('Debe validar la cuenta destino primero', 'error');
        return;
    }

    const catalogs = obtenerDelLocalStorage('transferCatalogs');
    const isInternalTransfer = document.getElementById('swiftDestino').value === LOCAL_SWIFT;
    const destinationAccount = isInternalTransfer
        ? document.getElementById('cuentaDestino').value
        : document.getElementById('cuentaDestino').value.trim();

    const data = {
        cuenta_origen: document.getElementById('cuentaOrigen').value,
        swift_destino: document.getElementById('swiftDestino').value,
        cuenta_destino: destinationAccount,
        monto: Number(document.getElementById('monto').value),
        descripcion: document.getElementById('descripcion').value.trim()
    };

    if (!data.cuenta_origen || !data.swift_destino || !data.cuenta_destino || !data.monto) {
        showNotification('Complete los datos de la transferencia', 'error');
        return;
    }

    // Validar fondos suficientes
    const originAccount = (catalogs?.accounts || []).find((item) => item.numero_cuenta === data.cuenta_origen);
    if (originAccount && Number(originAccount.saldo) < data.monto) {
        showNotification(`Fondos insuficientes. Saldo disponible: ${formatMoney(originAccount.saldo, originAccount.moneda)}`, 'error');
        return;
    }

    try {
        const response = await apiClient.post('/api/transferencias', data);
        const estado = response.data?.estado || 'registrada';
        showNotification(`Transferencia ${estado}`, 'success');
        resetTransferForm();
        loadTransferCatalogs();
        loadTransfers();
    } catch (error) {
        showNotification(error.message || 'No se pudo registrar la transferencia', 'error');
    }
}

function resetTransferForm() {
    const form = document.getElementById('transferForm');
    if (form) form.reset();
    
    // Reiniciar explícitamente todos los select
    const cuentaOrigen = document.getElementById('cuentaOrigen');
    const swiftDestino = document.getElementById('swiftDestino');
    
    if (cuentaOrigen) {
        cuentaOrigen.value = '';
    }
    
    if (swiftDestino) {
        swiftDestino.value = '';
    }
    
    // Limpiar campos de búsqueda y campos de destino
    if (document.getElementById('cuentaDestino')) {
        document.getElementById('cuentaDestino').value = '';
    }
    if (document.getElementById('cuentaDestinoSearch')) {
        document.getElementById('cuentaDestinoSearch').value = '';
    }
    if (document.getElementById('cuentaDestinoSeleccionada')) {
        document.getElementById('cuentaDestinoSeleccionada').value = '';
    }
    if (document.getElementById('monto')) {
        document.getElementById('monto').value = '';
    }
    if (document.getElementById('descripcion')) {
        document.getElementById('descripcion').value = '';
    }
    
    // Limpiar la cuenta origen anterior para evitar problemas de cambios
    eliminarDelLocalStorage('previousOriginAccount');
    
    // Limpiar estado de validación
    document.getElementById('accountValidated').value = 'false';
    const validationDiv = document.getElementById('validacionCuentaResult');
    if (validationDiv) {
        validationDiv.classList.add('hidden');
        validationDiv.innerHTML = '';
    }
    const submitBtn = document.querySelector('#transferForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    
    filterDestinationAccounts();
    updateDestinationAccountMode();
    showOriginAccountDetails();
}

function mostrarAccesoDenegadoTransferencias() {
    const moduleRoot = document.getElementById('transfersModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel access-denied">
            <h2>Acceso denegado</h2>
            <p>El modulo de transferencias esta disponible solamente para ADMIN y OPERADOR.</p>
            <a class="btn-primary inline-link" href="./modulos/dashboard.html">Volver al menu principal</a>
        </section>
    `;
}

function formatMoney(value, currency = 'GTQ') {
    return `${currency || 'GTQ'} ${Number(value || 0).toFixed(2)}`;
}

function mostrarAccesoDenegado() {
    const moduleRoot = document.getElementById('usersModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel access-denied">
            <h2>Acceso denegado</h2>
            <p>El modulo de administracion de usuarios esta disponible solamente para el rol ADMIN.</p>
            <a class="btn-primary inline-link" href="./modulos/dashboard.html">Volver al menu principal</a>
        </section>
    `;
}

function setUserShell(user) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userName) userName.textContent = user.nombre;
    if (userRole) userRole.textContent = user.rol;
    if (logoutBtn) logoutBtn.addEventListener('click', cerrarSesion);
}

function requireSession() {
    const user = obtenerDelLocalStorage('currentUser');
    const token = obtenerToken();

    if (!user || !token) {
        window.location.href = '/index.html';
        return null;
    }

    apiClient.setToken(token);
    return user;
}

function guardarToken(token) {
    guardarEnLocalStorage('authToken', token);
    apiClient.setToken(token);
}

function obtenerToken() {
    return obtenerDelLocalStorage('authToken');
}

function cerrarSesion() {
    eliminarDelLocalStorage('authToken');
    eliminarDelLocalStorage('currentUser');
    eliminarDelLocalStorage('usuarioRecordado');
    apiClient.clearToken();
    window.location.href = '/index.html';
}

function mostrarError(mensaje) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = mensaje;
        errorMessage.style.display = 'block';
    }
    showNotification(mensaje, 'error');
}

function ocultarError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }
}

function mostrarExito(mensaje) {
    showNotification(mensaje, 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function showConfirmModal(titulo, mensaje, onConfirm, onCancel = null) {
    const modalHTML = `
        <div class="modal-overlay" id="confirmationModal">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>${titulo}</h3>
                    <button type="button" class="modal-close" id="closeConfirmModal">&times;</button>
                </div>
                <div class="modal-body" id="confirmMessageBody">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" id="confirmBtn">Sí, continuar</button>
                    <button type="button" class="btn-secondary" id="cancelBtn">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('confirmationModal');
    const messageBody = document.getElementById('confirmMessageBody');
    const closeBtn = document.getElementById('closeConfirmModal');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // Renderizar mensaje con HTML
    messageBody.innerHTML = `<p>${mensaje}</p>`;

    const removeModal = () => modal.remove();

    const handleConfirm = () => {
        removeModal();
        if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
        removeModal();
        if (onCancel) onCancel();
    };

    closeBtn.addEventListener('click', handleCancel);
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);

    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            handleCancel();
        }
    });
}

function guardarEnLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function obtenerDelLocalStorage(key) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}

function eliminarDelLocalStorage(key) {
    localStorage.removeItem(key);
}

function initResizableColumns() {
    const tables = document.querySelectorAll('.data-table');
    
    tables.forEach((table) => {
        const headers = table.querySelectorAll('th');
        
        headers.forEach((header, index) => {
            const handle = header.querySelector('::after');
            
            header.addEventListener('mousedown', (e) => {
                if (e.offsetX < header.offsetWidth - 5) return;
                
                const startX = e.clientX;
                const startWidth = header.offsetWidth;
                
                const onMouseMove = (moveEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const newWidth = Math.max(50, startWidth + deltaX);
                    header.style.width = newWidth + 'px';
                    header.style.minWidth = newWidth + 'px';
                    header.style.maxWidth = newWidth + 'px';
                    
                    // Aplicar el mismo ancho a las celdas de la columna
                    const cells = table.querySelectorAll(`td:nth-child(${index + 1})`);
                    cells.forEach((cell) => {
                        cell.style.width = newWidth + 'px';
                        cell.style.minWidth = newWidth + 'px';
                        cell.style.maxWidth = newWidth + 'px';
                    });
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                e.preventDefault();
            });
        });
    });
}

// =================== MÓDULO DE CLIENTES Y CUENTAS ===================

function renderClientesModule() {
    const moduleRoot = document.getElementById('clientesModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <h2>Gestión de Clientes</h2>
                <button type="button" id="addClientBtn" class="btn-primary">Nuevo Cliente</button>
            </div>

            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>DPI</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Estado</th>
                            <th>Cuentas</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientsTableBody">
                        <tr><td colspan="7">Cargando clientes...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Modal para cliente -->
        <div id="clientModal" class="modal hidden">
            <div class="modal-content modal-wide">
                <div class="modal-header">
                    <h3 id="modalTitle">Nuevo Cliente</h3>
                    <button type="button" class="modal-close" onclick="document.getElementById('clientModal').classList.add('hidden')">&times;</button>
                </div>
                <form id="clientForm" class="admin-form client-form">
                    <div class="form-grid client-form-grid">
                        <div class="form-group">
                            <label for="nombres">Nombres</label>
                            <input type="text" id="nombres" required>
                        </div>
                        <div class="form-group">
                            <label for="apellidos">Apellidos</label>
                            <input type="text" id="apellidos" required>
                        </div>
                        <div class="form-group">
                            <label for="dpi">DPI</label>
                            <input type="text" id="dpi" required placeholder="Ej: 1234567890123" title="Ingrese 13 dígitos sin espacios ni guiones">
                        </div>
                        <div class="form-group">
                            <label for="nit">NIT</label>
                            <input type="text" id="nit">
                        </div>
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input type="email" id="email">
                        </div>
                        <div class="form-group">
                            <label for="telefono">Teléfono</label>
                            <input type="tel" id="telefono">
                        </div>
                        <div class="form-group form-grid-wide">
                            <label for="direccion">Dirección</label>
                            <input type="text" id="direccion">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn-primary">Guardar Cliente</button>
                        <button type="button" class="btn-secondary" onclick="document.getElementById('clientModal').classList.add('hidden')">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal de confirmación para crear cuenta bancaria -->
        <div id="createAccountConfirmModal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Crear Cuenta Bancaria</h3>
                    <button type="button" class="modal-close" onclick="document.getElementById('createAccountConfirmModal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <p>El cliente ha sido registrado exitosamente.</p>
                    <p>¿Desea crear una cuenta bancaria para este cliente ahora?</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="confirmCreateAccount()">Sí, crear cuenta</button>
                    <button type="button" class="btn-secondary" onclick="document.getElementById('createAccountConfirmModal').classList.add('hidden')">No, después</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('addClientBtn').addEventListener('click', openClientModal);
    document.getElementById('clientForm').addEventListener('submit', saveClient);
}

function renderCuentasModule() {
    const moduleRoot = document.getElementById('cuentasModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <h2>Gestión de Cuentas Bancarias</h2>
                <button type="button" id="addAccountBtn" class="btn-primary">Aperturar Nueva Cuenta</button>
            </div>

            <div class="search-section" style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end;">
                    <div>
                        <label for="searchNumeroCuenta" style="display: block; margin-bottom: 5px; font-weight: 500;">Número de Cuenta</label>
                        <input type="text" id="searchNumeroCuenta" placeholder="Ej: 202400001234" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label for="searchCliente" style="display: block; margin-bottom: 5px; font-weight: 500;">Nombre del Cliente</label>
                        <input type="text" id="searchCliente" placeholder="Ej: Juan Pérez" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="button" id="searchBtn" class="btn-secondary">Buscar</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Número de Cuenta</th>
                            <th>Cliente</th>
                            <th>Tipo</th>
                            <th>Saldo</th>
                            <th>Moneda</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="accountsTableBody">
                        <tr><td colspan="7">Cargando cuentas...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Modal para cuenta -->
        <div id="accountModal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Aperturar Nueva Cuenta</h3>
                    <button type="button" class="modal-close" onclick="document.getElementById('accountModal').classList.add('hidden')">&times;</button>
                </div>
                <form id="accountForm" class="admin-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="clienteSelect">Cliente</label>
                            <select id="clienteSelect" required>
                                <option value="">Seleccione un cliente</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="tipoCuenta">Tipo de Cuenta</label>
                            <select id="tipoCuenta" required>
                                <option value="MONETARIA">MONETARIA</option>
                                <option value="AHORRO">AHORRO</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="moneda">Moneda</label>
                            <input type="text" id="moneda" value="GTQ" readonly>
                            <input type="hidden" id="monedaValue" value="GTQ">
                        </div>
                        <div class="form-group">
                            <label for="saldoInicial">Saldo Inicial</label>
                            <input type="number" id="saldoInicial" value="0.00" readonly>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn-primary">Aperturar Cuenta</button>
                        <button type="button" class="btn-secondary" onclick="document.getElementById('accountModal').classList.add('hidden')">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('addAccountBtn').addEventListener('click', openAccountModal);
    document.getElementById('accountForm').addEventListener('submit', saveAccount);
    document.getElementById('searchBtn').addEventListener('click', searchAccounts);
    document.getElementById('searchNumeroCuenta').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchAccounts();
    });
    document.getElementById('searchCliente').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchAccounts();
    });
}

async function loadClients() {
    try {
        const response = await apiClient.get('/api/clientes');
        const clients = response.data || [];
        guardarEnLocalStorage('clientsCache', clients);
        renderClientsTable(clients);
    } catch (error) {
        showNotification('Error al cargar clientes', 'error');
    }
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay clientes registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map((client) => `
        <tr>
            <td>${client.nombres} ${client.apellidos}</td>
            <td>${client.dpi}</td>
            <td>${client.email || '-'}</td>
            <td>${client.telefono || '-'}</td>
            <td><span class="status-badge status-${client.estado.toLowerCase()}">${client.estado}</span></td>
            <td><button type="button" class="btn-view btn-small" onclick="viewClientAccounts(${client.id_cliente})">Ver</button></td>
            <td>
                <button type="button" class="btn-edit btn-small" onclick="editClient(${client.id_cliente})">Editar</button>
                <button type="button" class="btn-delete btn-small" onclick="deleteClient(${client.id_cliente})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function loadAccounts() {
    try {
        const response = await apiClient.get('/api/cuentas');
        const accounts = response.data || [];
        guardarEnLocalStorage('accountsCache', accounts);
        renderAccountsTable(accounts);
    } catch (error) {
        showNotification('Error al cargar cuentas', 'error');
    }
}

function renderAccountsTable(accounts) {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;

    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay cuentas registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = accounts.map((account) => {
        const isActive = account.estado === 'ACTIVA';
        const btnText = isActive ? 'Desactivar' : 'Activar';
        const btnClass = isActive ? 'btn-danger' : 'btn-success';
        
        return `
        <tr>
            <td>${account.numero_cuenta}</td>
            <td>${account.nombre_cliente}</td>
            <td>${account.tipo_cuenta}</td>
            <td>${formatMoney(account.saldo, account.moneda)}</td>
            <td>${account.moneda}</td>
            <td><span class="status-badge status-${account.estado.toLowerCase()}">${account.estado}</span></td>
            <td>
                <button type="button" class="btn-view btn-small" onclick="viewAccountStatus(${account.id_cuenta})">Ver Estado</button>
                <button type="button" class="btn-small ${btnClass}" onclick="toggleAccountStatus(${account.id_cuenta}, '${account.estado}')">${btnText}</button>
                <button type="button" class="btn-delete btn-small" onclick="deleteAccount(${account.id_cuenta})">Eliminar</button>
            </td>
        </tr>
    `;
    }).join('');
}

function openClientModal() {
    const modal = document.getElementById('clientModal');
    document.getElementById('modalTitle').textContent = 'Nuevo Cliente';
    document.getElementById('clientForm').reset();
    document.getElementById('clientForm').dataset.clientId = '';
    modal.classList.remove('hidden');
}

async function saveClient(event) {
    event.preventDefault();
    
    const clientId = document.getElementById('clientForm').dataset.clientId;
    let dpi = document.getElementById('dpi').value.trim().replace(/[-\s]/g, '');
    
    // Validar DPI
    if (!/^\d+$/.test(dpi)) {
        showNotification('El DPI solo debe contener números', 'error');
        return;
    }
    
    if (dpi.length < 13 || dpi.length > 15) {
        showNotification('El DPI debe tener entre 13 y 15 dígitos', 'error');
        return;
    }

    const data = {
        nombres: document.getElementById('nombres').value.trim(),
        apellidos: document.getElementById('apellidos').value.trim(),
        dpi: dpi,
        nit: document.getElementById('nit').value?.trim() || null,
        email: document.getElementById('email').value?.trim() || null,
        telefono: document.getElementById('telefono').value?.trim() || null,
        direccion: document.getElementById('direccion').value?.trim() || null
    };

    try {
        let newClientId = null;
        if (clientId) {
            await apiClient.put(`/api/clientes/${clientId}`, data);
            showNotification('Cliente actualizado', 'success');
            document.getElementById('clientModal').classList.add('hidden');
        } else {
            const response = await apiClient.post('/api/clientes', data);
            newClientId = response.data.id_cliente;
            document.getElementById('clientModal').classList.add('hidden');
            document.getElementById('createAccountConfirmModal').classList.remove('hidden');
            guardarEnLocalStorage('lastCreatedClientId', newClientId);
        }
        loadClients();
    } catch (error) {
        showNotification(error.message || 'Error al guardar cliente', 'error');
    }
}

async function editClient(clientId) {
    try {
        const response = await apiClient.get(`/api/clientes/${clientId}`);
        const client = response.data;

        document.getElementById('nombres').value = client.nombres;
        document.getElementById('apellidos').value = client.apellidos;
        document.getElementById('dpi').value = client.dpi;
        document.getElementById('nit').value = client.nit || '';
        document.getElementById('email').value = client.email || '';
        document.getElementById('telefono').value = client.telefono || '';
        document.getElementById('direccion').value = client.direccion || '';
        document.getElementById('clientForm').dataset.clientId = clientId;
        document.getElementById('modalTitle').textContent = 'Editar Cliente';
        document.getElementById('clientModal').classList.remove('hidden');
    } catch (error) {
        showNotification('Error al cargar cliente', 'error');
    }
}

async function viewClientAccounts(clientId) {
    try {
        const response = await apiClient.get(`/api/clientes/${clientId}/cuentas`);
        showNotification(`${response.client_name}: ${response.count} cuenta(s)`, 'info');
    } catch (error) {
        showNotification('Error al obtener cuentas', 'error');
    }
}

async function deleteClient(clientId) {
    // Obtener información del cliente
    try {
        const clientResponse = await apiClient.get(`/api/clientes/${clientId}`);
        const client = clientResponse.data;
        const clientName = `${client.nombres} ${client.apellidos}`;
        
        // Confirmar eliminación completa
        showConfirmModal('Confirmar', '¿Está seguro?', async () => {
            // Obtener cuentas del cliente
            const accountsResponse = await apiClient.get(`/api/clientes/${clientId}/cuentas`);
            const accounts = accountsResponse.data || [];
            
            // Mensaje de progreso
            if (accounts.length > 0) {
                showNotification(`Eliminando ${accounts.length} cuenta(s) y el cliente...`, 'info');
            }
            
            // Eliminar el cliente (esto elimina el cliente y sus cuentas en el backend)
            await apiClient.delete(`/api/clientes/${clientId}`);
            showNotification(`Cliente "${clientName}" y sus cuentas han sido eliminados completamente`, 'success');
            
            // Recargar lista de clientes
            loadClients();
        });
    } catch (error) {
        showNotification(error.message || 'Error al eliminar el cliente', 'error');
    }
}

function openAccountModal() {
    const clients = obtenerDelLocalStorage('clientsCache') || [];
    const select = document.getElementById('clienteSelect');
    select.innerHTML = '<option value="">Seleccione un cliente</option>' + 
        clients.map(c => `<option value="${c.id_cliente}">${c.nombres} ${c.apellidos}</option>`).join('');
    
    document.getElementById('accountForm').reset();
    document.getElementById('accountForm').dataset.accountId = '';
    document.getElementById('accountModal').classList.remove('hidden');
}

function openAccountModalWithClient(clientId) {
    const clients = obtenerDelLocalStorage('clientsCache') || [];
    const select = document.getElementById('clienteSelect');
    select.innerHTML = '<option value="">Seleccione un cliente</option>' + 
        clients.map(c => `<option value="${c.id_cliente}" ${c.id_cliente == clientId ? 'selected' : ''}>${c.nombres} ${c.apellidos}</option>`).join('');
    
    document.getElementById('accountForm').reset();
    document.getElementById('accountForm').dataset.accountId = '';
    document.getElementById('accountModal').classList.remove('hidden');
}

async function saveAccount(event) {
    event.preventDefault();
    
    const clientId = document.getElementById('clienteSelect').value;
    const data = {
        id_cliente: clientId,
        tipo_cuenta: document.getElementById('tipoCuenta').value,
        moneda: 'GTQ',
        saldo: 0,
        swift_banco: 'GTBC6968'
    };

    try {
        await apiClient.post('/api/cuentas', data);
        showNotification('Cuenta aperturada con éxito', 'success');
        document.getElementById('accountModal').classList.add('hidden');
        loadAccounts();
    } catch (error) {
        showNotification(error.message || 'Error al aperturar cuenta', 'error');
    }
}

function confirmCreateAccount() {
    // Obtener el ID del cliente recién creado
    const lastCreatedClientId = obtenerDelLocalStorage('lastCreatedClientId');
    
    // Guardar el ID en localStorage para recuperarlo en el módulo de cuentas
    guardarEnLocalStorage('clientIdToCreateAccount', lastCreatedClientId);
    localStorage.removeItem('lastCreatedClientId');
    
    // Cerrar modal de confirmación
    document.getElementById('createAccountConfirmModal').classList.add('hidden');
    
    // Redirigir al módulo de cuentas
    window.location.href = '/modulos/cuentas.html';
}

async function editAccount(accountId) {
    try {
        const response = await apiClient.get(`/api/cuentas/${accountId}`);
        showNotification(`Cuenta: ${response.data.numero_cuenta} | Saldo: ${formatMoney(response.data.saldo)}`, 'info');
    } catch (error) {
        showNotification('Error al cargar cuenta', 'error');
    }
}

async function toggleAccountStatus(accountId, currentStatus) {
    const isActive = currentStatus === 'ACTIVA';
    const newStatus = isActive ? 'INACTIVA' : 'ACTIVA';
    const actionText = isActive ? 'desactivar' : 'activar';
    
    // Crear modal personalizado
    const modalHTML = `
        <div class="modal-overlay" id="toggleAccountModal">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>Confirmar acción</h3>
                    <button type="button" class="modal-close" id="closeToggleModal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Está seguro de que desea ${actionText} esta cuenta?</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" id="confirmToggleBtn">Sí, ${actionText}</button>
                    <button type="button" class="btn-secondary" id="cancelToggleBtn">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('toggleAccountModal');
    const closeBtn = document.getElementById('closeToggleModal');
    const confirmBtn = document.getElementById('confirmToggleBtn');
    const cancelBtn = document.getElementById('cancelToggleBtn');

    const removeModal = () => modal.remove();

    closeBtn.addEventListener('click', removeModal);
    cancelBtn.addEventListener('click', removeModal);

    confirmBtn.addEventListener('click', async () => {
        try {
            await apiClient.put(`/api/cuentas/${accountId}`, {
                estado: newStatus
            });
            showNotification(`Cuenta ${actionText}da exitosamente`, 'success');
            removeModal();
            loadAccounts();
        } catch (error) {
            showNotification(error.message || `Error al ${actionText} la cuenta`, 'error');
            removeModal();
        }
    });

    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            removeModal();
        }
    });
}

async function deleteAccount(accountId) {
    try {
        const accountResponse = await apiClient.get(`/api/cuentas/${accountId}`);
        const account = accountResponse.data;
        
        // Confirmar eliminación
        showConfirmModal('Confirmar', '¿Está seguro?', async () => {
            // Eliminar la cuenta
            await apiClient.delete(`/api/cuentas/${accountId}`);
            showNotification(`Cuenta "${account.numero_cuenta}" eliminada completamente`, 'success');
            
            // Recargar lista de cuentas
            loadAccounts();
        });
    } catch (error) {
        showNotification(error.message || 'Error al eliminar la cuenta', 'error');
    }
}

function searchAccounts() {
    const searchNumeroCuenta = document.getElementById('searchNumeroCuenta')?.value.trim().toLowerCase() || '';
    const searchCliente = document.getElementById('searchCliente')?.value.trim().toLowerCase() || '';
    
    if (!searchNumeroCuenta && !searchCliente) {
        showNotification('Ingrese al menos un criterio de búsqueda', 'warning');
        return;
    }

    const allAccounts = obtenerDelLocalStorage('accountsCache') || [];
    
    const filteredAccounts = allAccounts.filter((account) => {
        const matchesNumeroCuenta = searchNumeroCuenta === '' || account.numero_cuenta.includes(searchNumeroCuenta);
        const matchesCliente = searchCliente === '' || account.nombre_cliente.toLowerCase().includes(searchCliente);
        return matchesNumeroCuenta && matchesCliente;
    });

    if (filteredAccounts.length === 0) {
        showNotification('No se encontraron cuentas con los criterios especificados', 'warning');
        renderAccountsTable([]);
        return;
    }

    renderAccountsTable(filteredAccounts);
    showNotification(`Se encontraron ${filteredAccounts.length} cuenta(s)`, 'info');
}

async function viewAccountStatus(accountId) {
    try {
        // Guardar el ID de la cuenta en localStorage para acceso desde la página de estado
        guardarEnLocalStorage('currentAccountId', accountId);
        
        // Redirigir a la página de estado de cuenta
        window.location.href = 'estado-cuenta.html?accountId=' + accountId;
    } catch (error) {
        showNotification(error.message || 'Error al obtener estado de cuenta', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);

        const usuarioRecordado = obtenerDelLocalStorage('usuarioRecordado');
        if (usuarioRecordado) {
            document.getElementById('usuario').value = usuarioRecordado;
            document.getElementById('recordar').checked = true;
            document.getElementById('contrasena').focus();
        }
    }

    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (event) => {
            event.preventDefault();
            showNotification('Recuperacion de contrasena pendiente de implementar', 'info');
        });
    }

    if (document.getElementById('mainMenu')) {
        initDashboard();
    }

    if (document.getElementById('usersModule')) {
        initUsersModule();
    }

    if (document.getElementById('transfersModule')) {
        initTransfersModule();
    }

    if (document.getElementById('retiroDespositoModule')) {
        initRetiroDespositoModule();
    }

    if (document.getElementById('clientesModule')) {
        initClientesModule();
    }

    if (document.getElementById('cuentasModule')) {
        initCuentasModule();
    }
    
    // Inicializar redimensionamiento de columnas
    setTimeout(() => {
        initResizableColumns();
    }, 100);
});
