const FINANCE_ROLES = ['ADMIN', 'OPERADOR', 'FINANZAS', 'AUDITOR'];
const BALANCE_ROLES = FINANCE_ROLES;
const MOVEMENT_ROLES = FINANCE_ROLES;
const ALERT_ROLES = FINANCE_ROLES;
const DASHBOARD_ROLES = FINANCE_ROLES;
const RETIROS_ROLES = ['ADMIN', 'OPERADOR', 'FINANZAS'];

const financeChartInstances = {};

function destroyChart(chartId) {
    if (financeChartInstances[chartId]) {
        financeChartInstances[chartId].destroy();
        delete financeChartInstances[chartId];
    }
}

function createOrUpdateChart(chartId, type, data, options = {}) {
    if (typeof Chart === 'undefined') {
        return null;
    }

    const canvas = document.getElementById(chartId);
    if (!canvas) return null;

    destroyChart(chartId);

    const ctx = canvas.getContext('2d');
    financeChartInstances[chartId] = new Chart(ctx, {
        type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#33485c'
                    }
                },
                y: {
                    ticks: {
                        color: '#33485c'
                    }
                }
            },
            ...options
        }
    });
    return financeChartInstances[chartId];
}

async function exportSectionToPDF(sectionSelector, filename) {
    const section = document.querySelector(sectionSelector);
    if (!section) {
        showNotification('No se encontró la sección a exportar', 'error');
        return;
    }

    if (typeof html2canvas === 'undefined' || !window.jspdf) {
        showNotification('Las bibliotecas de exportación no están disponibles', 'error');
        return;
    }

    try {
        const canvas = await html2canvas(section, { scale: 2, useCORS: true });
        const image = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(image);
        const imgWidth = pdfWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        if (imgHeight <= pdfHeight) {
            pdf.addImage(image, 'PNG', 0, 0, imgWidth, imgHeight);
        } else {
            let remainingHeight = imgHeight;
            let position = 0;
            while (remainingHeight > 0) {
                pdf.addImage(image, 'PNG', 0, position, imgWidth, imgHeight);
                remainingHeight -= pdfHeight;
                if (remainingHeight > 0) {
                    pdf.addPage();
                    position -= pdfHeight;
                }
            }
        }

        pdf.save(filename);
        showNotification('PDF generado correctamente', 'success');
    } catch (error) {
        showNotification('No se pudo generar el PDF', 'error');
        throw error;
    }
}

function handleExportPDF(sectionSelector, filename) {
    return exportSectionToPDF(sectionSelector, filename);
}

function initFinanceModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderFinanceModule(user);
}

function renderFinanceModule(user) {
    const moduleRoot = document.getElementById('financeMenu');
    if (!moduleRoot) return;

    const modules = [
        {
            title: 'Reportes de Saldos',
            description: 'Saldo por cuenta, tipo y evolución histórica.',
            href: './reportes-saldos.html',
            roles: BALANCE_ROLES
        },
        {
            title: 'Análisis de Movimientos',
            description: 'Resumen diario, volumen por banco y montos totales.',
            href: './analisis-movimientos.html',
            roles: MOVEMENT_ROLES
        },
        {
            title: 'Alertas Financieras',
            description: 'Saldos bajos, límites y operaciones sospechosas.',
            href: './alertas-financieras.html',
            roles: ALERT_ROLES
        },
        {
            title: 'Dashboard Financiero',
            description: 'Indicadores clave y comparativas entre periodos.',
            href: './dashboard-financiero.html',
            roles: DASHBOARD_ROLES
        }
    ];

    moduleRoot.innerHTML = modules.map((module) => {
        const allowed = module.roles.includes(user.rol);
        const href = allowed ? module.href : '#';
        return `
            <a class="module-card ${allowed ? '' : 'module-card-disabled'}" href="${href}" data-allowed="${allowed}">
                <span class="module-status">${allowed ? 'Disponible' : 'Sin acceso'}</span>
                <h3>${module.title}</h3>
                <p>${module.description}</p>
            </a>
        `;
    }).join('');

    moduleRoot.querySelectorAll('[data-allowed="false"]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            showNotification('No tiene permisos para acceder a este módulo', 'error');
        });
    });
}

function initBalanceReportsModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderBalanceReportsModule();
    loadBalanceReports();
}

function renderBalanceReportsModule() {
    const moduleRoot = document.getElementById('balanceReportsModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Saldos y evolución</h2>
                    <p>Visualiza la información de saldos por cuenta, por tipo y mediante histórico.</p>
                </div>
                <div class="header-actions">
                    <button type="button" id="refreshBalanceReportBtn" class="btn-secondary">Actualizar</button>
                    <button type="button" id="exportBalanceReportBtn" class="btn-primary">Exportar PDF</button>
                </div>
            </div>

            <div class="filters finance-filters">
                <label>
                    Desde
                    <input type="date" id="balanceDesde" />
                </label>
                <label>
                    Hasta
                    <input type="date" id="balanceHasta" />
                </label>
                <button type="button" id="applyBalanceFilterBtn" class="btn-primary">Aplicar filtro</button>
            </div>

            <div class="summary" id="balanceSummary"></div>

            <div class="charts-container">
                <div class="chart-card">
                    <h3>Saldo por tipo de cuenta</h3>
                    <canvas id="balanceTypeChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Evolución histórica de saldos</h3>
                    <canvas id="balanceHistoryChart"></canvas>
                </div>
            </div>

            <div class="table-wrap">
                <h3>Saldo por cuenta</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cuenta</th>
                            <th>Tipo</th>
                            <th>Saldo</th>
                            <th>Moneda</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="balanceAccountsBody">
                        <tr><td colspan="5">Cargando balances...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="table-wrap">
                <h3>Saldo por tipo de cuenta</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Tipo de cuenta</th>
                            <th>Cantidad de cuentas</th>
                            <th>Saldo total</th>
                        </tr>
                    </thead>
                    <tbody id="balanceByTypeBody">
                        <tr><td colspan="3">Cargando datos por tipo...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="table-wrap">
                <h3>Evolución histórica de saldos</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Ingresos</th>
                            <th>Egresos</th>
                            <th>Neto</th>
                            <th>Total movimientos</th>
                        </tr>
                    </thead>
                    <tbody id="balanceHistoryBody">
                        <tr><td colspan="5">Cargando histórico...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('refreshBalanceReportBtn').addEventListener('click', loadBalanceReports);
    document.getElementById('applyBalanceFilterBtn').addEventListener('click', loadBalanceReports);
    document.getElementById('exportBalanceReportBtn').addEventListener('click', () => handleExportPDF('#balanceReportsModule', 'reportes-saldos.pdf'));
}

async function loadBalanceReports() {
    const desde = document.getElementById('balanceDesde')?.value;
    const hasta = document.getElementById('balanceHasta')?.value;

    try {
        const [accountsResponse, byTypeResponse, historyResponse] = await Promise.all([
            apiClient.get('/api/finanzas/saldos'),
            apiClient.get('/api/finanzas/saldos/tipo-cuenta'),
            apiClient.get(`/api/finanzas/saldos/historico?${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}` : ''}`)
        ]);

        const accounts = accountsResponse.data || [];
        const byType = byTypeResponse.data || [];
        const history = historyResponse.data || [];

        const summary = document.getElementById('balanceSummary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-card">
                    <h3>Total cuentas</h3>
                    <div class="number">${accounts.length}</div>
                </div>
                <div class="summary-card deposits">
                    <h3>Saldo total</h3>
                    <div class="number">Q${accounts.reduce((sum, item) => sum + parseFloat(item.saldo || 0), 0).toFixed(2)}</div>
                </div>
                <div class="summary-card withdrawals">
                    <h3>Tipos de cuenta</h3>
                    <div class="number">${byType.length}</div>
                </div>
            `;
        }

        renderBalanceAccounts(accounts);
        renderBalanceByType(byType);
        renderBalanceHistory(history);
        renderBalanceCharts(byType, history);
    } catch (error) {
        showNotification(error.message || 'Error al cargar reportes de saldos', 'error');
    }
}

function renderBalanceCharts(byType, history) {
    const labelsType = byType.map((item) => item.tipo_cuenta);
    const dataType = byType.map((item) => parseFloat(item.saldo_total || 0));

    createOrUpdateChart('balanceTypeChart', 'pie', {
        labels: labelsType,
        datasets: [{
            label: 'Saldo total por tipo',
            data: dataType,
            backgroundColor: ['#0D47A1', '#2e7d32', '#f6ad55', '#f56565', '#38b2ac'],
            borderWidth: 1
        }]
    });

    const labelsHistory = history.map((item) => item.fecha);
    const ingresosData = history.map((item) => parseFloat(item.ingresos || 0));
    const egresosData = history.map((item) => parseFloat(item.egresos || 0));
    const netoData = history.map((item) => parseFloat(item.neto || 0));

    createOrUpdateChart('balanceHistoryChart', 'line', {
        labels: labelsHistory,
        datasets: [
            {
                label: 'Ingresos',
                data: ingresosData,
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.18)',
                fill: true,
                tension: 0.3
            },
            {
                label: 'Egresos',
                data: egresosData,
                borderColor: '#c62828',
                backgroundColor: 'rgba(198, 40, 40, 0.18)',
                fill: true,
                tension: 0.3
            },
            {
                label: 'Neto',
                data: netoData,
                borderColor: '#0D47A1',
                backgroundColor: 'rgba(13, 71, 161, 0.18)',
                fill: true,
                tension: 0.3
            }
        ]
    });
}

function renderBalanceAccounts(accounts) {
    const tbody = document.getElementById('balanceAccountsBody');
    if (!tbody) return;

    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay cuentas registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = accounts.map((account) => `
        <tr>
            <td>${account.numero_cuenta}</td>
            <td>${account.tipo_cuenta}</td>
            <td>${formatMoney(account.saldo, account.moneda)}</td>
            <td>${account.moneda}</td>
            <td>${account.estado}</td>
        </tr>
    `).join('');
}

function renderBalanceByType(byType) {
    const tbody = document.getElementById('balanceByTypeBody');
    if (!tbody) return;

    if (byType.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No hay tipos de cuenta registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = byType.map((item) => `
        <tr>
            <td>${item.tipo_cuenta}</td>
            <td>${item.cantidad_cuentas}</td>
            <td>${formatMoney(item.saldo_total)}</td>
        </tr>
    `).join('');
}

function renderBalanceHistory(history) {
    const tbody = document.getElementById('balanceHistoryBody');
    if (!tbody) return;

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No se encontraron movimientos para el periodo seleccionado.</td></tr>';
        return;
    }

    tbody.innerHTML = history.map((item) => `
        <tr>
            <td>${item.fecha}</td>
            <td>${formatMoney(item.ingresos)}</td>
            <td>${formatMoney(item.egresos)}</td>
            <td>${formatMoney(item.neto)}</td>
            <td>${item.total_movimientos}</td>
        </tr>
    `).join('');
}

function initMovementAnalysisModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderMovementAnalysisModule();
    loadMovementAnalysis();
}

function renderMovementAnalysisModule() {
    const moduleRoot = document.getElementById('movementAnalysisModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Resumen de Movimientos</h2>
                    <p>Analiza volumen y montos totales de tus movimientos bancarios.</p>
                </div>
                <div class="header-actions">
                    <button type="button" id="refreshMovementAnalysisBtn" class="btn-secondary">Actualizar</button>
                    <button type="button" id="exportMovementAnalysisBtn" class="btn-primary">Exportar PDF</button>
                </div>
            </div>

            <div class="filters finance-filters">
                <label>
                    Desde
                    <input type="date" id="movementDesde" />
                </label>
                <label>
                    Hasta
                    <input type="date" id="movementHasta" />
                </label>
                <button type="button" id="applyMovementFilterBtn" class="btn-primary">Aplicar filtro</button>
            </div>

            <div class="summary" id="movementSummary"></div>

            <div class="charts-container">
                <div class="chart-card">
                    <h3>Transferencias diarias</h3>
                    <canvas id="movementDailyChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Volumen por banco</h3>
                    <canvas id="movementBankChart"></canvas>
                </div>
            </div>

            <div class="table-wrap">
                <h3>Resumen diario de transferencias</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Transferencias</th>
                            <th>Monto total</th>
                            <th>Aprobadas</th>
                            <th>Pendientes</th>
                            <th>Rechazadas</th>
                        </tr>
                    </thead>
                    <tbody id="movementDailyBody">
                        <tr><td colspan="6">Cargando resumen diario...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="table-wrap">
                <h3>Volumen de transacciones por banco</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Banco</th>
                            <th>Código SWIFT</th>
                            <th>Transferencias</th>
                            <th>Monto total</th>
                        </tr>
                    </thead>
                    <tbody id="movementByBankBody">
                        <tr><td colspan="4">Cargando volumen por banco...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('refreshMovementAnalysisBtn').addEventListener('click', loadMovementAnalysis);
    document.getElementById('applyMovementFilterBtn').addEventListener('click', loadMovementAnalysis);
    document.getElementById('exportMovementAnalysisBtn').addEventListener('click', () => handleExportPDF('#movementAnalysisModule', 'analisis-movimientos.pdf'));
}

async function loadMovementAnalysis() {
    const desde = document.getElementById('movementDesde')?.value;
    const hasta = document.getElementById('movementHasta')?.value;

    try {
        const [dailyResponse, bankResponse, totalsResponse] = await Promise.all([
            apiClient.get(`/api/finanzas/movimientos/resumen-diario?${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}` : ''}`),
            apiClient.get(`/api/finanzas/movimientos/por-banco?${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}` : ''}`),
            apiClient.get(`/api/finanzas/movimientos/montos?${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}` : ''}`)
        ]);

        const daily = dailyResponse.data || [];
        const bank = bankResponse.data || [];
        const totals = totalsResponse.data || { total_ingresos: 0, total_egresos: 0, total_movimientos: 0 };

        const summary = document.getElementById('movementSummary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-card deposits">
                    <h3>Ingresos totales</h3>
                    <div class="number">Q${parseFloat(totals.total_ingresos || 0).toFixed(2)}</div>
                </div>
                <div class="summary-card withdrawals">
                    <h3>Egresos totales</h3>
                    <div class="number">Q${parseFloat(totals.total_egresos || 0).toFixed(2)}</div>
                </div>
                <div class="summary-card">
                    <h3>Movimientos</h3>
                    <div class="number">${totals.total_movimientos || 0}</div>
                </div>
            `;
        }

        renderMovementDaily(daily);
        renderMovementByBank(bank);
        renderMovementCharts(daily, bank);
    } catch (error) {
        showNotification(error.message || 'Error al cargar análisis de movimientos', 'error');
    }
}

function renderMovementCharts(daily, bank) {
    const dailyLabels = daily.map((item) => item.fecha);
    const dailyData = daily.map((item) => parseFloat(item.monto_total || 0));

    createOrUpdateChart('movementDailyChart', 'bar', {
        labels: dailyLabels,
        datasets: [{
            label: 'Monto total por día',
            data: dailyData,
            backgroundColor: '#0D47A1'
        }]
    });

    const bankLabels = bank.map((item) => item.nombre_banco || 'Sin banco');
    const bankData = bank.map((item) => parseFloat(item.monto_total || 0));

    createOrUpdateChart('movementBankChart', 'doughnut', {
        labels: bankLabels,
        datasets: [{
            label: 'Monto total por banco',
            data: bankData,
            backgroundColor: ['#38b2ac', '#f6ad55', '#f56565', '#805ad5', '#48bb78']
        }]
    });
}

function renderMovementDaily(daily) {
    const tbody = document.getElementById('movementDailyBody');
    if (!tbody) return;

    if (daily.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No hay datos para el periodo seleccionado.</td></tr>';
        return;
    }

    tbody.innerHTML = daily.map((item) => `
        <tr>
            <td>${item.fecha}</td>
            <td>${item.total_transferencias}</td>
            <td>${formatMoney(item.monto_total)}</td>
            <td>${item.aprobadas}</td>
            <td>${item.pendientes}</td>
            <td>${item.rechazadas}</td>
        </tr>
    `).join('');
}

function renderMovementByBank(bank) {
    const tbody = document.getElementById('movementByBankBody');
    if (!tbody) return;

    if (bank.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No se encontraron transferencias por banco.</td></tr>';
        return;
    }

    tbody.innerHTML = bank.map((item) => `
        <tr>
            <td>${item.nombre_banco}</td>
            <td>${item.codigo_banco}</td>
            <td>${item.cantidad_transferencias}</td>
            <td>${formatMoney(item.monto_total)}</td>
        </tr>
    `).join('');
}

function initAlertsModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderAlertsModule();
    loadAlerts();
}

function renderAlertsModule() {
    const moduleRoot = document.getElementById('alertasFinancierasModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Alertas Financieras</h2>
                    <p>Saldos bajos, límites de transferencia y transacciones sospechosas.</p>
                </div>
                <button type="button" id="refreshAlertsBtn" class="btn-secondary">Actualizar</button>
            </div>

            <div class="filters finance-filters">
                <label>
                    Límite saldo bajo
                    <input type="number" id="alertLowThreshold" value="1000" min="0" step="100" />
                </label>
                <label>
                    Límite transferencia
                    <input type="number" id="alertTransferThreshold" value="5000" min="0" step="100" />
                </label>
                <label>
                    Límite sospechoso
                    <input type="number" id="alertSuspiciousThreshold" value="5000" min="0" step="100" />
                </label>
                <button type="button" id="applyAlertsFilterBtn" class="btn-primary">Aplicar filtro</button>
            </div>

            <div class="table-wrap">
                <h3>Saldos bajos</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cuenta</th>
                            <th>Tipo</th>
                            <th>Saldo</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="lowBalanceBody">
                        <tr><td colspan="4">Cargando saldos bajos...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="table-wrap">
                <h3>Límites de transferencia</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transacción</th>
                            <th>Origen</th>
                            <th>Destino</th>
                            <th>Banco destino</th>
                            <th>Monto</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="limitTransferBody">
                        <tr><td colspan="6">Cargando transferencias por límite...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="table-wrap">
                <h3>Transacciones sospechosas</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transacción</th>
                            <th>Origen</th>
                            <th>Destino</th>
                            <th>Banco destino</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody id="suspiciousTransfersBody">
                        <tr><td colspan="6">Cargando transacciones sospechosas...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('refreshAlertsBtn').addEventListener('click', loadAlerts);
    document.getElementById('applyAlertsFilterBtn').addEventListener('click', loadAlerts);
}

async function loadAlerts() {
    const lowThreshold = document.getElementById('alertLowThreshold')?.value || 1000;
    const transferThreshold = document.getElementById('alertTransferThreshold')?.value || 5000;
    const suspiciousThreshold = document.getElementById('alertSuspiciousThreshold')?.value || 5000;

    try {
        const response = await apiClient.get(`/api/finanzas/alertas?limiteBajo=${lowThreshold}&limiteTransferencia=${transferThreshold}&limiteSospechoso=${suspiciousThreshold}`);
        const data = response.data || {};

        renderAlertTable('lowBalanceBody', data.lowBalances || []);
        renderAlertTable('limitTransferBody', data.limitTransfers || [], true);
        renderAlertTable('suspiciousTransfersBody', data.suspiciousTransfers || [], true, true);
    } catch (error) {
        showNotification(error.message || 'Error al cargar alertas financieras', 'error');
    }
}

function renderAlertTable(bodyId, rows, isTransfer = false, showDate = false) {
    const tbody = document.getElementById(bodyId);
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${showDate ? 6 : isTransfer ? 6 : 4}">No se encontraron registros.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((item) => {
        if (!isTransfer) {
            return `
                <tr>
                    <td>${item.numero_cuenta}</td>
                    <td>${item.tipo_cuenta}</td>
                    <td>${formatMoney(item.saldo)}</td>
                    <td>${item.estado}</td>
                </tr>
            `;
        }

        return `
            <tr>
                <td>${item.transaction_id || item.id_transferencia}</td>
                <td>${item.cuenta_origen || '-'}</td>
                <td>${item.cuenta_destino || '-'}</td>
                <td>${item.swift_destino || '-'}</td>
                <td>${formatMoney(item.monto)}</td>
                ${showDate ? `<td>${new Date(item.fecha_solicitud).toLocaleDateString('es-ES')}</td>` : `<td>${item.estado || '-'}</td>`}
            </tr>
        `;
    }).join('');
}

function initFinancialDashboardModule() {
    const user = requireSession();
    if (!user) return;

    setUserShell(user);
    renderFinancialDashboardModule();
    loadFinancialDashboard();
}

function renderFinancialDashboardModule() {
    const moduleRoot = document.getElementById('financialDashboardModule');
    if (!moduleRoot) return;

    moduleRoot.innerHTML = `
        <section class="content-panel">
            <div class="panel-header">
                <div>
                    <h2>Dashboard Financiero</h2>
                    <p>Indicadores clave de ingresos, egresos, transferencias y cuentas activas.</p>
                </div>
                <div class="header-actions">
                    <button type="button" id="refreshFinanceDashboardBtn" class="btn-secondary">Actualizar</button>
                    <button type="button" id="exportFinanceDashboardBtn" class="btn-primary">Exportar PDF</button>
                </div>
            </div>

            <div class="filters finance-filters">
                <label>
                    Período
                    <select id="dashboardPeriod">
                        <option value="ULTIMOS_30_DIAS">Últimos 30 días</option>
                        <option value="ESTE_MES">Este mes</option>
                        <option value="ANUAL">Último año</option>
                    </select>
                </label>
                <button type="button" id="applyDashboardPeriodBtn" class="btn-primary">Aplicar</button>
            </div>

            <div class="summary" id="dashboardSummary"></div>

            <div class="charts-container">
                <div class="chart-card">
                    <h3>Ingresos vs Egresos</h3>
                    <canvas id="dashboardInOutChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Transferencias</h3>
                    <canvas id="dashboardTransfersChart"></canvas>
                </div>
            </div>

            <div class="table-wrap">
                <h3>Comparativa de periodos</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Métrica</th>
                            <th>Periodo actual</th>
                            <th>Periodo anterior</th>
                        </tr>
                    </thead>
                    <tbody id="dashboardComparisonBody">
                        <tr><td colspan="3">Cargando comparativa...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    document.getElementById('refreshFinanceDashboardBtn').addEventListener('click', loadFinancialDashboard);
    document.getElementById('applyDashboardPeriodBtn').addEventListener('click', loadFinancialDashboard);
    document.getElementById('exportFinanceDashboardBtn').addEventListener('click', () => handleExportPDF('#financialDashboardModule', 'dashboard-financiero.pdf'));
}

async function loadFinancialDashboard() {
    const periodo = document.getElementById('dashboardPeriod')?.value || 'ULTIMOS_30_DIAS';

    try {
        const response = await apiClient.get(`/api/finanzas/dashboard?periodo=${periodo}`);
        // La API puede devolver { data: { current, previous } } o { current, previous }
        const payload = response && (response.data || response) || {};
        const stats = payload.current || payload.data?.current || {};
        const previous = payload.previous || payload.data?.previous || {};

        const container = document.getElementById('dashboardSummary');
        if (container) {
            container.innerHTML = `
                <div class="summary-card deposits">
                    <h3>Ingresos</h3>
                    <div class="number">Q${parseFloat(stats.total_ingresos || 0).toFixed(2)}</div>
                </div>
                <div class="summary-card withdrawals">
                    <h3>Egresos</h3>
                    <div class="number">Q${parseFloat(stats.total_egresos || 0).toFixed(2)}</div>
                </div>
                <div class="summary-card transfers-sent">
                    <h3>Transferencias</h3>
                    <div class="number">${stats.total_transferencias || 0}</div>
                </div>
                <div class="summary-card transfers-received">
                    <h3>Monto transferido</h3>
                    <div class="number">Q${parseFloat(stats.monto_total_transferencias || 0).toFixed(2)}</div>
                </div>
                <div class="summary-card">
                    <h3>Cuentas activas</h3>
                    <div class="number">${stats.cuentas_activas || 0}</div>
                </div>
            `;
        }

        const comparison = document.getElementById('dashboardComparisonBody');
        if (comparison) {
            comparison.innerHTML = `
                <tr>
                    <td>Ingresos</td>
                    <td>${formatMoney(stats.total_ingresos || 0)}</td>
                    <td>${formatMoney(previous.total_ingresos || 0)}</td>
                </tr>
                <tr>
                    <td>Egresos</td>
                    <td>${formatMoney(stats.total_egresos || 0)}</td>
                    <td>${formatMoney(previous.total_egresos || 0)}</td>
                </tr>
            `;
        }

        renderDashboardCharts(stats, previous);
    } catch (error) {
        showNotification(error.message || 'Error al cargar el dashboard financiero', 'error');
    }
}

function renderDashboardCharts(stats, previous) {
    const inOutLabels = ['Ingresos', 'Egresos'];
    const inOutData = [parseFloat(stats.total_ingresos || 0), parseFloat(stats.total_egresos || 0)];

    createOrUpdateChart('dashboardInOutChart', 'bar', {
        labels: inOutLabels,
        datasets: [{
            label: 'Ingresos vs Egresos',
            data: inOutData,
            backgroundColor: ['#2e7d32', '#c62828']
        }]
    });

    const transferLabels = ['Actual', 'Anterior'];
    const transferData = [
        parseFloat(stats.monto_total_transferencias || 0),
        parseFloat(previous.monto_total_transferencias || 0)
    ];

    createOrUpdateChart('dashboardTransfersChart', 'doughnut', {
        labels: transferLabels,
        datasets: [{
            label: 'Transferencias',
            data: transferData,
            backgroundColor: ['#0D47A1', '#805ad5']
        }]
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('financeMenu')) {
        initFinanceModule();
    }

    if (document.getElementById('balanceReportsModule')) {
        initBalanceReportsModule();
    }

    if (document.getElementById('movementAnalysisModule')) {
        initMovementAnalysisModule();
    }

    if (document.getElementById('alertasFinancierasModule')) {
        initAlertsModule();
    }

    if (document.getElementById('financialDashboardModule')) {
        initFinancialDashboardModule();
    }
});
