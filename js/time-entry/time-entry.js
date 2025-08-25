import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../services/firestore-service.js';
import { BadgeService } from '../services/badge-service.js';
import { CantiereService } from '../services/cantiere-service.js';
import { TableRenderer } from '../ui/table-renderer.js';
import { GridRenderer } from '../ui/grid-renderer.js';
import { FormHandlers } from '../ui/form-handlers.js';
import { ButtonUtils } from '../ui/button-utils.js';
import { 
    debounce,
    generateId
} from '../utils/utils.js';
import { showToast, showConfirm } from '../utils/ui-utils.js';
import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';
import { getTodayString, getYesterdayString, isDateAllowed, getMonthRange, formatDate } from '../utils/date-utils.js';
import { BADGE_COLORS } from '../config/constants.js';

class TimeEntryService {
    constructor() {
        this.currentUser = null;
        this.currentDate = null;
        this.currentData = null;
        this.cantieri = [];
        this.employeeData = null;
        this.badgeService = null;
        this.cantiereService = new CantiereService();
        this.debouncedSave = debounce(() => this.saveData(), 1000);
        this.selectedCantiere = null;
        this.badgeTimer = null;
        this.currentReportFilter = {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        };
        this.init();
    }

    async init() {
        // Verifica autenticazione dipendente
        if (!AuthService.initPageProtection('employee')) {
            return;
        }

        this.currentUser = AuthService.getCurrentUser();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Carica dati iniziali
        await this.loadInitialData();
        
        // Carica dati dipendente per il badge
        await this.loadEmployeeData();
        
        // Inizializza badge service
        this.badgeService = new BadgeService(this.currentUser.id);
        await this.badgeService.loadBadgeState();
        
        // Avvia timer badge se attivo
        if (this.badgeService.isActive()) {
            this.startBadgeTimer();
        }
        
        // Imposta data di default (oggi)
        this.setDefaultDate();
        
        // Inizializza report
        this.initializeReport();
    }

    setupEventListeners() {
        // Logout
        AuthService.setupLogoutHandlers();

        // Cambio data
        const workDateElement = document.getElementById('workDate');
        if (workDateElement) {
            workDateElement.addEventListener('change', (e) => {
                this.changeDate(e.target.value);
            });
        }

        // Carica giornata
        const loadDayBtnElement = document.getElementById('loadDayBtn');
        if (loadDayBtnElement) {
            loadDayBtnElement.addEventListener('click', () => {
                this.loadCurrentDay();
            });
        }

        // Cambio stato
        const dayStatusElement = document.getElementById('dayStatus');
        if (dayStatusElement) {
            dayStatusElement.addEventListener('change', () => {
                this.updateStatus();
            });
        }

        // Forms
        const cantiereFormElement = document.getElementById('cantiereForm');
        if (cantiereFormElement) {
            cantiereFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addCantiereActivity();
            });
        }

        const pstFormElement = document.getElementById('pstForm');
        if (pstFormElement) {
            pstFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addPSTActivity();
            });
        }

        // Badge button
        const badgeBtnElement = document.getElementById('badgeBtn');
        if (badgeBtnElement) {
            badgeBtnElement.addEventListener('click', () => {
                this.toggleBadge();
            });
        }

        // Modal events
        const cantiereModalElement = document.getElementById('cantiereModal');
        if (cantiereModalElement) {
            cantiereModalElement.addEventListener('show.bs.modal', () => {
                this.loadCantieriSelect();
                // Reset selezione
                this.selectedCantiere = null;
                const addSelectedCantiereBtnElement = document.getElementById('addSelectedCantiereBtn');
                if (addSelectedCantiereBtnElement) {
                    addSelectedCantiereBtnElement.disabled = true;
                }
            });
        }

        // Badge modal events
        const badgeModalElement = document.getElementById('badgeModal');
        if (badgeModalElement) {
            badgeModalElement.addEventListener('show.bs.modal', () => {
                this.updateBadgeInfo();
            });
        }

        // Report events
        const loadReportBtnElement = document.getElementById('loadReportBtn');
        if (loadReportBtnElement) {
            loadReportBtnElement.addEventListener('click', () => {
                this.loadMonthlyReport();
            });
        }

        // Setup activity forms
        FormHandlers.setupActivityForms(
            () => this.addSelectedCantiere(),
            (data) => this.addPSTActivityFromData(data)
        );
    }

    async loadInitialData() {
        try {
            // Carica cantieri tramite il service
            await this.cantiereService.loadCantieri();
            this.cantieri = this.cantiereService.getAllCantieri();
        } catch (error) {
            console.error('Errore caricamento dati iniziali:', error);
            showToast('Errore caricamento dati iniziali', 'error');
        }
    }

    async loadEmployeeData() {
        try {
            const employees = await FirestoreService.getEmployees();
            this.employeeData = employees.find(emp => emp.id === this.currentUser.id);
            
            if (!this.employeeData) {
                console.warn('Dati dipendente non trovati');
                // Crea dati di fallback
                this.employeeData = {
                    id: this.currentUser.id,
                    name: this.currentUser.name,
                    nome: this.currentUser.name ? this.currentUser.name.split(' ')[0] || '' : '',
                    cognome: this.currentUser.name ? this.currentUser.name.split(' ').slice(1).join  || '' : '',
                    codiceFiscale: 'N/A',
                    matricola: this.currentUser.id.toUpperCase(),
                    foto: null,
                    ruolo: 'Dipendente'
                };
            }
        } catch (error) {
            console.error('Errore caricamento dati dipendente:', error);
            // Dati di fallback in caso di errore
            this.employeeData = {
                id: this.currentUser.id,
                name: this.currentUser.name || 'Dipendente',
                nome: this.currentUser.name ? this.currentUser.name.split(' ')[0] || '' : '',
                cognome: this.currentUser.name ? this.currentUser.name.split(' ').slice(1).join(' ') || '' : '',
                codiceFiscale: 'N/A',
                matricola: this.currentUser.id.toUpperCase(),
                foto: null,
                ruolo: 'Dipendente'
            };
        }
    }
    setDefaultDate() {
        const today = getTodayString();
        document.getElementById('workDate').value = today;
        this.changeDate(today);
                cognome: this.currentUser.name ? this.currentUser.name.split(' ').slice(1).join(' ') || '' : '',
    }
    async changeDate(newDate) {
        if (!newDate) return;

        // Verifica che la data sia consentita per dipendenti
        if (!isDateAllowed(newDate)) {
            showToast('Puoi inserire ore solo per oggi o ieri. Per altre date contatta l\'amministratore.', 'warning');
            this.setDefaultDate();
            return;
        }

        this.currentDate = newDate;
        this.updateDateDisplay();
        await this.loadCurrentDay();
    }
    
    initializeReport() {
        // Popola anni per il report (ultimi 2 anni + prossimi 2)
        const reportYearSelect = document.getElementById('reportYear');
        if (reportYearSelect) {
            const currentYear = new Date().getFullYear();
            reportYearSelect.innerHTML = '';
            
            for (let year = currentYear - 2; year <= currentYear + 2; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) option.selected = true;
                reportYearSelect.appendChild(option);
            }
        }
        
        // Imposta mese corrente
        const reportMonthSelect = document.getElementById('reportMonth');
        if (reportMonthSelect) {
            reportMonthSelect.value = this.currentReportFilter.month;
        }
        
        // Carica report iniziale
        this.loadMonthlyReport();
    }
    
    async loadMonthlyReport() {
        const monthSelect = document.getElementById('reportMonth');
        const yearSelect = document.getElementById('reportYear');
        const btn = document.getElementById('loadReportBtn');
        
        if (!monthSelect || !yearSelect) return;
        
        this.currentReportFilter = {
            month: parseInt(monthSelect.value),
            year: parseInt(yearSelect.value)
        };
        
        try {
            ButtonUtils.showLoading(btn, 'Caricamento...');
            
            const { start, end } = getMonthRange(this.currentReportFilter.year, this.currentReportFilter.month);
            const reportData = await FirestoreService.getOrePeriodo(this.currentUser.id, start, end);
            
            this.updateReportTable(reportData);
            this.updateReportStats(reportData);
            
        } catch (error) {
            console.error('Errore caricamento report:', error);
            showToast('Errore caricamento report mensile', 'error');
        } finally {
            ButtonUtils.hideLoading(btn, '<i class="bi bi-search me-1"></i>Carica Report');
        }
    }
    
    updateReportTable(reportData) {
        const tbody = document.querySelector('#reportTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!reportData || reportData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <i class="bi bi-calendar-x me-2"></i>
                        Nessuna attività trovata per il periodo selezionato
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordina per data (più recenti prima)
        reportData.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        reportData.forEach(day => {
            if (day.attivita && day.attivita.length > 0) {
                let dayMinutes = 0;
                day.attivita.forEach(activity => {
                    dayMinutes += activity.minutiEffettivi || activity.minuti || 0;
                });
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="fw-bold">${formatDate(day.data)}</div>
                        <small class="text-muted">${new Date(day.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short' })}</small>
                    </td>
                    <td>
                        <span class="badge bg-${this.getStatusBadgeColor(day.stato)}">${day.stato}</span>
                    </td>
                    <td>
                        <div class="small">
                            ${day.attivita.map(activity => `
                                <div class="mb-1">
                                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)} me-1">${activity.tipo}</span>
                                    ${activity.nome}
                                    <small class="text-muted">(${minutesToHHMM(activity.minutiEffettivi || activity.minuti)})</small>
                                </div>
                            `).join('')}
                        </div>
                    </td>
                    <td>
                        <strong class="text-success">${minutesToHHMM(dayMinutes)}</strong>
                    </td>
                    <td>
                        <strong class="text-primary">${minutesToDecimal(dayMinutes)}</strong>
                    </td>
                `;
                tbody.appendChild(row);
            }
        });
    }
    
    updateReportStats(reportData) {
        let totalMinutes = 0;
        let workingDays = 0;
        let totalActivities = 0;
        
        reportData.forEach(day => {
            if (day.attivita && day.attivita.length > 0) {
                workingDays++;
                totalActivities += day.attivita.length;
                day.attivita.forEach(activity => {
                    totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
                });
            }
        });
        
        document.getElementById('reportTotalHours').textContent = minutesToHHMM(totalMinutes);
        document.getElementById('reportTotalDecimal').textContent = minutesToDecimal(totalMinutes);
        document.getElementById('reportWorkingDays').textContent = workingDays;
        document.getElementById('reportTotalActivities').textContent = totalActivities;
    }
    
    getStatusBadgeColor(stato) {
        return BADGE_COLORS[stato.toLowerCase()] || 'secondary';
    }
    
    getActivityBadgeColor(tipo) {
        return BADGE_COLORS[tipo] || 'secondary';
    }

    updateDateDisplay() {
        if (!this.currentDate) return;

        const date = new Date(this.currentDate + 'T00:00:00');
        const formatted = date.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('selectedDateDisplay').textContent = formatted;

        const today = getTodayString();
        const yesterday = getYesterdayString();
        
        let badge = '';
        if (this.currentDate === today) {
            badge = 'Oggi';
        } else if (this.currentDate === yesterday) {
            badge = 'Ieri';
        }
        
        document.getElementById('selectedDateBadge').textContent = badge;
    }

    async loadCurrentDay() {
        if (!this.currentDate) return;

        try {
            const btn = document.getElementById('loadDayBtn');
            ButtonUtils.showLoading(btn, 'Caricamento...');

            this.currentData = await FirestoreService.getOreLavorative(
                this.currentUser.id, 
                this.currentDate
            );

            // Aggiorna UI
            document.getElementById('dayStatus').value = this.currentData.stato || 'Normale';
            this.updateUI();
            this.updateLastSaved();

        } catch (error) {
            console.error('Errore caricamento giornata:', error);
            showToast('Errore caricamento dati', 'error');
        } finally {
            const btn = document.getElementById('loadDayBtn');
            ButtonUtils.hideLoading(btn, '<i class="bi bi-arrow-clockwise me-2"></i>Carica');
        }
    }

    updateStatus() {
        if (!this.currentData) return;
        
        this.currentData.stato = document.getElementById('dayStatus').value;
    }

    // === GESTIONE CANTIERI ===
    async loadCantieriSelect() {
        // Carica cantieri e categorie
        try {
            await this.cantiereService.loadCantieri();
            await this.cantiereService.loadCategorie();
        } catch (error) {
            console.error('Errore caricamento cantieri:', error);
            showToast('Errore caricamento cantieri', 'error');
            return;
        }
        
        const cantieriByCategoria = this.cantiereService.getCantieriByCategoria();
        
        // Popola il modal con cantieri per categoria
        this.populateCantieriModal(cantieriByCategoria);
    }

    populateCantieriModal(cantieriByCategoria) {
        const container = document.getElementById('cantieriContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        Object.values(cantieriByCategoria).forEach(group => {
            if (!group || !group.cantieri || group.cantieri.length === 0) return;
            
            const categorySection = document.createElement('div');
            categorySection.className = 'mb-4';
            
            categorySection.innerHTML = `
                <div class="d-flex align-items-center mb-3">
                    <div class="rounded-circle p-2 me-3" style="background-color: ${group.categoria.color}20; border: 2px solid ${group.categoria.color};">
                        <i class="bi ${group.categoria.icon}" style="color: ${group.categoria.color}; font-size: 1.2rem;"></i>
                    </div>
                    <h6 class="mb-0 text-uppercase fw-bold" style="color: ${group.categoria.color};">
                        ${group.categoria.name}
                    </h6>
                </div>
                <div class="row g-2" id="cantieri-${group.categoria.id}">
                </div>
            `;
            
            container.appendChild(categorySection);
            
            const cantieriRow = document.getElementById(`cantieri-${group.categoria.id}`);
            if (!cantieriRow) return;
            
            group.cantieri.forEach(cantiere => {
                const cantiereCard = document.createElement('div');
                cantiereCard.className = 'col-md-6';
                
                cantiereCard.innerHTML = `
                    <div class="card cantiere-card h-100" style="cursor: pointer; transition: all 0.3s ease;" 
                         data-cantiere-id="${cantiere.id}" data-cantiere-name="${cantiere.name}" 
                         data-cantiere-minutes="${cantiere.minutes}">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center">
                                <div class="rounded p-2 me-3" style="background-color: ${group.categoria.color}20;">
                                    <i class="bi ${group.categoria.icon}" style="color: ${group.categoria.color};"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">${cantiere.name}</h6>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-muted">${minutesToHHMM(cantiere.minutes)}</small>
                                        <span class="badge bg-primary">${cantiere.minutes} min</span>
                                    </div>
                                    ${cantiere.descrizione ? `<small class="text-muted d-block mt-1">${cantiere.descrizione}</small>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                cantieriRow.appendChild(cantiereCard);
            });
        });
        
        // Se non ci sono cantieri, mostra messaggio
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-building display-1 text-muted mb-3"></i>
                    <h5 class="text-muted">Nessun cantiere disponibile</h5>
                    <p class="text-muted">Contatta l'amministratore per configurare i cantieri</p>
                </div>
            `;
        }
        
        // Aggiungi event listeners per le card
        container.querySelectorAll('.cantiere-card').forEach(card => {
            card.addEventListener('click', () => {
                // Rimuovi selezione precedente
                container.querySelectorAll('.cantiere-card').forEach(c => {
                    c.style.borderColor = '';
                    c.style.backgroundColor = '';
                });
                
                // Seleziona questa card
                card.style.borderColor = 'var(--custom-accent)';
                card.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
                
                // Salva selezione
                this.selectedCantiere = {
                    id: card.dataset.cantiereId,
                    name: card.dataset.cantiereName,
                    minutes: parseInt(card.dataset.cantiereMinutes)
                };
                
                // Abilita pulsante aggiungi
                document.getElementById('addSelectedCantiereBtn').disabled = false;
            });
            
            // Hover effects
            card.addEventListener('mouseenter', () => {
                if (!card.style.borderColor) {
                    card.style.transform = 'translateY(-2px)';
                    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                if (!card.style.borderColor) {
                    card.style.transform = '';
                    card.style.boxShadow = '';
                }
            });
        });
    }

    async addSelectedCantiere() {
        if (!this.selectedCantiere) {
            showToast('Seleziona un cantiere', 'warning');
            return;
        }
        
        return this.addCantiereActivity(this.selectedCantiere.id);
    }

    async addCantiereActivity(cantiereId) {
        if (!this.currentData) {
            showToast('Carica prima una giornata', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('addSelectedCantiereBtn');
            ButtonUtils.showLoading(btn, 'Aggiunta...');

            const cantiere = this.cantieri.find(c => c.id === cantiereId);
            if (!cantiere) {
                showToast('Cantiere non trovato', 'error');
                return;
            }

            const personeValue = parseInt(document.getElementById('cantierePersone').value) || 1;

            const activity = {
                id: generateId('cantiere'),
                nome: cantiere.name,
                minuti: cantiere.minutes,
                persone: personeValue,
                minutiEffettivi: Math.round(cantiere.minutes / personeValue),
                tipo: 'cantiere',
                categoria: cantiere.categoria || 'generale'
            };

            this.currentData.attivita = this.currentData.attivita || [];
            this.currentData.attivita.push(activity);

            // Reset selezione e chiudi modal
            this.selectedCantiere = null;
            document.getElementById('cantierePersone').value = '1';
            bootstrap.Modal.getInstance(document.getElementById('cantiereModal')).hide();

            this.updateUI();
            this.debouncedSave();

            showToast('Cantiere aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore aggiunta cantiere:', error);
            showToast('Errore aggiunta cantiere', 'error');
        } finally {
            const btn = document.getElementById('addSelectedCantiereBtn');
            ButtonUtils.hideLoading(btn, '<i class="bi bi-plus me-2"></i>Aggiungi Cantiere');
        }
    }

    // === GESTIONE PST ===
    async addPSTActivityFromData({ nome, minuti, persone }) {
        return this.addPSTActivity(nome, minuti, persone);
    }

    async addPSTActivity(nome, minuti, persone) {
        if (!this.currentData) {
            showToast('Carica prima una giornata', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('addPSTBtn');
            ButtonUtils.showLoading(btn, 'Aggiunta...');

            const activity = {
                id: generateId('pst'),
                nome: nome,
                minuti: minuti,
                persone: persone,
                minutiEffettivi: Math.round(minuti / persone),
                tipo: 'pst'
            };

            this.currentData.attivita = this.currentData.attivita || [];
            this.currentData.attivita.push(activity);

            // Reset form e chiudi modal
            document.getElementById('pstForm').reset();
            document.getElementById('pstMinutes').value = '480';
            document.getElementById('pstPersone').value = '1';
            bootstrap.Modal.getInstance(document.getElementById('pstModal')).hide();

            this.updateUI();
            this.debouncedSave();

            showToast('Attività PST aggiunta con successo', 'success');

        } catch (error) {
            console.error('Errore aggiunta PST:', error);
            showToast('Errore aggiunta attività', 'error');
        } finally {
            const btn = document.getElementById('addPSTBtn');
            ButtonUtils.hideLoading(btn, '<i class="bi bi-plus me-2"></i>Aggiungi PST');
        }
    }

    // === GESTIONE ATTIVITÀ ===
    updateActivity(activityId, field, value) {
        if (!this.currentData || !this.currentData.attivita) return;

        const activity = this.currentData.attivita.find(a => a.id === activityId);
        if (!activity) return;

        if (field === 'minuti') {
            const minuti = parseInt(value);
            if (validateMinutes(minuti)) {
                activity.minuti = minuti;
                activity.minutiEffettivi = Math.round(minuti / activity.persone);
                this.updateUI();
                this.debouncedSave();
            }
        } else if (field === 'persone') {
            const persone = parseInt(value);
            if (validatePersone(persone)) {
                activity.persone = persone;
                activity.minutiEffettivi = Math.round(activity.minuti / persone);
                this.updateUI();
                this.debouncedSave();
            }
        }
    }

    async removeActivity(activityId) {
        if (!this.currentData || !this.currentData.attivita) return;

        // Trova l'attività da rimuovere
        const activityToRemove = this.currentData.attivita.find(a => a.id === activityId);
        if (!activityToRemove) return;

        const confirmed = await showConfirm(
            'Rimuovi Attività',
            'Sei sicuro di voler rimuovere questa attività?',
            'Rimuovi',
            'Annulla',
            'danger'
        );
        
        if (confirmed) {
            // Se è un'attività badge, aggiorna anche il badge service
            if (activityToRemove.tipo === 'badge' && this.badgeService) {
                try {
                    // Aggiorna lo stato badge rimuovendo i minuti dell'attività
                    const badgeState = this.badgeService.getBadgeState();
                    badgeState.totalMinutes = Math.max(0, badgeState.totalMinutes - (activityToRemove.minutiEffettivi || activityToRemove.minuti || 0));
                    
                    // Trova e rimuovi la sessione corrispondente dall'array sessions
                    if (badgeState.sessions) {
                        // Trova la sessione più recente con gli stessi minuti
                        const activityMinutes = activityToRemove.minutiEffettivi || activityToRemove.minuti || 0;
                        const sessionIndex = badgeState.sessions.findIndex(session => 
                            (session.minutes || 0) === activityMinutes
                        );
                        
                        // Aggiorna i minuti badge nel service
                        this.badgeService.updateBadgeMinutesFromActivities(this.currentData);
                        
                        if (sessionIndex !== -1) {
                            badgeState.sessions.splice(sessionIndex, 1);
                        }
                    }
                    
                    // Aggiorna il badge service con il nuovo stato
                    this.badgeService.updateBadgeState(badgeState);
                    await this.badgeService.saveBadgeState();
                    
                    // Aggiorna l'UI del badge
                    this.updateBadgeUI();
                } catch (error) {
                    console.error('Errore aggiornamento stato badge:', error);
                    showToast('Errore aggiornamento badge', 'warning');
                }
            }
            
            this.currentData.attivita = this.currentData.attivita.filter(a => a.id !== activityId);
            this.updateUI();
            this.debouncedSave();
            
            const activityType = activityToRemove.tipo === 'badge' ? 'badge' : 'attività';
            showToast(`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} rimossa`, 'info');
        }
    }

    // === UI UPDATES ===
    updateUI() {
        this.updateActivitiesTable();
        this.updateStats();
        this.updateBadgeUI();
    }

    updateActivitiesTable() {
        const activities = this.currentData?.attivita || [];
        const tbody = document.querySelector('#activitiesTable tbody');
        TableRenderer.renderActivitiesTable(tbody, activities);
    }

    updateStats() {
        const activities = this.currentData?.attivita || [];
        
        let totalMinutes = 0;
        activities.forEach(activity => {
            totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
        });

        document.getElementById('totalHours').textContent = minutesToHHMM(totalMinutes);
        document.getElementById('totalDecimal').textContent = minutesToDecimal(totalMinutes);
        document.getElementById('totalActivities').textContent = activities.length;
        document.getElementById('activityCount').textContent = `${activities.length} attività`;
        
        // Aggiorna anche le versioni mobile
        const totalHoursMobile = document.getElementById('totalHoursMobile');
        const totalDecimalMobile = document.getElementById('totalDecimalMobile');
        const totalActivitiesMobile = document.getElementById('totalActivitiesMobile');
        const badgeHoursMobile = document.getElementById('badgeHoursMobile');
        
        if (totalHoursMobile) totalHoursMobile.textContent = minutesToHHMM(totalMinutes);
        if (totalDecimalMobile) totalDecimalMobile.textContent = minutesToDecimal(totalMinutes);
        if (totalActivitiesMobile) totalActivitiesMobile.textContent = activities.length;
        if (badgeHoursMobile && this.badgeService) {
            badgeHoursMobile.textContent = this.badgeService.getFormattedTotalHours();
        }
    }

    updateBadgeUI() {
        const badgeBtn = document.getElementById('badgeBtn');
        const badgeHours = document.getElementById('badgeHours');
        const badgeStatus = document.getElementById('badgeStatus');
        const badgeText = document.getElementById('badgeText');

        if (!badgeBtn) return; // Exit if badge elements don't exist

        // Aggiorna sempre le ore badge totali
        if (badgeHours) {
            badgeHours.textContent = this.badgeService.getFormattedTotalHours();
        }
        if (this.badgeService.isActive()) {
            // Badge is active (clocked in)
            badgeBtn.className = 'btn btn-danger btn-lg';
            
            const entryTime = this.badgeService.getFormattedEntryTime();
            const currentDuration = this.badgeService.getFormattedCurrentSessionDuration();
            
            badgeBtn.innerHTML = `
                <i class="bi bi-stop-circle me-2"></i>
                <span class="d-none d-md-inline">Termina Turno</span>
                <span class="d-md-none">Stop</span>
            `;
            
            if (badgeStatus) {
                badgeStatus.textContent = 'IN SERVIZIO';
                badgeStatus.className = 'badge bg-success';
            }
            
            if (badgeText) {
                badgeText.textContent = `Entrata: ${entryTime} | Durata: ${currentDuration}`;
            }
        } else {
            // Badge is inactive (clocked out)
            badgeBtn.className = 'btn btn-success btn-lg';
            badgeBtn.innerHTML = `
                <i class="bi bi-play-circle me-2"></i>
                <span class="d-none d-md-inline">Inizia Turno</span>
                <span class="d-md-none">Start</span>
            `;
            
            if (badgeStatus) {
                badgeStatus.textContent = 'FUORI SERVIZIO';
                badgeStatus.className = 'badge bg-secondary';
            }
            
            if (badgeText) {
                const exitTime = this.badgeService.getExitTime();
                if (exitTime) {
                    const timeString = exitTime.toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    badgeText.textContent = `Ultima uscita: ${timeString}`;
                } else {
                    badgeText.textContent = 'Pronto per iniziare';
                }
            }
        }
    }

    async toggleBadge() {
        if (!this.badgeService) {
            showToast('Errore: stato badge non inizializzato', 'error');
            return;
        }
        
        if (this.badgeService.isActive()) {
            // Clock out
            const confirmed = await showConfirm(
                'Termina Turno',
                'Sei sicuro di voler terminare il turno corrente?',
                'Termina Turno',
                'Annulla',
                'warning'
            );
            
            if (!confirmed) return;
            
            try {
                const sessionData = await this.badgeService.clockOut();
                
                // Create badge activity only if we have current data loaded
                if (this.currentData && sessionData.sessionMinutes > 0) {
                    const badgeActivity = this.badgeService.createBadgeActivity(sessionData);
                    
                    this.currentData.attivita = this.currentData.attivita || [];
                    this.currentData.attivita.push(badgeActivity);
                    
                    // Save work data
                    await FirestoreService.saveOreLavorative(
                        this.currentUser.id,
                        this.currentDate,
                        this.currentData
                    );
                    
                    // Update UI to show the new activity
                    this.updateUI();
                }
                
                showToast(`Turno terminato alle ${sessionData.formattedEndTime}. Durata: ${minutesToHHMM(sessionData.sessionMinutes)}`, 'success');
                
            } catch (error) {
                console.error('Errore terminazione turno:', error);
                showToast('Errore durante la terminazione del turno', 'error');
            }
        } else {
            // Clock in
            try {
                const clockInData = await this.badgeService.clockIn();
                
                showToast(`Turno iniziato alle ${clockInData.formattedTime}`, 'success');
                
            } catch (error) {
                console.error('Errore inizio turno:', error);
                showToast('Errore durante l\'inizio del turno', 'error');
            }
        }
        
        this.updateBadgeUI();
        
        // Avvia timer per aggiornare l'orario corrente se il badge è attivo
        if (this.badgeService.isActive()) {
            this.startBadgeTimer();
        } else {
            this.stopBadgeTimer();
        }
    }

    startBadgeTimer() {
        // Ferma timer esistente se presente
        this.stopBadgeTimer();
        
        // Aggiorna ogni 30 secondi
        this.badgeTimer = setInterval(() => {
            this.updateBadgeUI();
        }, 30000);
    }

    stopBadgeTimer() {
        if (this.badgeTimer) {
            clearInterval(this.badgeTimer);
            this.badgeTimer = null;
        }
    }

    async saveData() {
        if (!this.currentData || !this.currentDate) return;

        try {
            // Mostra stato salvataggio
            document.getElementById('autoSaveStatus').innerHTML = 
                '<i class="bi bi-cloud-arrow-up me-1"></i>Salvataggio...';

            await FirestoreService.saveOreLavorative(
                this.currentUser.id,
                this.currentDate,
                this.currentData
            );

            // Aggiorna stato
            document.getElementById('autoSaveStatus').innerHTML = 
                '<i class="bi bi-cloud-check me-1"></i>Salvato automaticamente';
            document.getElementById('autoSaveStatus').className = 'text-success';
            
            this.updateLastSaved();

        } catch (error) {
            console.error('Errore salvataggio:', error);
            document.getElementById('autoSaveStatus').innerHTML = 
                '<i class="bi bi-cloud-slash me-1"></i>Errore salvataggio';
            document.getElementById('autoSaveStatus').className = 'text-danger';
            
            showToast('Errore durante il salvataggio', 'error');
        }
    }

    updateLastSaved() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('lastSaved').textContent = `Ultimo salvataggio: ${timeString}`;
    }

    updateBadgeInfo() {
        if (!this.employeeData) return;

        // Aggiorna nome completo
        const fullName = this.employeeData.name || 'DIPENDENTE';
        document.getElementById('employeeFullName').textContent = fullName.toUpperCase();
        
        // Aggiorna matricola
        document.getElementById('employeeId').textContent = this.employeeData.matricola || this.employeeData.id.toUpperCase();
        
        // Aggiorna codice fiscale
        document.getElementById('employeeCF').textContent = this.employeeData.codiceFiscale || 'N/A';
        
        // Aggiorna ruolo se presente
        const roleElement = document.getElementById('employeeRole');
        if (roleElement) {
            roleElement.textContent = (this.employeeData.ruolo || 'DIPENDENTE').toUpperCase();
        }
        
        // Aggiorna telefono se presente
        const phoneElement = document.getElementById('employeePhone');
        if (phoneElement) {
            phoneElement.textContent = this.employeeData.telefono || 'N/A';
        }
        
        // Aggiorna foto se disponibile
        const photoElement = document.getElementById('employeePhoto');
        if (this.employeeData.foto) {
            // Percorso corretto per la foto dalla cartella pages
            const photoUrl = `../uploads/employees/${this.employeeData.foto}`;
            photoElement.innerHTML = `<img src="${photoUrl}" alt="Foto dipendente" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            // Usa iniziali del nome come fallback
            const initials = this.getInitials(fullName);
            photoElement.innerHTML = `<div style="font-size: 24px; font-weight: bold; color: white;">${initials}</div>`;
        }
        
        // Aggiorna date
        const today = new Date();
        const issueDate = new Date(today.getFullYear(), 0, 1); // 1 gennaio dell'anno corrente
        const expiryDate = new Date(today.getFullYear(), 11, 31); // 31 dicembre dell'anno corrente
        
        document.getElementById('badgeIssueDate').textContent = issueDate.toLocaleDateString('it-IT');
        document.getElementById('badgeExpiry').textContent = expiryDate.toLocaleDateString('it-IT');
        
        // Aggiorna numero seriale badge
        const employeeIdForSerial = (this.employeeData.matricola || this.employeeData.id).replace(/[^0-9]/g, '').padStart(4, '0');
        const serial = `BD${today.getFullYear().toString().substr(2)}${employeeIdForSerial}`;
        document.getElementById('badgeSerial').textContent = `#${serial}`;
        
        // Aggiorna nome azienda
        const companyName = 'GESTIONE ORE & CANTIERI';
        document.getElementById('companyName').textContent = companyName;
        
        // Debug: log dei dati dipendente per verificare
        console.log('Employee data for badge:', this.employeeData);
        console.log('Photo URL:', this.employeeData.foto ? `../uploads/employees/${this.employeeData.foto}` : 'No photo');
    }

    getInitials(fullName) {
        if (!fullName) return 'ND';
        
        const names = fullName.trim().split(' ');
        if (names.length === 1) {
            return names[0].substring(0, 2).toUpperCase();
        }
        
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }

    // === UTILITY ===
    getTotals() {
        const activities = this.currentData?.attivita || [];
        let totalMinutes = 0;
        
        activities.forEach(activity => {
            totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
        });

        return {
            totalMinutes,
            totalHours: minutesToHHMM(totalMinutes),
            totalDecimal: minutesToDecimal(totalMinutes),
            activityCount: activities.length
        };
    }
}

// Inizializza il servizio dopo che il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all buttons
    document.querySelectorAll('button').forEach(btn => {
        if (window.ButtonUtils) {
            window.ButtonUtils.initButton(btn);
        }
    });
    
    const timeEntryService = new TimeEntryService();
    
    // Esponi globalmente per gli onclick
    window.timeEntryService = timeEntryService;
});