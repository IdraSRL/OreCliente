// Report management module for time entry
import { FirestoreService } from '../services/firestore-service.js';
import { getMonthRange, formatDate, getMonthName } from '../utils/date-utils.js';
import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';
import { showToast, showGlobalLoading } from '../utils/ui-utils.js';

export class ReportManager {
    constructor(employeeId) {
        this.employeeId = employeeId;
        this.setupEventListeners();
        this.populateYears();
    }

    setupEventListeners() {
        const reportMonth = document.getElementById('reportMonth');
        const reportYear = document.getElementById('reportYear');
        const loadReportBtn = document.getElementById('loadReportBtn');
        
        if (reportMonth) {
            reportMonth.addEventListener('change', () => this.loadReport());
        }
        
        if (reportYear) {
            reportYear.addEventListener('change', () => this.loadReport());
        }

        if (loadReportBtn) {
            loadReportBtn.addEventListener('click', () => this.loadReport());
        }
    }

    populateYears() {
        const yearSelect = document.getElementById('reportYear');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';

        for (let year = currentYear - 2; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }

        // Set current month
        const reportMonth = document.getElementById('reportMonth');
        if (reportMonth) {
            reportMonth.value = new Date().getMonth() + 1;
        }
    }

    async loadReport() {
        const month = parseInt(document.getElementById('reportMonth')?.value) || new Date().getMonth() + 1;
        const year = parseInt(document.getElementById('reportYear')?.value) || new Date().getFullYear();

        try {
            showGlobalLoading(true, 'Caricamento report...');

            const { start, end } = getMonthRange(year, month);
            const ore = await FirestoreService.getOrePeriodo(this.employeeId, start, end);
            
            this.renderReport(ore, month, year);
        } catch (error) {
            console.error('Errore caricamento report:', error);
            showToast('Errore caricamento report', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    renderReport(ore, month, year) {
        const tbody = document.querySelector('#reportTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const stats = this.calculateStats(ore);
        this.updateStats(stats);

        if (!ore || ore.length === 0) {
            tbody.innerHTML = this.getEmptyReportHTML();
            this.updateCantieriList([]);
            return;
        }

        this.renderReportTable(tbody, ore);
        this.updateCantieriList(stats.cantieriDetails);
    }

    calculateStats(ore) {
        let totalMinutes = 0;
        let totalDays = 0;
        let totalActivities = 0;
        const cantieriDetails = new Map();

        ore.forEach(day => {
            let dayMinutes = 0;
            let dayActivities = 0;

            if (Array.isArray(day.attivita) && day.attivita.length > 0) {
                totalDays++;
                dayActivities = day.attivita.length;

                day.attivita.forEach(activity => {
                    const minutes = activity.minutiEffettivi || activity.minuti || 0;
                    dayMinutes += minutes;

                    // Track cantieri details
                    if (activity.tipo === 'cantiere' && activity.nome) {
                        const cantiereKey = activity.nome;
                        if (!cantieriDetails.has(cantiereKey)) {
                            cantieriDetails.set(cantiereKey, {
                                nome: activity.nome,
                                totalMinutes: 0,
                                giorni: new Set(),
                                categoria: activity.categoriaName || 'Generale'
                            });
                        }
                        const cantiere = cantieriDetails.get(cantiereKey);
                        cantiere.totalMinutes += minutes;
                        cantiere.giorni.add(formatDate(day.data).split(',')[0]);
                    }
                });
            }

            totalMinutes += dayMinutes;
            totalActivities += dayActivities;
        });

        return {
            totalMinutes,
            totalHours: minutesToHHMM(totalMinutes),
            totalDecimal: minutesToDecimal(totalMinutes),
            totalDays,
            totalActivities,
            cantieriDetails: Array.from(cantieriDetails.values()).map(cantiere => ({
                ...cantiere,
                totalHours: minutesToHHMM(cantiere.totalMinutes),
                giorni: Array.from(cantiere.giorni)
            }))
        };
    }

    updateStats(stats) {
        const elements = {
            reportTotalHours: stats.totalHours,
            reportTotalDecimal: stats.totalDecimal,
            reportWorkingDays: stats.totalDays,
            reportTotalActivities: stats.totalActivities
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    getEmptyReportHTML() {
        return `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <i class="bi bi-calendar-x me-2"></i>
                    Nessuna attività registrata per il periodo selezionato
                </td>
            </tr>
        `;
    }

    renderReportTable(tbody, ore) {
        ore.forEach(day => {
            const dayMinutes = this.calculateDayMinutes(day);
            const dayActivities = day.attivita ? day.attivita.length : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(day.data)}</td>
                <td><span class="badge bg-${this.getStatusBadgeColor(day.stato)}">${day.stato || 'Normale'}</span></td>
                <td>${dayActivities}</td>
                <td>${minutesToHHMM(dayMinutes)}</td>
                <td>${minutesToDecimal(dayMinutes)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    calculateDayMinutes(day) {
        if (!day.attivita || !Array.isArray(day.attivita)) return 0;
        
        return day.attivita.reduce((sum, activity) => {
            const minutes = activity.minutiEffettivi || activity.minuti || 0;
            return sum + (Number.isFinite(minutes) ? minutes : 0);
        }, 0);
    }

    getStatusBadgeColor(stato) {
        const colors = {
            'Normale': 'success',
            'Riposo': 'secondary',
            'Ferie': 'warning',
            'Malattia': 'danger'
        };
        return colors[stato] || 'secondary';
    }

    updateCantieriList(cantieriDetails) {
        const cantieriListElement = document.getElementById('reportCantieriList');
        if (!cantieriListElement) return;

        if (!cantieriDetails || cantieriDetails.length === 0) {
            cantieriListElement.innerHTML = this.getEmptyCantieriHTML();
            return;
        }

        // Sort by total minutes (descending)
        cantieriDetails.sort((a, b) => b.totalMinutes - a.totalMinutes);

        const cantieriHtml = cantieriDetails.map(cantiere => `
            <div class="card mb-3">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-building text-success me-2"></i>
                            <div>
                                <h6 class="mb-1 fw-bold">${cantiere.nome}</h6>
                                <small class="text-muted">${cantiere.categoria}</small>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-primary">${cantiere.totalHours}</div>
                            <small class="text-muted">${minutesToDecimal(cantiere.totalMinutes)} ore</small>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="bi bi-calendar-check me-1"></i>
                            ${cantiere.giorni.length} giorni lavorati
                        </small>
                        <small class="text-muted">
                            ${cantiere.totalMinutes} minuti totali
                        </small>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted d-block">
                            <strong>Giorni:</strong> ${cantiere.giorni.join(', ')}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');

        cantieriListElement.innerHTML = `
            <div class="mb-2">
                <strong class="text-primary">
                    <i class="bi bi-list-ul me-1"></i>
                    Cantieri lavorati (${cantieriDetails.length}):
                </strong>
            </div>
            ${cantieriHtml}
        `;
    }

    getEmptyCantieriHTML() {
        return `
            <div class="text-center text-muted py-3">
                <i class="bi bi-building me-2"></i>
                Nessun cantiere registrato nel periodo selezionato
            </div>
        `;
    }
}