import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../services/firestore-service.js';
import { VERSION } from '../config/version.js';
import { EmployeeService } from '../services/employee-service.js';
import { CantiereService } from '../services/cantiere-service.js';
import { PhotoService } from '../services/photo-service.js';
import { ReportService } from '../services/report-service.js';
import { TableRenderer } from '../ui/table-renderer.js';
import { GridRenderer } from '../ui/grid-renderer.js';
import { FormHandlers } from '../ui/form-handlers.js';
import { ButtonUtils } from '../ui/button-utils.js';
import { 
    debounce,
    generateId
} from '../utils/utils.js';
import { showToast, showConfirm, showGlobalLoading } from '../utils/ui-utils.js';
import { getMonthRange, isDateAllowedForAdmin, getTodayString, formatDate } from '../utils/date-utils.js';
import { minutesToDecimal, minutesToHHMM } from '../utils/time-utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { MemoryManager } from '../utils/memory-manager.js';

class AdminService {
    constructor() {
        this.currentUser = null;
        this.employeeService = new EmployeeService();
        this.cantiereService = new CantiereService();
        this.cleanup = this.cleanup.bind(this); // Bind cleanup method
        this.currentFilter = {
            employee: '',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        };
        this.viewMode = 'hierarchical'; // 'hierarchical' or 'flat'
        this.init();
    }

    async init() {
        // Verifica autenticazione admin
        if (!AuthService.initPageProtection('admin')) {
            return;
        }

        this.currentUser = AuthService.getCurrentUser();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Carica dati iniziali
        await this.loadInitialData();
        
        // Popola filtri
        this.populateFilters();
        
        // Aggiorna data/ora corrente
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 60000); // Aggiorna ogni minuto
    }

    setupEventListeners() {
        // Logout
        AuthService.setupLogoutHandlers();

        // Tab changes
        document.querySelectorAll('#adminTabs button[data-bs-toggle="pill"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                if (target === '#dipendenti') {
                    this.loadEmployeesGrid();
                } else if (target === '#cantieri') {
                    this.loadCantieriGrid();
                } else if (target === '#categorie') {
                    this.loadCategorieGrid();
                }
            });
        });

        // Filtri riepilogo
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Auto-apply filters on change
        this.setupAutoFilters();

        // Toggle vista
        document.getElementById('viewToggle').addEventListener('change', (e) => {
            this.viewMode = e.target.checked ? 'hierarchical' : 'flat';
            this.applyFilters();
        });

        // Export Excel
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Setup forms
        FormHandlers.setupEmployeeForm((data) => this.saveEmployee(data));
        FormHandlers.setupCantiereForm((data) => this.saveCantiere(data));
        FormHandlers.setupCategoriaForm((data) => this.saveCategoria(data));

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Photo upload events
        document.getElementById('employeePhoto').addEventListener('change', (e) => {
            this.handlePhotoPreview(e.target.files[0]);
        });

        document.getElementById('removePhotoBtn').addEventListener('click', () => {
            this.removePhoto();
        });

        // Codice fiscale auto-uppercase
        document.getElementById('employeeCodiceFiscale').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    setupAutoFilters() {
        // Auto-apply filters when selection changes
        const filterEmployee = document.getElementById('filterEmployee');
        const filterMonth = document.getElementById('filterMonth');
        const filterYear = document.getElementById('filterYear');
        
        if (filterEmployee) {
            filterEmployee.addEventListener('change', () => this.applyFilters());
        }
        
        if (filterMonth) {
            filterMonth.addEventListener('change', () => this.applyFilters());
        }
        
        if (filterYear) {
            filterYear.addEventListener('change', () => this.applyFilters());
        }
    }

    async loadInitialData() {
        try {
            showGlobalLoading(true);
            
            // Verifica connessione prima di caricare
            await FirestoreService.testConnection();
            
            // Carica dipendenti e cantieri
            await Promise.all([
                this.employeeService.loadEmployees(),
                this.cantiereService.loadCantieri(),
                this.cantiereService.loadCategorie()
            ]);

        } catch (error) {
            console.error('Errore caricamento dati iniziali:', error);
            const userMessage = ErrorHandler.handleFirebaseError(error, 'caricamento dati iniziali');
            showToast(userMessage, 'error');
            
            // In caso di errore, inizializza con dati vuoti per evitare crash
            this.employeeService.employees = [];
            this.cantiereService.cantieri = [];
            this.cantiereService.categorie = [];
        } finally {
            showGlobalLoading(false);
        }
    }
    
    // Cleanup method
    cleanup() {
        // Clear any active timers
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        // Clean up services
        this.employeeService = null;
        this.cantiereService = null;
        this.currentUser = null;
        
        // Clean up memory
        MemoryManager.cleanup();
    }

    populateFilters() {
        // Popola select dipendenti
        const employeeSelect = document.getElementById('filterEmployee');
        const employees = this.employeeService.getAllEmployees();
        GridRenderer.populateSelect(employeeSelect, employees, 'id', 'name', 'Tutti i dipendenti');

        // Popola anni (ultimi 3 anni + prossimi 2)
        const yearSelect = document.getElementById('filterYear');
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        
        for (let year = currentYear - 3; year <= currentYear + 2; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }

        // Imposta mese corrente
        document.getElementById('filterMonth').value = this.currentFilter.month;
        
        // Auto-load data with current filters
        setTimeout(() => this.applyFilters(), 500);
    }

    updateDateTime() {
        const now = new Date();
        const formatted = now.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('currentDateTime').textContent = formatted;
    }

    // === GESTIONE RIEPILOGO ===
    async applyFilters() {
        this.currentFilter = {
            employee: document.getElementById('filterEmployee').value,
            month: parseInt(document.getElementById('filterMonth').value),
            year: parseInt(document.getElementById('filterYear').value)
        };

        try {
            showGlobalLoading(true);
            
            const { start, end } = getMonthRange(this.currentFilter.year, this.currentFilter.month);
            let riepilogoData;

            if (this.currentFilter.employee) {
                // Carica dati per singolo dipendente
                const employee = this.employeeService.getEmployeeById(this.currentFilter.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    riepilogoData = [{ dipendente: employee, ore: ore }];
                } else {
                    riepilogoData = [];
                }
            } else {
                // Carica dati per tutti i dipendenti
                riepilogoData = await FirestoreService.getRiepilogoCompleto(start, end);
            }

            if (!riepilogoData) {
                riepilogoData = [];
            }

            const processedData = ReportService.processReportData(riepilogoData);
            this.updateRiepilogoTable(processedData.data);
            this.updateStats(processedData.totalStats);

        } catch (error) {
            console.error('Errore caricamento riepilogo:', error);
            showToast('Errore caricamento dati', 'error');
            
            // Aggiorna UI con dati vuoti in caso di errore
            const emptyData = ReportService.processReportData([]);
            this.updateRiepilogoTable(emptyData.data);
            this.updateStats(emptyData.totalStats);
        } finally {
            showGlobalLoading(false);
        }
    }

    updateRiepilogoTable(data) {
        const tbody = document.querySelector('#riepilogoTable tbody');

        if (this.viewMode === 'hierarchical') {
            TableRenderer.renderHierarchicalView(tbody, data);
            TableRenderer.setupEmployeeToggle();
        } else {
            TableRenderer.renderFlatView(tbody, data);
        }
    }

    updateStats(stats) {
        document.getElementById('totalHours').textContent = stats.totalHours;
        document.getElementById('totalDecimal').textContent = stats.totalDecimal;
        document.getElementById('workingDays').textContent = stats.totalDays;
        document.getElementById('totalActivities').textContent = stats.totalActivities;
    }

    // === GESTIONE DIPENDENTI ===
    async loadEmployeesGrid() {
        const grid = document.getElementById('employeesGrid');
        const employees = this.employeeService.getAllEmployees();
        GridRenderer.renderEmployeesGrid(grid, employees);
    }

    resetEmployeeForm() {
        FormHandlers.resetEmployeeForm();
    }

    editEmployee(employeeId) {
        const employee = this.employeeService.getEmployeeById(employeeId);
        if (!employee) return;

        FormHandlers.populateEmployeeForm(employee);
        // Mostra modal
        new bootstrap.Modal(document.getElementById('employeeModal')).show();
    }

    async saveEmployee(employeeData) {

        try {
            const btn = document.getElementById('saveEmployeeBtn');
            ButtonUtils.showLoading(btn, 'Salvataggio...');

            // Upload foto se presente
            let fotoFileName = null;
            const photoFile = document.getElementById('employeePhoto').files[0];
            if (photoFile) {
                fotoFileName = await PhotoService.uploadPhoto(employeeData.id || 'temp', photoFile);
            } else if (employeeData.id) {
                // Mantieni foto esistente
                const existingEmployee = this.employeeService.getEmployeeById(employeeData.id);
                fotoFileName = existingEmployee?.foto || null;
            }

            const finalEmployeeData = {
                ...employeeData,
                foto: fotoFileName
            };

            await this.employeeService.saveEmployee(finalEmployeeData);

            bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
            this.loadEmployeesGrid();
            this.populateFilters(); // Aggiorna filtri

            showToast(employeeData.id ? 'Dipendente aggiornato con successo' : 'Dipendente aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore salvataggio dipendente:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            const btn = document.getElementById('saveEmployeeBtn');
            const text = (employeeData && employeeData.id) ? '<i class="bi bi-pencil me-2"></i>Aggiorna' : '<i class="bi bi-save me-2"></i>Salva';
            ButtonUtils.hideLoading(btn, text);
        }
    }

    async deleteEmployee(employeeId) {
        const employee = this.employeeService.getEmployeeById(employeeId);
        if (!employee) return;

        const confirmed = await showConfirm(
            'Elimina Dipendente',
            `Eliminare il dipendente "${employee.name}"?\n\nATTENZIONE: Tutti i dati delle ore lavorative verranno persi!`,
            'Elimina',
            'Annulla',
            'danger'
        );
        
        if (!confirmed) return;

        try {
            showGlobalLoading(true);

            // Rimuovi foto se presente
            if (employee.foto) {
                await PhotoService.deletePhoto(employeeId);
            }

            await this.employeeService.deleteEmployee(employeeId);

            this.loadEmployeesGrid();
            this.populateFilters();

            showToast('Dipendente eliminato con successo', 'success');

        } catch (error) {
            console.error('Errore eliminazione dipendente:', error);
            showToast('Errore durante l\'eliminazione', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    // === GESTIONE FOTO ===
    handlePhotoPreview(file) {
        if (!file) return;

        const errors = PhotoService.validatePhotoFile(file);
        if (errors.length > 0) {
            showToast(errors.join(', '), 'warning');
            return;
        }

        const preview = document.getElementById('photoPreview');
        PhotoService.previewPhoto(file, preview).then(() => {
            document.getElementById('removePhotoBtn').style.display = 'inline-block';
        }).catch(error => {
            console.error('Errore anteprima foto:', error);
            showToast('Errore visualizzazione anteprima', 'error');
        });
    }

    async removePhoto() {
        const employeeId = document.getElementById('employeeId').value;
        
        if (employeeId) {
            try {
                await PhotoService.deletePhoto(employeeId);
            } catch (error) {
                console.error('Errore rimozione foto:', error);
            }
        }

        // Reset preview
        document.getElementById('photoPreview').innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
        document.getElementById('employeePhoto').value = '';
        document.getElementById('removePhotoBtn').style.display = 'none';
    }

    // === GESTIONE CANTIERI ===
    async loadCantieriGrid() {
        const grid = document.getElementById('cantieriGrid');
        const cantieri = this.cantiereService.getAllCantieri();
        const categorie = this.cantiereService.getAllCategorie();
        GridRenderer.renderCantieriGrid(grid, cantieri, categorie);
    }

    async loadCategorieGrid() {
        const grid = document.getElementById('categorieGrid');
        const categorie = this.cantiereService.getAllCategorie();
        GridRenderer.renderCategorieGrid(grid, categorie);
    }

    resetCantiereForm() {
        FormHandlers.resetCantiereForm();
        // Popola select categorie
        const categorieSelect = document.getElementById('cantiereCategoria');
        if (categorieSelect) {
            GridRenderer.populateSelect(categorieSelect, this.cantiereService.getAllCategorie(), 'id', 'name', 'Seleziona categoria');
        }
    }

    resetCategoriaForm() {
        FormHandlers.resetCategoriaForm();
    }

    editCantiere(cantiereId) {
        const cantiere = this.cantiereService.getCantiereById(cantiereId);
        if (!cantiere) return;

        FormHandlers.populateCantiereForm(cantiere);
        // Popola select categorie
        const categorieSelect = document.getElementById('cantiereCategoria');
        if (categorieSelect) {
            GridRenderer.populateSelect(categorieSelect, this.cantiereService.getAllCategorie(), 'id', 'name', 'Seleziona categoria');
        }
        new bootstrap.Modal(document.getElementById('cantiereModal')).show();
    }

    editCategoria(categoriaId) {
        const categoria = this.cantiereService.getCategoriaById(categoriaId);
        if (!categoria) return;

        FormHandlers.populateCategoriaForm(categoria);
        new bootstrap.Modal(document.getElementById('categoriaModal')).show();
    }

    async saveCantiere(cantiereData) {
        try {
            const btn = document.getElementById('saveCantiereBtn');
            ButtonUtils.showLoading(btn, 'Salvataggio...');

            await this.cantiereService.saveCantiere(cantiereData);

            bootstrap.Modal.getInstance(document.getElementById('cantiereModal')).hide();
            this.loadCantieriGrid();

            showToast(cantiereData.id ? 'Cantiere aggiornato con successo' : 'Cantiere aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore salvataggio cantiere:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            const btn = document.getElementById('saveCantiereBtn');
            const text = cantiereData.id ? '<i class="bi bi-pencil me-2"></i>Aggiorna' : '<i class="bi bi-save me-2"></i>Salva';
            ButtonUtils.hideLoading(btn, text);
        }
    }

    async saveCategoria(categoriaData) {
        try {
            const btn = document.getElementById('saveCategoriaBtn');
            ButtonUtils.showLoading(btn, 'Salvataggio...');

            await this.cantiereService.saveCategoria(categoriaData);

            bootstrap.Modal.getInstance(document.getElementById('categoriaModal')).hide();
            this.loadCategorieGrid();
            this.loadCantieriGrid(); // Ricarica anche cantieri per aggiornare le categorie

            showToast(categoriaData.id ? 'Categoria aggiornata con successo' : 'Categoria aggiunta con successo', 'success');

        } catch (error) {
            console.error('Errore salvataggio categoria:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            const btn = document.getElementById('saveCategoriaBtn');
            const text = categoriaData.id ? '<i class="bi bi-pencil me-2"></i>Aggiorna' : '<i class="bi bi-save me-2"></i>Salva';
            ButtonUtils.hideLoading(btn, text);
        }
    }

    async deleteCantiere(cantiereId) {
        const cantiere = this.cantiereService.getCantiereById(cantiereId);
        if (!cantiere) return;

        const confirmed = await showConfirm(
            'Elimina Cantiere',
            `Eliminare il cantiere "${cantiere.name}"?`,
            'Elimina',
            'Annulla',
            'danger'
        );
        
        if (!confirmed) return;

        try {
            await this.cantiereService.deleteCantiere(cantiereId);
            
            this.loadCantieriGrid();
            showToast('Cantiere eliminato con successo', 'success');

        } catch (error) {
            console.error('Errore eliminazione cantiere:', error);
            showToast('Errore durante l\'eliminazione', 'error');
        }
    }

    async deleteCategoria(categoriaId) {
        const categoria = this.cantiereService.getCategoriaById(categoriaId);
        if (!categoria) return;

        const confirmed = await showConfirm(
            'Elimina Categoria',
            `Eliminare la categoria "${categoria.name}"?\n\nI cantieri associati verranno spostati nella categoria "Generale".`,
            'Elimina',
            'Annulla',
            'danger'
        );
        
        if (!confirmed) return;

        try {
            await this.cantiereService.deleteCategoria(categoriaId);
            
            this.loadCategorieGrid();
            this.loadCantieriGrid();
            showToast('Categoria eliminata con successo', 'success');

        } catch (error) {
            console.error('Errore eliminazione categoria:', error);
            showToast('Errore durante l\'eliminazione', 'error');
        }
    }

    // === ALTRE FUNZIONI ===
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Compila tutti i campi', 'warning');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Le password non coincidono', 'warning');
            return;
        }

        if (newPassword.length < 3) {
            showToast('La password deve essere di almeno 3 caratteri', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('changePasswordBtn');
            ButtonUtils.showLoading(btn, 'Aggiornamento...');

            // Verifica password attuale
            const masterPassword = await FirestoreService.getMasterPassword();
            if (currentPassword !== masterPassword) {
                showToast('Password attuale non corretta', 'error');
                return;
            }

            // Aggiorna password
            await FirestoreService.updateMasterPassword(newPassword);

            // Reset form e chiudi offcanvas
            document.getElementById('passwordForm').reset();
            bootstrap.Offcanvas.getInstance(document.getElementById('passwordOffcanvas')).hide();

            showToast('Password aggiornata con successo', 'success');

        } catch (error) {
            console.error('Errore cambio password:', error);
            showToast('Errore durante l\'aggiornamento', 'error');
        } finally {
            const btn = document.getElementById('changePasswordBtn');
            ButtonUtils.hideLoading(btn, '<i class="bi bi-key me-2"></i>Cambia Password');
        }
    }

async exportToExcel() {
    try {
        showToast('Preparazione export in corso...', 'info');

        // Genera i dati con lo stesso filtro attivo nell'interfaccia
        const reportData = ReportService && ReportService.generateReport
            ? await ReportService.generateReport(this.currentFilter)
            : (this.generateReport ? await this.generateReport(this.currentFilter) : null);

        // Usa l'export che carica il template Excel
        if (ReportService && ReportService.exportToExcel) {
            await ReportService.exportToExcel(reportData, this.currentFilter);
        } else {
            // Fallback per non rompere il flusso se ReportService non è disponibile
            console.warn('ReportService non disponibile, export fallback non template.');
            return this._exportToExcelFallback && this._exportToExcelFallback(reportData);
        }

        showToast('Export completato!', 'success');
    } catch (error) {
        console.error('Errore export Excel:', error);
        showToast('Errore durante l\'export', 'error');
    }
}

    // Funzioni per modifica attività (placeholder)
    editEmployeeActivities(employeeId) {
        this.openEmployeeActivityEditor(employeeId);
    }

    viewDayDetails(employeeId, date) {
        this.openDayDetailsEditor(employeeId, date);
    }

    async openEmployeeActivityEditor(employeeId) {
        const employee = this.employeeService.getEmployeeById(employeeId);
        if (!employee) {
            showToast('Dipendente non trovato', 'error');
            return;
        }

        // Crea modal per selezione data
        const modalHtml = `
            <div class="modal fade" id="selectDateModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-calendar-event me-2"></i>
                                Modifica Attività - ${employee.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="adminWorkDate" class="form-label">Seleziona Data</label>
                                <input type="date" class="form-control" id="adminWorkDate" value="${getTodayString()}">
                                <div class="form-text">Come amministratore puoi modificare qualsiasi data</div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="adminService.loadEmployeeDay('${employeeId}')">
                                <i class="bi bi-pencil me-2"></i>Modifica Giornata
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Rimuovi modal esistente se presente
        const existingModal = document.getElementById('selectDateModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('selectDateModal'));
        modal.show();

        // Cleanup quando il modal viene nascosto
        document.getElementById('selectDateModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('selectDateModal').remove();
        });
    }

    async loadEmployeeDay(employeeId) {
        const selectedDate = document.getElementById('adminWorkDate').value;
        
        if (!selectedDate) {
            showToast('Seleziona una data', 'warning');
            return;
        }

        if (!isDateAllowedForAdmin(selectedDate)) {
            showToast('Data non valida', 'warning');
            return;
        }

        // Chiudi modal selezione data
        bootstrap.Modal.getInstance(document.getElementById('selectDateModal')).hide();

        try {
            showGlobalLoading(true);
            
            const employee = this.employeeService.getEmployeeById(employeeId);
            const dayData = await FirestoreService.getOreLavorative(employeeId, selectedDate);
            
            this.openDayEditor(employee, selectedDate, dayData);
            
        } catch (error) {
            console.error('Errore caricamento giornata:', error);
            showToast('Errore caricamento dati', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    openDayEditor(employee, date, dayData) {
        const activities = dayData.attivita || [];
        
        const modalHtml = `
            <div class="modal fade" id="dayEditorModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-pencil-square me-2"></i>
                                Modifica Attività - ${employee.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <strong>Dipendente:</strong> ${employee.name}
                                </div>
                                <div class="col-md-6">
                                    <strong>Data:</strong> ${formatDate(date)}
                                </div>
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-md-4">
                                    <label for="adminDayStatus" class="form-label">Stato Giornata</label>
                                    <select class="form-select" id="adminDayStatus">
                                        <option value="Normale" ${dayData.stato === 'Normale' ? 'selected' : ''}>Normale</option>
                                        <option value="Riposo" ${dayData.stato === 'Riposo' ? 'selected' : ''}>Riposo</option>
                                        <option value="Ferie" ${dayData.stato === 'Ferie' ? 'selected' : ''}>Ferie</option>
                                        <option value="Malattia" ${dayData.stato === 'Malattia' ? 'selected' : ''}>Malattia</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <button type="button" class="btn btn-success mt-4" onclick="adminService.addActivityToDay()">
                                        <i class="bi bi-plus me-2"></i>Aggiungi Attività
                                    </button>
                                    <button type="button" class="btn btn-info mt-2" onclick="adminService.addPSTToDay()">
                                        <i class="bi bi-plus-circle me-2"></i>Aggiungi PST
                                    </button>
                                </div>
                            </div>
                            
                            <div class="table-responsive">
                                <table class="table table-dark table-striped" id="adminActivitiesTable">
                                    <thead>
                                        <tr>
                                            <th>Tipo</th>
                                            <th>Nome</th>
                                            <th>Minuti</th>
                                            <th>Persone</th>
                                            <th>Min. Effettivi</th>
                                            <th>Ore</th>
                                            <th>Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminActivitiesTableBody">
                                        ${this.renderAdminActivitiesTable(activities)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="adminService.saveEmployeeDay('${employee.id}', '${date}')">
                                <i class="bi bi-save me-2"></i>Salva Modifiche
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Rimuovi modal esistente se presente
        const existingModal = document.getElementById('dayEditorModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('dayEditorModal'));
        modal.show();

        // Salva dati correnti per le modifiche
        this.currentEditingData = {
            employeeId: employee.id,
            date: date,
            data: dayData
        };

        // Cleanup quando il modal viene nascosto
        document.getElementById('dayEditorModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('dayEditorModal').remove();
            this.currentEditingData = null;
        });
    }

    renderAdminActivitiesTable(activities) {
        if (!activities || activities.length === 0) {
            return `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="bi bi-plus-circle me-2"></i>
                        Nessuna attività. Clicca "Aggiungi Attività" per iniziare.
                    </td>
                </tr>
            `;
        }

        return activities.map(activity => `
            <tr data-activity-id="${activity.id}">
                <td>
                    <span class="badge bg-${this.getActivityBadgeColor(activity.tipo)}">${activity.tipo}</span>
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm" 
                           value="${activity.nome}" 
                           onchange="adminService.updateActivityField('${activity.id}', 'nome', this.value)">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.minuti}" min="0" max="1440"
                           onchange="adminService.updateActivityField('${activity.id}', 'minuti', this.value)">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${activity.persone}" min="1" max="50"
                           onchange="adminService.updateActivityField('${activity.id}', 'persone', this.value)">
                </td>
                <td>
                    <strong class="text-primary">${activity.minutiEffettivi || activity.minuti}</strong>
                </td>
                <td>
                    <strong class="text-success">${this.minutesToHHMM(activity.minutiEffettivi || activity.minuti)}</strong>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" >
                        <i class="bi bi-trash" onclick="adminService.removeActivityFromDay('${activity.id}')"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getActivityBadgeColor(tipo) {
        const colorMap = {
            'cantiere': 'success',
            'pst': 'info',
            'badge': 'warning'
        };
        return colorMap[tipo] || 'secondary';
    }

    minutesToHHMM(minutes) {
        if (!minutes || minutes < 0) return "00:00";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    addActivityToDay() {
        if (!this.currentEditingData) return;

        // Mostra modal per selezione cantiere
        this.showCantiereSelectionModal();
    }
    
    addPSTToDay() {
        if (!this.currentEditingData) return;
        
        // Mostra modal per inserimento PST
        this.showPSTInputModal();
    }
    
    showCantiereSelectionModal() {
        const modalHtml = `
            <div class="modal fade" id="adminCantiereModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-building me-2"></i>Aggiungi Cantiere
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="adminCantiereSelect" class="form-label">Seleziona Cantiere</label>
                                <select class="form-select" id="adminCantiereSelect" required>
                                    <option value="">Seleziona un cantiere</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="adminCantierePersone" class="form-label">Numero Persone</label>
                                <input type="number" class="form-control" id="adminCantierePersone" 
                                       min="1" max="50" value="1" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-success" onclick="adminService.confirmAddCantiere()">
                                <i class="bi bi-plus me-2"></i>Aggiungi Cantiere
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente se presente
        const existingModal = document.getElementById('adminCantiereModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Popola select cantieri
        const select = document.getElementById('adminCantiereSelect');
        const cantieri = this.cantiereService.getAllCantieri();
        cantieri.forEach(cantiere => {
            if (cantiere.attivo !== false) {
                const option = document.createElement('option');
                option.value = cantiere.id;
                option.textContent = `${cantiere.name} (${minutesToHHMM(cantiere.minutes)})`;
                option.dataset.minutes = cantiere.minutes;
                option.dataset.name = cantiere.name;
                select.appendChild(option);
            }
        });
        
        const modal = new bootstrap.Modal(document.getElementById('adminCantiereModal'));
        modal.show();
        
        // Cleanup quando il modal viene nascosto
        document.getElementById('adminCantiereModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('adminCantiereModal').remove();
        });
    }
    
    showPSTInputModal() {
        const modalHtml = `
            <div class="modal fade" id="adminPSTModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-plus-circle me-2"></i>Aggiungi Attività PST
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="adminPSTName" class="form-label">Nome Attività</label>
                                <input type="text" class="form-control" id="adminPSTName" 
                                       placeholder="Es: Formazione, Riunione, Manutenzione..." required>
                            </div>
                            <div class="mb-3">
                                <label for="adminPSTMinutes" class="form-label">Minuti</label>
                                <input type="number" class="form-control" id="adminPSTMinutes" 
                                       min="0" max="1440" value="480" required>
                            </div>
                            <div class="mb-3">
                                <label for="adminPSTPersone" class="form-label">Numero Persone</label>
                                <input type="number" class="form-control" id="adminPSTPersone" 
                                       min="1" max="50" value="1" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-info" onclick="adminService.confirmAddPST()">
                                <i class="bi bi-plus me-2"></i>Aggiungi PST
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Rimuovi modal esistente se presente
        const existingModal = document.getElementById('adminPSTModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('adminPSTModal'));
        modal.show();
        
        // Cleanup quando il modal viene nascosto
        document.getElementById('adminPSTModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('adminPSTModal').remove();
        });
    }
    
    confirmAddCantiere() {
        const select = document.getElementById('adminCantiereSelect');
        const personeInput = document.getElementById('adminCantierePersone');
        
        if (!select.value) {
            showToast('Seleziona un cantiere', 'warning');
            return;
        }
        
        const selectedOption = select.options[select.selectedIndex];
        const cantiere = {
            id: select.value,
            name: selectedOption.dataset.name,
            minutes: parseInt(selectedOption.dataset.minutes)
        };
        
        const persone = parseInt(personeInput.value) || 1;
        
        const newActivity = {
            id: `admin-cantiere-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            nome: cantiere.name,
            minuti: cantiere.minutes,
            persone: persone,
            minutiEffettivi: Math.round(cantiere.minutes / persone),
            tipo: 'cantiere'
        };

        this.currentEditingData.data.attivita = this.currentEditingData.data.attivita || [];
        this.currentEditingData.data.attivita.push(newActivity);

        // Aggiorna tabella
        this.refreshAdminActivitiesTable();
        
        // Chiudi modal
        bootstrap.Modal.getInstance(document.getElementById('adminCantiereModal')).hide();
        
        showToast('Cantiere aggiunto con successo', 'success');
    }
    
    confirmAddPST() {
        const nameInput = document.getElementById('adminPSTName');
        const minutesInput = document.getElementById('adminPSTMinutes');
        const personeInput = document.getElementById('adminPSTPersone');
        
        const nome = nameInput.value.trim();
        const minuti = parseInt(minutesInput.value) || 480;
        const persone = parseInt(personeInput.value) || 1;
        
        if (!nome) {
            showToast('Inserisci il nome dell\'attività', 'warning');
            return;
        }
        
        const newActivity = {
            id: `admin-pst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            nome: nome,
            minuti: minuti,
            persone: persone,
            minutiEffettivi: Math.round(minuti / persone),
            tipo: 'pst'
        };
        
        this.currentEditingData.data.attivita = this.currentEditingData.data.attivita || [];
        this.currentEditingData.data.attivita.push(newActivity);
        
        // Aggiorna tabella
        this.refreshAdminActivitiesTable();
        
        // Chiudi modal
        bootstrap.Modal.getInstance(document.getElementById('adminPSTModal')).hide();
        
        showToast('Attività PST aggiunta con successo', 'success');
    }

    updateActivityField(activityId, field, value) {
        if (!this.currentEditingData || !this.currentEditingData.data.attivita) return;

        const activity = this.currentEditingData.data.attivita.find(a => a.id === activityId);
        if (!activity) return;

        if (field === 'nome') {
            activity.nome = value.trim();
        } else if (field === 'minuti') {
            const minuti = parseInt(value);
            if (!isNaN(minuti) && minuti >= 0 && minuti <= 1440) {
                activity.minuti = minuti;
                activity.minutiEffettivi = Math.round(minuti / activity.persone);
                this.refreshAdminActivitiesTable();
            }
        } else if (field === 'persone') {
            const persone = parseInt(value);
            if (!isNaN(persone) && persone >= 1 && persone <= 50) {
                activity.persone = persone;
                activity.minutiEffettivi = Math.round(activity.minuti / persone);
                this.refreshAdminActivitiesTable();
            }
        }
    }

    async removeActivityFromDay(activityId) {
        if (!this.currentEditingData || !this.currentEditingData.data.attivita) return;

        const confirmed = await showConfirm(
            'Rimuovi Attività',
            'Sei sicuro di voler rimuovere questa attività?',
            'Rimuovi',
            'Annulla',
            'danger'
        );
        
        if (confirmed) {
            this.currentEditingData.data.attivita = this.currentEditingData.data.attivita.filter(a => a.id !== activityId);
            this.refreshAdminActivitiesTable();
        }
    }

    refreshAdminActivitiesTable() {
        const tbody = document.getElementById('adminActivitiesTableBody');
        if (tbody && this.currentEditingData) {
            tbody.innerHTML = this.renderAdminActivitiesTable(this.currentEditingData.data.attivita);
        }
    }

    async saveEmployeeDay(employeeId, date) {
        if (!this.currentEditingData) return;

        try {
            showGlobalLoading(true);

            // Aggiorna stato giornata
            this.currentEditingData.data.stato = document.getElementById('adminDayStatus').value;

            // Salva su Firestore
            await FirestoreService.saveOreLavorative(
                employeeId,
                date,
                this.currentEditingData.data
            );

            // Chiudi modal
            bootstrap.Modal.getInstance(document.getElementById('dayEditorModal')).hide();

            showToast('Modifiche salvate con successo', 'success');

            // Ricarica riepilogo se necessario
            this.applyFilters();

        } catch (error) {
            console.error('Errore salvataggio modifiche:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    async openDayDetailsEditor(employeeId, date) {
        // Apri direttamente l'editor per la data specifica
        try {
            showGlobalLoading(true);
            
            const employee = this.employeeService.getEmployeeById(employeeId);
            const dayData = await FirestoreService.getOreLavorative(employeeId, date);
            
            this.openDayEditor(employee, date, dayData);
            
        } catch (error) {
            console.error('Errore caricamento dettagli giornata:', error);
            showToast('Errore caricamento dati', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }
}

// Inizializza il servizio admin
const adminService = new AdminService();

// Esponi globalmente per gli onclick
window.adminService = adminService;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (adminService && typeof adminService.cleanup === 'function') {
        adminService.cleanup();
    }
});