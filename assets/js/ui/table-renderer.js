import { 
    minutesToHHMM, 
    minutesToDecimal
} from '../utils/time-utils.js';
import { formatDate } from '../utils/date-utils.js';
import { BADGE_COLORS } from '../config/constants.js';

export class TableRenderer {
    static renderHierarchicalView(tbody, data) {
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="bi bi-inbox me-2"></i>
                        Nessun dato trovato per il periodo selezionato
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(employeeData => {
            const { dipendente, ore, stats } = employeeData;
            
            // Riga dipendente (header)
            const employeeRow = document.createElement('tr');
            employeeRow.className = 'table-primary employee-row';
            employeeRow.dataset.employeeId = dipendente.id;
            employeeRow.innerHTML = `
                <td>
                    <i class="bi bi-chevron-down employee-toggle me-2"></i>
                    <strong><i class="bi bi-person-fill me-2"></i>${dipendente.name}</strong>
                </td>
                <td><strong>${stats.totalDays} giorni</strong></td>
                <td><strong>${stats.totalMinutes} min</strong></td>
                <td><strong>${stats.totalHours}</strong></td>
                <td><strong>${stats.totalDecimal}</strong></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="adminService.editEmployeeActivities('${dipendente.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(employeeRow);

            // Righe giorni (nascoste inizialmente)
            ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    const dayRow = document.createElement('tr');
                    dayRow.className = 'employee-days';
                    dayRow.dataset.employeeId = dipendente.id;
                    
                    let dayMinutes = 0;
                    day.attivita.forEach(activity => {
                        dayMinutes += activity.minutiEffettivi || activity.minuti || 0;
                    });

                    dayRow.innerHTML = `
                        <td class="ps-5">
                            <i class="bi bi-calendar3 me-2"></i>
                            ${formatDate(day.data)} 
                            <span class="badge bg-secondary ms-2">${day.stato}</span>
                        </td>
                        <td>${day.attivita.length} attività</td>
                        <td>${dayMinutes} min</td>
                        <td>${minutesToHHMM(dayMinutes)}</td>
                        <td>${minutesToDecimal(dayMinutes)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-info" onclick="adminService.viewDayDetails('${dipendente.id}', '${day.data}')">
                                <i class="bi bi-eye"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(dayRow);

                    // Righe attività
                    day.attivita.forEach(activity => {
                        const activityRow = document.createElement('tr');
                        activityRow.className = 'employee-days';
                        activityRow.dataset.employeeId = dipendente.id;
                        
                        activityRow.innerHTML = `
                            <td class="ps-5">
                                <span class="ms-4">
                                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)} me-2">
                                        ${activity.tipo}
                                    </span>
                                    ${activity.nome}
                                </span>
                            </td>
                            <td>${activity.persone} persone</td>
                            <td>${activity.minutiEffettivi || activity.minuti} min</td>
                            <td>${minutesToHHMM(activity.minutiEffettivi || activity.minuti)}</td>
                            <td>${minutesToDecimal(activity.minutiEffettivi || activity.minuti)}</td>
                            <td>-</td>
                        `;
                        tbody.appendChild(activityRow);
                    });
                }
            });
        });
    }

    static renderFlatView(tbody, data) {
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="bi bi-inbox me-2"></i>
                        Nessun dato trovato per il periodo selezionato
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(employeeData => {
            const { dipendente, ore } = employeeData;
            
            ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    day.attivita.forEach(activity => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>
                                <div><strong>${dipendente.name}</strong></div>
                                <div class="text-muted small">${formatDate(day.data)}</div>
                                <div>
                                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)} me-1">
                                        ${activity.tipo}
                                    </span>
                                    ${activity.nome}
                                </div>
                            </td>
                            <td>
                                <div>${activity.persone} persone</div>
                                <div class="text-muted small">${day.stato}</div>
                            </td>
                            <td>${activity.minutiEffettivi || activity.minuti}</td>
                            <td>${minutesToHHMM(activity.minutiEffettivi || activity.minuti)}</td>
                            <td>${minutesToDecimal(activity.minutiEffettivi || activity.minuti)}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-info" onclick="adminService.viewDayDetails('${dipendente.id}', '${day.data}')">
                                    <i class="bi bi-eye"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            });
        });
    }

    static renderActivitiesTable(tbody, activities) {
        tbody.innerHTML = '';

        if (!activities || activities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="bi bi-plus-circle me-2"></i>
                        Nessuna attività per questa giornata. Aggiungi la prima attività.
                    </td>
                </tr>
            `;
            return;
        }

        activities.forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)}">${activity.tipo}</span>
                </td>
                <td>${activity.nome}</td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.minuti}" min="0" max="1440"
                           onchange="timeEntryService.updateActivity('${activity.id}', 'minuti', this.value)">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.persone}" min="1" max="50"
                           onchange="timeEntryService.updateActivity('${activity.id}', 'persone', this.value)">
                </td>
                <td>
                    <strong class="text-primary">${activity.minutiEffettivi || activity.minuti}</strong>
                </td>
                <td>
                    <strong class="text-success">${minutesToHHMM(activity.minutiEffettivi || activity.minuti)}</strong>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="timeEntryService.removeActivity('${activity.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    static getActivityBadgeColor(tipo) {
        return BADGE_COLORS[tipo] || 'secondary';
    }

    static setupEmployeeToggle() {
        document.querySelectorAll('.employee-row').forEach(row => {
            row.addEventListener('click', () => {
                const employeeId = row.dataset.employeeId;
                const toggle = row.querySelector('.employee-toggle');
                const employeeDays = document.querySelectorAll(`.employee-days[data-employee-id="${employeeId}"]`);
                
                const isCollapsed = toggle.classList.contains('collapsed');
                
                if (isCollapsed) {
                    toggle.classList.remove('collapsed');
                    employeeDays.forEach(dayRow => {
                        dayRow.classList.add('show');
                    });
                } else {
                    toggle.classList.add('collapsed');
                    employeeDays.forEach(dayRow => {
                        dayRow.classList.remove('show');
                    });
                }
            });
        });
    }
}