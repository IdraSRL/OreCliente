import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../services/firestore-service.js';
import { EmployeeService } from '../services/employee-service.js';
import { CantiereService } from '../services/cantiere-service.js';
import { PhotoService } from '../services/photo-service.js';
import { BadgeManager } from './badge-manager.js';
import { ActivityManager } from './activity-manager.js';
import { CantiereSelector } from './cantiere-selector.js';
import { DateManager } from './date-manager.js';
import { ReportManager } from './report-manager.js';
import { debounce, generateId, showToast, showGlobalLoading } from '../utils/utils.js';
import { getTodayString } from '../utils/date-utils.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { MemoryManager } from '../utils/memory-manager.js';
import { ConnectionMonitor } from '../services/connection-monitor.js';

import { SaveQueue } from '../utils/save-queue.js';

/* ============================== Main Service ============================== */
class TimeEntryService {
  constructor() {
    this.currentUser = null;
    this.employeeService = new EmployeeService();
    this.cantiereService = new CantiereService();
    
    // Managers
    this.badgeManager = null;
    this.activityManager = null;
    this.cantiereSelector = null;
    this.dateManager = null;
    this.reportManager = null;
    
    this.currentDayData = {
      data: getTodayString(),
      stato: 'Normale',
      attivita: [],
    };

    this.saveQueue = new SaveQueue();
    this.init();
  }

  async init() {
    if (!AuthService.initPageProtection('employee')) return;

    this.currentUser = AuthService.getCurrentUser();
    if (!this.currentUser || !this.currentUser.id) {
      console.error('Utente non valido');
      AuthService.logout();
      return;
    }

    // Initialize managers
    await this.initializeManagers();
    
    this.setupEventListeners();
    await this.loadInitialData();
    
    setTimeout(() => this.loadCurrentDay(), 500);
    this.setupAutoSave();
    this.setupModalEvents();
    this.ensureNoteModal();
  }

  async initializeManagers() {
    // Initialize activity manager
    this.activityManager = new ActivityManager(async () => {
      this.currentDayData.attivita = this.activityManager.getActivities();
      this.autoSave();
      await this.saveNow();
    });

    // Initialize badge manager
    this.badgeManager = new BadgeManager(this.currentUser.id, async (activity) => {
      await this.activityManager.addActivity(activity);
    });
    await this.badgeManager.init();

    // Initialize cantiere selector
    this.cantiereSelector = new CantiereSelector(this.cantiereService, async (activities) => {
      for (const activity of activities) {
        await this.activityManager.addActivity(activity);
      }
      this.closeCantiereModal();
    });

    // Initialize date manager
    this.dateManager = new DateManager((date) => {
      this.currentDayData.data = date;
      this.loadCurrentDay();
    });

    // Initialize report manager
    this.reportManager = new ReportManager(this.currentUser.id);
  }

  /* ------------------------------- UI wiring ------------------------------ */
  setupModalEvents() {
    const cantiereModal = document.getElementById('cantiereModal');
    if (!cantiereModal) return;

    cantiereModal.addEventListener('show.bs.modal', () => {
      if (this.cantiereService.getAllCantieri().length === 0) {
        this.loadInitialData().then(() => this.cantiereSelector.populateModal());
      } else {
        this.cantiereSelector.populateModal();
      }
    });
  }

  setupEventListeners() {
    AuthService.setupLogoutHandlers();

    const loadDayBtn = document.getElementById('loadDayBtn');
    if (loadDayBtn) loadDayBtn.addEventListener('click', () => this.loadCurrentDay());

    const dayStatus = document.getElementById('dayStatus');
    if (dayStatus) {
      dayStatus.addEventListener('change', async (e) => {
        this.currentDayData.stato = e.target.value;
        this.activityManager.updateUI();
        this.autoSave();
        await this.saveNow();
      });
    }

    const badgeBtn = document.getElementById('badgeBtn');
    if (badgeBtn) badgeBtn.addEventListener('click', () => this.badgeManager.toggleBadge());

    const addSelectedBtn = document.getElementById('addSelectedCantiereBtn');
    if (addSelectedBtn) addSelectedBtn.addEventListener('click', () => this.cantiereSelector.addSelectedCantieri());

    const pstForm = document.getElementById('pstForm');
    if (pstForm) {
      pstForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addPST();
      });
    }

    const cantierePersone = document.getElementById('cantierePersone');
    if (cantierePersone) {
      cantierePersone.addEventListener('input', () => this.cantiereSelector.updateSelectionUI());
    }

    const activitiesTable = document.getElementById('activitiesTable');
    if (activitiesTable) {
      activitiesTable.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'edit-note') {
          this.openNoteModal(id);
        } else if (action === 'delete-activity') {
          this.activityManager.removeActivity(id);
        }
      });
    }
  }

  setupAutoReport() {
    const reportMonth = document.getElementById('reportMonth');
    const reportYear = document.getElementById('reportYear');
    
    if (reportMonth) {
      reportMonth.addEventListener('change', () => this.loadMonthlyReport());
    }
    
    if (reportYear) {
      reportYear.addEventListener('change', () => this.loadMonthlyReport());
    }
  }

  /* ------------------------------ Data loading ---------------------------- */
  async loadInitialData() {
    try {
      showGlobalLoading(true, 'Caricamento dati...');

      await Promise.all([
        this.employeeService.loadEmployees(),
        this.cantiereService.loadCantieri(),
        this.cantiereService.loadCategorie(),
      ]);

      const cantieri = this.cantiereService.getAllCantieri();
      if (cantieri.length === 0) {
        showToast("Nessun cantiere disponibile. Contatta l'amministratore.", 'warning');
      }
      
      this.populateEmployeeBadge();
    } catch (error) {
      console.error('Errore caricamento dati iniziali:', error);
      const userMessage = ErrorHandler.handleFirebaseError(error, 'caricamento dati iniziali');
      showToast(userMessage, 'error');
    } finally {
      showGlobalLoading(false);
    }
  }

  /* --------------------------- Day load & render -------------------------- */
  async loadCurrentDay() {
    try {
      showGlobalLoading(true, 'Caricamento giornata...');

      const currentDate = this.dateManager.getCurrentDate();
      const dayData = await FirestoreService.getOreLavorative(this.currentUser.id, currentDate);

      this.currentDayData = {
        data: currentDate,
        stato: dayData.stato || 'Normale',
        attivita: dayData.attivita || [],
      };

      const dayStatus = document.getElementById('dayStatus');
      if (dayStatus) dayStatus.value = this.currentDayData.stato;

      this.activityManager.setActivities(this.currentDayData.attivita);

      showToast('Giornata caricata con successo', 'success');
    } catch (error) {
      console.error('Errore caricamento giornata:', error);
      showToast('Errore caricamento giornata', 'error');
    } finally {
      showGlobalLoading(false);
    }
  }

  closeCantiereModal() {
    const modalEl = document.getElementById('cantiereModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

addPST() {
  const nameEl = document.getElementById('pstName');
  const minutesEl = document.getElementById('pstMinutes');
  const personeEl = document.getElementById('pstPersone');

  // Prendi il nome in modo sicuro (sempre stringa) e trimma
  const nome = (nameEl?.value ?? '').trim();

  // Parse minuti senza usare || per non perdere lo 0
  let minuti = parseInt(minutesEl?.value ?? '', 10);
  if (Number.isNaN(minuti)) minuti = 480;
  if (minuti < 0) minuti = 0;
  if (minuti > 1440) minuti = 1440;

  // Parse persone
  let persone = parseInt(personeEl?.value ?? '', 10);
  if (Number.isNaN(persone) || persone < 1) persone = 1;
  if (persone > 50) persone = 50;

  if (!nome) {
    showToast("Inserisci il nome dell'attività", 'warning'); // <-- parentesi aggiunte
    return;
  }

  const minutiEffettivi = Math.round(minuti / persone);

  const activity = {
    id: generateId('pst'),
    nome,
    minuti,
    persone,
    minutiEffettivi,
    tipo: 'pst',
  };

  this.activityManager.addActivity(activity);

  // Reset form e chiusura modal come prima
  const pstForm = document.getElementById('pstForm');
  if (pstForm) pstForm.reset();

  if (minutesEl) minutesEl.value = '480';
  if (personeEl) personeEl.value = '1';

  const modalEl = document.getElementById('pstModal');
  if (modalEl) {
    const bs = window.bootstrap && window.bootstrap.Modal;
    if (bs) {
      const instance = bs.getInstance(modalEl) || (typeof bs.getOrCreateInstance === 'function' ? bs.getOrCreateInstance(modalEl) : new bs(modalEl));
      if (instance) instance.hide();
    } else {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      modalEl.setAttribute('aria-hidden', 'true');
    }
  }

  showToast('Attività PST aggiunta con successo', 'success');
}

  // === Note attività (modal) ===
  ensureNoteModal() {
    if (document.getElementById('noteModal')) return;

    const modal = document.createElement('div');
    modal.id = 'noteModal';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-stickies me-2"></i>Note attività
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="noteActivityId">
            <div class="mb-2">
              <label class="form-label" for="noteTextarea">Note</label>
              <textarea id="noteTextarea" class="form-control" rows="5" placeholder="Aggiungi note o dettagli..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-primary" id="saveNoteBtn">
              <i class="bi bi-check2 me-1"></i>Salva
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#saveNoteBtn').addEventListener('click', () => this.saveNoteFromModal());
  }

  openNoteModal(activityId) {
    const activity = this.currentDayData.attivita.find((a) => a.id === activityId);
    if (!activity) return;

    const modalEl = document.getElementById('noteModal');
    modalEl.querySelector('#noteActivityId').value = activityId;
    modalEl.querySelector('#noteTextarea').value = activity.note || '';

    const bs = window.bootstrap && window.bootstrap.Modal;
    let instance = null;
    if (bs && typeof bs.getOrCreateInstance === 'function') {
      instance = bs.getOrCreateInstance(modalEl);
    } else if (bs) {
      instance = new bs(modalEl);
    }

    if (instance) {
      instance.show();
    } else {
      // Fallback senza JS di Bootstrap
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
      modalEl.removeAttribute('aria-hidden');
      modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach((btn) => {
        btn.addEventListener('click', () => this.closeNoteModalFallback(), { once: true });
      });
    }
  }

  closeNoteModalFallback() {
    const modalEl = document.getElementById('noteModal');
    if (!modalEl) return;
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
  }

  saveNoteFromModal() {
    const modalEl = document.getElementById('noteModal');
    const id = modalEl.querySelector('#noteActivityId').value;
    const note = modalEl.querySelector('#noteTextarea').value.trim();

    this.updateActivityNote(id, note).then(() => {
      const bs = window.bootstrap && window.bootstrap.Modal;
      if (bs) {
        const instance =
          bs.getInstance(modalEl) ||
          (typeof bs.getOrCreateInstance === 'function' ? bs.getOrCreateInstance(modalEl) : new bs(modalEl));
        if (instance) instance.hide();
      } else {
        this.closeNoteModalFallback();
      }
      showToast('Note aggiornate', 'success');
    });
  }

  async updateActivityNote(activityId, note) {
    await this.activityManager.updateActivity(activityId, 'note', note);
  }

  /* ------------------------------- Autosave ------------------------------- */
  setupAutoSave() {
    this.autoSave = debounce(async () => {
      try {
        await FirestoreService.saveOreLavorative(this.currentUser.id, this.currentDate, this.currentDayData);

        const autoSaveStatus = document.getElementById('autoSaveStatus');
        if (autoSaveStatus)
          autoSaveStatus.innerHTML = '<i class="bi bi-cloud-check me-1"></i>Salvato automaticamente';

        const lastSaved = document.getElementById('lastSaved');
        if (lastSaved) lastSaved.textContent = 'Ultimo salvataggio: ' + new Date().toLocaleTimeString('it-IT');
      } catch (error) {
        console.error('Errore auto-save:', error);
        const autoSaveStatus = document.getElementById('autoSaveStatus');
        if (autoSaveStatus)
          autoSaveStatus.innerHTML = '<i class="bi bi-cloud-slash me-1"></i>Errore salvataggio';
      }
    }, 2000);
  }

  populateEmployeeBadge() {
    const employee = this.employeeService.getEmployeeById(this.currentUser.id);
    if (!employee) return;

    // Dati principali
    const fullName = document.getElementById('employeeFullName');
    if (fullName) fullName.textContent = employee.name.toUpperCase();

    const role = document.getElementById('employeeRole');
    if (role) role.textContent = (employee.ruolo || 'DIPENDENTE').toUpperCase();

    const empId = document.getElementById('employeeId');
    if (empId) empId.textContent = employee.matricola || employee.id;

    const cf = document.getElementById('employeeCF');
    if (cf) cf.textContent = employee.codiceFiscale || 'N/A';

    const phone = document.getElementById('employeePhone');
    if (phone) phone.textContent = employee.telefono || 'N/A';

    // Foto
    const photoElement = document.getElementById('employeePhoto');
    if (photoElement) {
      if (employee.foto) {
        const photoUrl = PhotoService.getPhotoUrl(employee.foto);
        photoElement.innerHTML = `<img src="${photoUrl}" alt="${employee.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        const initials = PhotoService.getInitials(employee.name);
        photoElement.innerHTML = `<span style="color: white; font-weight: bold; font-size: 24px;">${initials}</span>`;
      }
    }

    // Dati badge demo
    const issue = document.getElementById('badgeIssueDate');
    if (issue) issue.textContent = '01/01/2024';
    const expiry = document.getElementById('badgeExpiry');
    if (expiry) expiry.textContent = '31/12/2024';
    const serial = document.getElementById('badgeSerial');
    if (serial) serial.textContent = `#BD24${employee.id.padStart(4, '0')}`;
  }

  async saveNow() {
    const currentDate = this.dateManager.getCurrentDate();
    const payload = {
      ...this.currentDayData,
      data: currentDate,
      attivita: this.activityManager.getActivities()
    };

    await this.saveQueue.save(async () => {
      try {
        await FirestoreService.saveOreLavorative(this.currentUser.id, currentDate, payload);
        const autoSaveStatus = document.getElementById('autoSaveStatus');
        if (autoSaveStatus) autoSaveStatus.innerHTML = '<i class="bi bi-cloud-check me-1"></i>Salvato';
        const lastSaved = document.getElementById('lastSaved');
        if (lastSaved) lastSaved.textContent = 'Ultimo salvataggio: ' + new Date().toLocaleTimeString('it-IT');
      } catch (error) {
        console.error('Errore salvataggio:', error);
        const autoSaveStatus = document.getElementById('autoSaveStatus');
        if (autoSaveStatus) autoSaveStatus.innerHTML = '<i class="bi bi-cloud-slash me-1"></i>Errore salvataggio';
        throw error;
      }
    });
  }

  destroy() {
    // Destroy managers
    if (this.badgeManager) {
      this.badgeManager.destroy();
      this.badgeManager = null;
    }

    if (this.cantiereSelector) {
      this.cantiereSelector.resetSelection();
      this.cantiereSelector = null;
    }

    if (this.activityManager) {
      this.activityManager.clear();
      this.activityManager = null;
    }

    MemoryManager.cleanup();
    this.currentDayData = null;
    this.currentUser = null;
  }
}

// Inizializza il servizio
const timeEntryService = new TimeEntryService();

// Esporta globalmente per onclick inline
window.timeEntryService = timeEntryService;

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  timeEntryService.destroy();
});