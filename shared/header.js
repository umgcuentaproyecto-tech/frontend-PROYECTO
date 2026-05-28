(() => {
    const container = document.getElementById('appHeader');
    if (!container) return;

    const isModule = location.pathname.includes('/modulos/');
    const base = isModule ? '../' : '';
    const showBack = container.dataset.back === 'true' || history.length > 1;

    container.innerHTML = `
    <div class="app-header">
        <div class="brand-block">
            <img src="${base}assets/images/logo banco.png" alt="Logo" class="app-logo">
            <div>
                <h1>Banco Los Canchitos</h1>
                <p class="small">ERP Bancario</p>
            </div>
        </div>

        <div class="session-block">
            <div class="user-info">
                <strong id="userName">Usuario</strong>
                <span id="userRole">Rol</span>
            </div>
            ${showBack ? '<button id="backBtn" class="btn-back">← Volver</button>' : ''}
            <a href="${base}modulos/dashboard.html" class="btn-secondary">Menu</a>
            <button id="logoutBtn" class="btn-secondary">Salir</button>
        </div>
    </div>
    `;

    // Populate user info if available
    try {
        const raw = localStorage.getItem('currentUser');
        if (raw) {
            const user = JSON.parse(raw);
            const nameEl = document.getElementById('userName');
            const roleEl = document.getElementById('userRole');
            if (nameEl) nameEl.textContent = user.nombre || user.username || user.nombre_usuario || 'Usuario';
            if (roleEl) roleEl.textContent = user.rol || user.role || '';
        }
    } catch (e) { /* ignore */ }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => history.back());

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        // keep user info but remove token; redirect to root index
        window.location.href = base + 'index.html';
    });
})();
