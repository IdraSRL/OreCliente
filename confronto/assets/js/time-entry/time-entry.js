import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    showToast, 
    showLoading, 
    hideLoading,
    minutesToHHMM, 
    minutesToDecimal,
    formatDate,
    getTodayString,
    getYesterdayString,
    isDateAllowed,
    generateId,
    sanitizeString,
    validateMinutes,
    validatePersone,
    debounce
} from '../utils/utils.js';

class TimeEntryService {
    constructor() {
        this.currentUser = null;
        this.currentDate = null;
        this.currentData = null;
        this.cantieri = [];
        this.employeeData = null;
        this.badgeState = {
            isActive: false,
            entryTime: null,
            exitTime: null,
            totalMinutes: 0
        };
        this.debouncedSave = debounce(() => this.saveData(), 1000);
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
        
        // Imposta data di default (oggi)
        this.setDefaultDate();
    }

    setupEventListeners() {
        // Logout
        AuthService.setupLogoutHandlers();

        // Cambio data
        document.getElementById('workDate').addEventListener('change', (e) => {
            this.changeDate(e.target.value);
        });

        // Carica giornata
        document.getElementById('loadDayBtn').addEventListener('click', () => {
            this.loadCurrentDay();
        });

        // Cambio stato
        document.getElementById('dayStatus').addEventListener('change', () => {
            this.updateStatus();
        });

        // Forms
        document.getElementById('cantiereForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCantiereActivity();
        });

        document.getElementById('pstForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPSTActivity();
        });

        // Badge button
        document.getElementById('badgeBtn').addEventListener('click', () => {
            this.toggleBadge();
        });

        // Modal events
        document.getElementById('cantiereModal').addEventListener('show.bs.modal', () => {
            this.loadCantieriSelect();
        });

        // Badge modal events
        document.getElementById('badgeModal').addEventListener('show.bs.modal', () => {
            this.updateBadgeInfo();
        });
    }

    async loadInitialData() {
        try {
            // Carica cantieri
            this.cantieri = await FirestoreService.getCantieri();
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
                    nome: this.currentUser.name.split(' ')[0] || '',
                    cognome: this.currentUser.name.split(' ').slice(1).join(' ') || '',
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
                name: this.currentUser.name,
                nome: this.currentUser.name.split(' ')[0] || '',
                cognome: this.currentUser.name.split(' ').slice(1).join(' ') || '',
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
    }

    async changeDate(newDate) {
        if (!newDate) return;

        // Verifica che la data sia consentita
        if (!isDateAllowed(newDate)) {
            showToast('Puoi inserire ore solo per oggi o ieri', 'warning');
            this.setDefaultDate();
            return;
        }

        this.currentDate = newDate;
        this.updateDateDisplay();
        await this.loadCurrentDay();
    }

    updateDateDisplay() {
        if (!this.currentDate) return;

        const formatted = formatDate(this.currentDate);
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
            showLoading(btn, 'Caricamento...');

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
            hideLoading(document.getElementById('loadDayBtn'), '<i class="bi bi-arrow-clockwise me-2"></i>Carica');
        }
    }

    updateStatus() {
        if (!this.currentData) return;
        
        this.currentData.stato = document.getElementById('dayStatus').value;
    }

    // === GESTIONE CANTIERI ===
    async loadCantieriSelect() {
        const select = document.getElementById('cantiereSelect');
        
        if (this.cantieri.length === 0) {
            select.innerHTML = '<option value="">Nessun cantiere configurato</option>';
            return;
        }

        select.innerHTML = '<option value="">Seleziona un cantiere</option>';
        
        this.cantieri.forEach(cantiere => {
            const option = document.createElement('option');
            option.value = cantiere.id;
            option.textContent = `${cantiere.name} (${minutesToHHMM(cantiere.minutes)})`;
            option.dataset.minutes = cantiere.minutes;
            option.dataset.name = cantiere.name;
            select.appendChild(option);
        });
    }

    async addCantiereActivity() {
        const cantiereId = document.getElementById('cantiereSelect').value;
        const persone = parseInt(document.getElementById('cantierePersone').value);

        if (!cantiereId) {
            showToast('Seleziona un cantiere', 'warning');
            return;
        }

        if (!validatePersone(persone)) {
            showToast('Numero persone non valido', 'warning');
            return;
        }

        if (!this.currentData) {
            showToast('Carica prima una giornata', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('addCantiereBtn');
            showLoading(btn, 'Aggiunta...');

            const cantiere = this.cantieri.find(c => c.id === cantiereId);
            if (!cantiere) {
                showToast('Cantiere non trovato', 'error');
                return;
            }

            const activity = {
                id: generateId('cantiere'),
                nome: cantiere.name,
                minuti: cantiere.minutes,
                persone: persone,
                minutiEffettivi: Math.round(cantiere.minutes / persone),
                tipo: 'cantiere'
            };

            this.currentData.attivita = this.currentData.attivita || [];
            this.currentData.attivita.push(activity);

            // Reset form e chiudi modal
            document.getElementById('cantiereForm').reset();
            document.getElementById('cantierePersone').value = '1';
            bootstrap.Modal.getInstance(document.getElementById('cantiereModal')).hide();

            this.updateUI();
            this.debouncedSave();

            showToast('Cantiere aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore aggiunta cantiere:', error);
            showToast('Errore aggiunta cantiere', 'error');
        } finally {
            hideLoading(document.getElementById('addCantiereBtn'), '<i class="bi bi-plus me-2"></i>Aggiungi Cantiere');
        }
    }

    // === GESTIONE PST ===
    async addPSTActivity() {
        const nome = sanitizeString(document.getElementById('pstName').value);
        const minuti = parseInt(document.getElementById('pstMinutes').value);
        const persone = parseInt(document.getElementById('pstPersone').value);

        if (!nome) {
            showToast('Inserisci il nome dell\'attività', 'warning');
            return;
        }

        if (!validateMinutes(minuti)) {
            showToast('Minuti non validi', 'warning');
            return;
        }

        if (!validatePersone(persone)) {
            showToast('Numero persone non valido', 'warning');
            return;
        }

        if (!this.currentData) {
            showToast('Carica prima una giornata', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('addPSTBtn');
            showLoading(btn, 'Aggiunta...');

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
            hideLoading(document.getElementById('addPSTBtn'), '<i class="bi bi-plus me-2"></i>Aggiungi PST');
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

    removeActivity(activityId) {
        if (!this.currentData || !this.currentData.attivita) return;

        if (confirm('Rimuovere questa attività?')) {
            this.currentData.attivita = this.currentData.attivita.filter(a => a.id !== activityId);
            this.updateUI();
            this.debouncedSave();
            showToast('Attività rimossa', 'info');
        }
    }

    // === UI UPDATES ===
    updateUI() {
        this.updateActivitiesTable();
        this.updateStats();
        this.updateBadgeUI();
    }

    updateActivitiesTable() {
        const tbody = document.querySelector('#activitiesTable tbody');
        const activities = this.currentData?.attivita || [];

        tbody.innerHTML = '';

        if (activities.length === 0) {
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
                    <span class="badge bg-${activity.tipo === 'cantiere' ? 'success' : 'info'}">${activity.tipo}</span>
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
    }

    updateBadgeUI() {
        const badgeBtn = document.getElementById('badgeBtn');
        const badgeHours = document.getElementById('badgeHours');
        const badgeStatus = document.getElementById('badgeStatus');
        const badgeText = document.getElementById('badgeText');

        if (!badgeBtn) return; // Exit if badge elements don't exist

        if (this.badgeState.isActive) {
            // Badge is active (clocked in)
            badgeBtn.className = 'btn btn-danger btn-lg';
            badgeBtn.innerHTML = '<i class="bi bi-stop-circle me-2"></i>Termina Turno';
            
            if (badgeStatus) {
                badgeStatus.textContent = 'IN SERVIZIO';
                badgeStatus.className = 'badge bg-success';
            }
            
            if (badgeText) {
                const entryTime = this.badgeState.entryTime ? 
                    new Date(this.badgeState.entryTime).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '--:--';
                badgeText.textContent = `Entrata: ${entryTime}`;
            }
            
            if (badgeHours) {
                badgeHours.textContent = minutesToHHMM(this.badgeState.totalMinutes);
            }
        } else {
            // Badge is inactive (clocked out)
            badgeBtn.className = 'btn btn-success btn-lg';
            badgeBtn.innerHTML = '<i class="bi bi-play-circle me-2"></i>Inizia Turno';
            
            if (badgeStatus) {
                badgeStatus.textContent = 'FUORI SERVIZIO';
                badgeStatus.className = 'badge bg-secondary';
            }
            
            if (badgeText) {
                if (this.badgeState.exitTime) {
                    const exitTime = new Date(this.badgeState.exitTime).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    badgeText.textContent = `Ultima uscita: ${exitTime}`;
                } else {
                    badgeText.textContent = 'Pronto per iniziare';
                }
            }
            
            if (badgeHours) {
                badgeHours.textContent = minutesToHHMM(this.badgeState.totalMinutes);
            }
        }
    }

    async toggleBadge() {
        const now = new Date();
        
        if (this.badgeState.isActive) {
            // Clock out
            this.badgeState.isActive = false;
            this.badgeState.exitTime = now.toISOString();
            
            // Calculate total minutes worked
            if (this.badgeState.entryTime) {
                const entryTime = new Date(this.badgeState.entryTime);
                const diffMs = now - entryTime;
                const diffMinutes = Math.round(diffMs / (1000 * 60));
                this.badgeState.totalMinutes += diffMinutes;
                
                // Create badge activity only if we have current data loaded
                if (this.currentData) {
                    const startTime = entryTime.toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    const endTime = now.toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const badgeActivity = {
                        id: generateId('badge'),
                        nome: `Badge (${startTime} - ${endTime})`,
                        minuti: diffMinutes,
                        persone: 1,
                        minutiEffettivi: diffMinutes,
                        tipo: 'badge'
                    };
                    
                    this.currentData.attivita = this.currentData.attivita || [];
                    this.currentData.attivita.push(badgeActivity);
                    
                    // Update UI to show the new activity
                    this.updateUI();
                    this.debouncedSave();
                } else {
                    showToast('Carica prima una giornata per salvare l\'attività badge', 'warning');
                }
            }
            
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
                this.badgeState.totalMinutes = 0;
                
                showToast('Errore durante il salvataggio', 'error');
            }
        } else {
            // Clock in
            this.badgeState.isActive = true;
            this.badgeState.entryTime = now.toISOString();
            showToast('Turno iniziato', 'success');
        }
        
        this.updateBadgeUI();
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

// Inizializza il servizio
const timeEntryService = new TimeEntryService();

// Esponi globalmente per gli onclick
window.timeEntryService = timeEntryService;