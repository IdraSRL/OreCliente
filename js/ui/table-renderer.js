// Table rendering utilities for displaying data in tables

import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';
import { formatDate } from '../utils/date-utils.js';
import { BADGE_COLORS } from '../config/constants.js';

export class TableRenderer {
    // Render activities table for time entry
    static renderActivitiesTable(tbody, activities) {
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!activities || activities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="bi bi-calendar-plus me-2"></i>
                        Nessuna attività inserita per questa giornata
                    </td>
                </tr>
            `;
            return;
        }
        
        // Render simple activities (for time entry)
        const isSimpleView = activities.length > 0 && activities[0].hasOwnProperty('nome') && !activities[0].hasOwnProperty('minuti');
        
        if (isSimpleView) {
            activities.forEach(activity => {
                if (!activity || !activity.id) {
                    console.warn('Attività non valida:', activity);
                    return;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="badge bg-${this.getActivityBadgeColor(activity.tipo)}">${activity.tipo}</span></td>
                    <td>
                        <div class="fw-bold">${this.escapeHtml(activity.nome || 'Attività senza nome')}</div>
                        ${activity.categoriaName ? `<div><span class="badge bg-secondary">${activity.categoriaName}</span></div>` : ''}
                        ${activity.note ? `<small class="text-muted d-block">${this.escapeHtml(activity.note)}</small>` : ''}
                    </td>
                    <td>${minutesToHHMM(activity.minutiEffettivi || activity.minuti || 0)}</td>
                    <td>${minutesToDecimal(activity.minutiEffettivi || activity.minuti || 0)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-activity" aria-label="Elimina attività" data-id="${this.escapeHtml(activity.id)}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            return;
        }
        
        // Render editable activities table (for admin)
        activities.forEach(activity => {
            if (!activity || !activity.id) {
                console.warn('Attività non valida:', activity);
                return;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)}">${activity.tipo}</span>
                </td>
                <td>${this.escapeHtml(activity.nome || 'Attività senza nome')}</td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.minuti || 0}" min="0" max="1440"
                           onchange="timeEntryService.updateActivity('${this.escapeHtml(activity.id)}', 'minuti', this.value)">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.persone || 1}" min="1" max="50"
                           onchange="timeEntryService.updateActivity('${this.escapeHtml(activity.id)}', 'persone', this.value)">
                </td>
                <td>
                    <strong class="text-primary">${activity.minutiEffettivi || activity.minuti || 0}</strong>
                </td>
                <td>
                    <strong class="text-success">${minutesToHHMM(activity.minutiEffettivi || activity.minuti || 0)}</strong>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="timeEntryService.removeActivity('${this.escapeHtml(activity.id)}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Helper method to escape HTML
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Render hierarchical view for admin reports
    static renderHierarchicalView(tbody, data) {
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="bi bi-search me-2"></i>
                        Nessun dato trovato per i filtri selezionati
                    </td>
                </tr>
            `;
            return;
        }
        
        data.forEach(employeeData => {
            // Employee header row
            const employeeRow = document.createElement('tr');
            employeeRow.className = 'table-primary employee-row';
            employeeRow.style.cursor = 'pointer';
            employeeRow.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <i class="bi bi-chevron-down me-2 toggle-icon"></i>
                        <div>
                            <div class="fw-bold">${employeeData.dipendente.name}</div>
                            <small class="text-muted d-md-none">${employeeData.ore?.length || 0} giorni • ${employeeData.totalHours}</small>
                        </div>
                    </div>
                </td>
                <td class="d-none d-md-table-cell"><strong>${employeeData.ore?.length || 0}</strong></td>
                <td><strong>${employeeData.totalMinutes}</strong></td>
                <td><strong class="text-primary">${employeeData.totalHours}</strong></td>
                <td class="d-none d-md-table-cell"><strong>${employeeData.totalDecimal}</strong></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-sm" onclick="adminService.editEmployeeActivities('${employeeData.dipendente.id}')" title="Modifica attività">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(employeeRow);
            
            // Days container
            const daysContainer = document.createElement('tr');
            daysContainer.className = 'days-container';
            daysContainer.innerHTML = `
                <td colspan="6" class="p-0">
                    <div class="collapse show" id="days-${employeeData.dipendente.id}">
                        <table class="table table-sm mb-0">
                            <tbody class="days-tbody">
                                ${this.renderEmployeeDays(employeeData)}
                            </tbody>
                        </table>
                    </div>
                </td>
            `;
            tbody.appendChild(daysContainer);
        });
    }
    
    // Render flat view for admin reports
    static renderFlatView(tbody, data) {
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="bi bi-search me-2"></i>
                        Nessun dato trovato per i filtri selezionati
                    </td>
                </tr>
            `;
            return;
        }
        
        data.forEach(employeeData => {
            employeeData.ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    day.attivita.forEach(activity => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>
                                <div class="fw-bold">${employeeData.dipendente.name}</div>
                                <div class="text-muted small">${formatDate(day.data).split(',')[0]}</div>
                                <div class="mt-1">
                                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)} me-1">${activity.tipo}</span>
                                    <span class="d-md-none small">${activity.nome.substring(0, 15)}${activity.nome.length > 15 ? '...' : ''}</span>
                                    <span class="d-none d-md-inline small">${activity.nome}</span>
                                </div>
                            </td>
                            <td class="d-none d-md-table-cell">1</td>
                            <td>${activity.minutiEffettivi || activity.minuti}</td>
                            <td class="text-primary fw-bold">${minutesToHHMM(activity.minutiEffettivi || activity.minuti)}</td>
                            <td class="d-none d-md-table-cell">${minutesToDecimal(activity.minutiEffettivi || activity.minuti)}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-info" onclick="adminService.viewDayDetails('${employeeData.dipendente.id}', '${day.data}')" title="Dettagli giornata">
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
    
    // Render employee days for hierarchical view
    static renderEmployeeDays(employeeData) {
        if (!employeeData.ore || employeeData.ore.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-3 text-muted">
                        <i class="bi bi-calendar-x me-1"></i>
                        Nessuna attività registrata
                    </td>
                </tr>
            `;
        }
        
        return employeeData.ore.map(day => {
            let dayMinutes = 0;
            if (day.attivita) {
                dayMinutes = day.attivita.reduce((sum, activity) => 
                    sum + (activity.minutiEffettivi || activity.minuti || 0), 0);
            }
            
            return `
                <tr class="day-row">
                    <td class="ps-4">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-calendar-day me-2"></i>
                            <div>
                                <div class="fw-bold">${formatDate(day.data).split(',')[0]}</div>
                                <div class="d-flex gap-1 mt-1">
                                    <span class="badge bg-${this.getStatusBadgeColor(day.stato)}">${day.stato}</span>
                                    <span class="badge bg-secondary d-md-none small">${day.attivita ? day.attivita.length : 0} att.</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="d-none d-md-table-cell">${day.attivita ? day.attivita.length : 0}</td>
                    <td>${dayMinutes}</td>
                    <td class="text-success fw-bold">${minutesToHHMM(dayMinutes)}</td>
                    <td class="d-none d-md-table-cell">${minutesToDecimal(dayMinutes)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="adminService.viewDayDetails('${employeeData.dipendente.id}', '${day.data}')" title="Dettagli giornata">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Setup employee toggle functionality
    static setupEmployeeToggle() {
        document.querySelectorAll('.employee-row').forEach(row => {
            row.addEventListener('click', function() {
                const icon = this.querySelector('.toggle-icon');
                const employeeId = this.querySelector('button').onclick.toString().match(/'([^']+)'/)[1];
                const collapse = document.getElementById(`days-${employeeId}`);
                
                if (collapse) {
                    const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
                    
                    if (collapse.classList.contains('show')) {
                        bsCollapse.hide();
                        icon.className = 'bi bi-chevron-right me-2 toggle-icon';
                    } else {
                        bsCollapse.show();
                        icon.className = 'bi bi-chevron-down me-2 toggle-icon';
                    }
                }
            });
        });
    }
    
    // Get badge color for activity type
    static getActivityBadgeColor(tipo) {
        return BADGE_COLORS[tipo] || 'secondary';
    }
    
    // Get badge color for day status
    static getStatusBadgeColor(stato) {
        return BADGE_COLORS[stato.toLowerCase()] || 'secondary';
    }
}