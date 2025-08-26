import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../services/firestore-service.js';
import { EmployeeService } from '../services/employee-service.js';
import { CantiereService } from '../services/cantiere-service.js';
import { BadgeService } from '../services/badge-service.js';
import { PhotoService } from '../services/photo-service.js';
import { TableRenderer } from '../ui/table-renderer.js';
import { ButtonUtils } from '../ui/button-utils.js';
import {
  debounce,
  generateId,
  minutesToHHMM,
  minutesToDecimal,
  getTodayString,
  getYesterdayString,
  formatDate,
  isDateAllowed,
  getWeekday,
  showToast,
  showGlobalLoading,
  showConfirm,
} from '../utils/utils.js';
import { getMonthRange } from '../utils/date-utils.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { MemoryManager } from '../utils/memory-manager.js';
import { ConnectionMonitor } from '../services/connection-monitor.js';

/* ========== Robust save queue to serialize writes and avoid races ========== */
class SaveQueue {
  constructor() {
    this._saving = false;
    this._pending = false;
    this._lastTask = null;
    this._maxRetries = 3;
  }
  
  async save(task) {
    this._lastTask = task;
    if (this._saving) {
      this._pending = true;
      return;
    }
    this._saving = true;
    let retries = 0;
    
    try {
      while (retries <= this._maxRetries) {
        try {
          await task();
          break;
        } catch (error) {
          retries++;
          if (retries > this._maxRetries) {
            throw error;
          }
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (e) {
      ErrorHandler.logError(e, 'SaveQueue');
      
      // Add to retry queue if offline
      if (!ConnectionMonitor.isOnline) {
        ConnectionMonitor.addToRetryQueue(task, 'SaveQueue operation');
      }
    } finally {
      const shouldRunAgain = this._pending;
      this._pending = false;
      this._saving = false;
      if (shouldRunAgain && this._lastTask) {
        const last = this._lastTask;
        this._lastTask = null;
        setTimeout(() => this.save(last), 100); // Prevent immediate recursion
      }
    }
  }
}

/* ============================== Main Service ============================== */
class TimeEntryService {
  constructor() {
    // Multi-selezione cantieri
    this.selectedCantieri = new Set();

    this.currentUser = null;
    this.employeeService = new EmployeeService();
    this.cantiereService = new CantiereService();
    this.badgeService = null;

    this.currentDate = getTodayString();
    this.currentDayData = {
      data: this.currentDate,
      stato: 'Normale',
      attivita: [],
    };

    this.autoSaveTimer = null;
    this.badgeTimer = null;

    // coda salvataggi
    this.saveQueue = new SaveQueue();

    // Avvio inizializzazione (async non bloccante)
    this.init();
  }

  async init() {
    // Protezione pagina per dipendente
    if (!AuthService.initPageProtection('employee')) return;

        // Aggiorna immediatamente l'UI dopo l'entrata
        this.updateBadgeUI();
    this.currentUser = AuthService.getCurrentUser();
    
    if (!this.currentUser || !this.currentUser.id) {
      console.error('Utente non valido');
      AuthService.logout();
        // Aggiorna immediatamente l'UI dopo l'uscita
        this.updateBadgeUI();
      return;
    }

    // Badge service
    this.badgeService = new BadgeService(this.currentUser.id);
    await this.badgeService.startWatcher(({ isOpen }) => {
      const btn = document.getElementById('badgeBtn');
      const badgeText = document.getElementById('badgeText');
      if (!btn || !badgeText) return;
      if (isOpen) {
        btn.className = 'btn btn-danger w-100';
        badgeText.textContent = 'Uscita';
      } else {
        btn.className = 'btn btn-warning w-100';
        badgeText.textContent = 'Entrata';
      }
    });


    // Listeners UI
    this.setupEventListeners();

    // Dati iniziali
    await this.loadInitialData();

    // Data corrente (sempre oggi di default)
    this.setCurrentDate(getTodayString());

    // Timer badge e autosave
    this.startBadgeTimer();
    this.setupAutoSave();

    // Eventi modali
    this.setupModalEvents();

    // Assicura esistenza modale note
    this.ensureNoteModal();
  }

  /* ------------------------------- UI wiring ------------------------------ */
  setupModalEvents() {
    const cantiereModal = document.getElementById('cantiereModal');
    if (!cantiereModal) return;

    cantiereModal.addEventListener('show.bs.modal', () => {
      console.log('Debug - Modal cantiere aperto, ricaricamento dati...');
      const cantieri = this.cantiereService.getAllCantieri();
      const categorie = this.cantiereService.getAllCategorie();
      console.log('Debug - Cantieri nel modal:', cantieri.length);
      console.log('Debug - Categorie nel modal:', categorie.length);
      
      if (cantieri.length === 0 || categorie.length === 0) {
        console.log('Debug - Ricaricamento dati necessario');
        this.loadInitialData().then(() => this.populateCantieriModal());
      } else {
        console.log('Debug - Dati già presenti, popolamento modal');
        this.populateCantieriModal();
      }
    });
  }

  setupEventListeners() {
    // Logout
    AuthService.setupLogoutHandlers();

    // Cambio data
    const workDate = document.getElementById('workDate');
    if (workDate) {
      workDate.addEventListener('change', (e) => this.validateAndSetDate(e.target.value));
    }

    // Carica giornata
    const loadDayBtn = document.getElementById('loadDayBtn');
    if (loadDayBtn) loadDayBtn.addEventListener('click', () => this.loadCurrentDay());

    // Stato giornata
    const dayStatus = document.getElementById('dayStatus');
    if (dayStatus) {
      dayStatus.addEventListener('change', async (e) => {
        this.currentDayData.stato = e.target.value;
        this.autoSave();
        await this.saveNow();
      });
    }

    // Pulsante badge
    const badgeBtn = document.getElementById('badgeBtn');
    if (badgeBtn) badgeBtn.addEventListener('click', () => this.toggleBadge());

    // Aggiungi cantieri selezionati
    const addSelectedBtn = document.getElementById('addSelectedCantiereBtn');
    if (addSelectedBtn) addSelectedBtn.addEventListener('click', () => this.addSelectedCantiere());

    // Form PST
    const pstForm = document.getElementById('pstForm');
    if (pstForm) {
      pstForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addPST();
      });
    }

    // Carica report
    const loadReportBtn = document.getElementById('loadReportBtn');
    if (loadReportBtn) loadReportBtn.addEventListener('click', () => this.loadMonthlyReport());

    // Cambia persone nel modale cantieri
    const cantierePersone = document.getElementById('cantierePersone');
    if (cantierePersone) {
      cantierePersone.addEventListener('input', () => this.updateCantiereSelection());
    }

    // Deleghe tabella attività (edit note / delete)
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
          this.removeActivity(id);
        }
      });
    }
  }

  /* ------------------------------ Data loading ---------------------------- */
  async loadInitialData() {
    try {
      showGlobalLoading(true, 'Caricamento dati...');

      console.log('Debug - Inizio caricamento dati iniziali');
      
      await Promise.all([
        this.employeeService.loadEmployees(),
        this.cantiereService.loadCantieri(),
        this.cantiereService.loadCategorie(),
      ]);

      console.log('Debug - Dati caricati:');
      console.log('- Dipendenti:', this.employeeService.getAllEmployees().length);
      console.log('- Cantieri:', this.cantiereService.getAllCantieri().length);
      console.log('- Categorie:', this.cantiereService.getAllCategorie().length);

      // Verifica che i dati siano stati caricati correttamente
      const cantieri = this.cantiereService.getAllCantieri();
      const categorie = this.cantiereService.getAllCategorie();
      
      if (cantieri.length === 0) {
        console.warn('Nessun cantiere caricato');
        showToast('Nessun cantiere disponibile. Contatta l\'amministratore.', 'warning');
      }
      
      if (categorie.length === 0) {
        console.warn('Nessuna categoria caricata');
      }
      this.populateCantieriModal();
      this.populateEmployeeBadge();
      this.populateReportYears();
    } catch (error) {
      console.error('Errore caricamento dati iniziali:', error);
      const userMessage = ErrorHandler.handleFirebaseError(error, 'caricamento dati iniziali');
      showToast(userMessage, 'error');
    } finally {
      showGlobalLoading(false);
    }
  }

  /* ------------------------------ Date control ---------------------------- */
  validateAndSetDate(dateString) {
    if (!isDateAllowed(dateString)) {
      showToast('Puoi inserire ore solo per oggi o ieri', 'warning');
      const workDate = document.getElementById('workDate');
      if (workDate) workDate.value = this.currentDate;
      return;
    }
    this.setCurrentDate(dateString);
  }

  setCurrentDate(dateString) {
    this.currentDate = dateString;
    const workDate = document.getElementById('workDate');
    if (workDate) workDate.value = dateString;

    const displayElement = document.getElementById('selectedDateDisplay');
    const badgeElement = document.getElementById('selectedDateBadge');

    if (displayElement && badgeElement) {
      displayElement.textContent = formatDate(dateString);

      if (dateString === getTodayString()) {
        badgeElement.textContent = 'OGGI';
        badgeElement.className = 'badge bg-success';
      } else if (dateString === getYesterdayString()) {
        badgeElement.textContent = 'IERI';
        badgeElement.className = 'badge bg-warning';
      } else {
        badgeElement.textContent = getWeekday(dateString).toUpperCase();
        badgeElement.className = 'badge bg-info';
      }
    }
  }

  /* --------------------------- Day load & render -------------------------- */
  async loadCurrentDay() {
    try {
      showGlobalLoading(true, 'Caricamento giornata...');

      const dayData = await FirestoreService.getOreLavorative(this.currentUser.id, this.currentDate);

      this.currentDayData = {
        data: this.currentDate,
        stato: dayData.stato || 'Normale',
        attivita: dayData.attivita || [],
      };

      const dayStatus = document.getElementById('dayStatus');
      if (dayStatus) dayStatus.value = this.currentDayData.stato;

      this.updateActivitiesTable();
      this.updateStats();

      showToast('Giornata caricata con successo', 'success');
    } catch (error) {
      console.error('Errore caricamento giornata:', error);
      showToast('Errore caricamento giornata', 'error');
    } finally {
      showGlobalLoading(false);
    }
  }

  populateCantieriModal() {
    const container = document.getElementById('cantieriContainer');
    if (!container) return;

    console.log('Debug - populateCantieriModal chiamato');
    console.log('Debug - Cantieri disponibili:', this.cantiereService.getAllCantieri());
    console.log('Debug - Categorie disponibili:', this.cantiereService.getAllCategorie());

    const cantieriByCategoria = this.cantiereService.getCantieriByCategoria();
    console.log('Debug - Cantieri per categoria:', cantieriByCategoria);
    container.innerHTML = '';

    let totalCantieri = 0;
    let groupsToProcess = cantieriByCategoria;

    if (Array.isArray(groupsToProcess)) {
      totalCantieri = groupsToProcess.reduce(
        (total, group) => total + (group.cantieri ? group.cantieri.length : 0),
        0,
      );
    } else {
      console.error('getCantieriByCategoria() should return an array, got:', typeof groupsToProcess);
      groupsToProcess = [];
    }

    console.log('Debug - Totale cantieri trovati:', totalCantieri);

    if (totalCantieri === 0) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Nessun cantiere disponibile. Contatta l'amministratore per configurare i cantieri.<br>
          <small>Debug: Cantieri totali: ${this.cantiereService.getAllCantieri().length}, Categorie: ${this.cantiereService.getAllCategorie().length}</small>
        </div>
      `;
      return;
    }

    // Setup toggle all categories button
    const toggleBtn = document.getElementById('toggleAllCategories');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleAllCategories());
    }

    groupsToProcess.forEach((group) => {
      if (!group.cantieri || group.cantieri.length === 0) return;

      // Accordion per categoria (mobile-friendly)
      const categoryAccordion = document.createElement('div');
      categoryAccordion.className = 'mb-3';
      const categoryId = `category-${group.categoria.id}`;
      
      categoryAccordion.innerHTML = `
        <div class="card border-0" style="border-left: 4px solid ${group.categoria.color} !important;">
          <div class="card-header bg-transparent border-0 p-2" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#${categoryId}">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0 fw-bold" style="color: ${group.categoria.color};">
                <i class="bi ${group.categoria.icon} me-2"></i>
                ${group.categoria.name}
                <span class="badge ms-2" style="background-color: ${group.categoria.color}20; color: ${group.categoria.color};">
                  ${group.cantieri.length}
                </span>
              </h6>
              <i class="bi bi-chevron-down text-muted category-toggle"></i>
            </div>
          </div>
          <div class="collapse show" id="${categoryId}">
            <div class="card-body p-2">
              <div class="cantieri-grid"></div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(categoryAccordion);

      const cantieriGrid = categoryAccordion.querySelector('.cantieri-grid');

      group.cantieri.forEach((cantiere) => {
        const cantiereItem = document.createElement('div');
        cantiereItem.className = 'cantiere-item mb-2';
        cantiereItem.innerHTML = `
          <div class="card cantiere-card h-100" style="cursor: pointer; transition: all 0.2s;" data-cantiere-id="${cantiere.id}">
            <div class="card-body p-2">
              <div class="d-flex align-items-center">
                <div class="form-check me-2">
                  <input class="form-check-input cantiere-checkbox" type="checkbox" value="${cantiere.id}">
                </div>
                <div class="flex-grow-1">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 class="mb-1 fw-bold" style="font-size: 0.9rem;">${cantiere.name}</h6>
                      ${cantiere.descrizione ? `<div class="small text-muted mb-2" style="line-height: 1.3;">${cantiere.descrizione}</div>` : ''}
                      <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary small">${minutesToHHMM(cantiere.minutes)}</span>
                        <small class="text-muted">${cantiere.minutes} min</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        cantieriGrid.appendChild(cantiereItem);
      });

      // Setup collapse toggle icon
      const toggleIcon = categoryAccordion.querySelector('.category-toggle');
      const collapseElement = categoryAccordion.querySelector('.collapse');
      
      collapseElement.addEventListener('show.bs.collapse', () => {
        toggleIcon.className = 'bi bi-chevron-up text-muted category-toggle';
      });
      
      collapseElement.addEventListener('hide.bs.collapse', () => {
        toggleIcon.className = 'bi bi-chevron-down text-muted category-toggle';
      });
    });

    // Click card toggla checkbox
    container.querySelectorAll('.cantiere-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('cantiere-checkbox')) return;
        const cb = card.querySelector('.cantiere-checkbox');
        if (!cb) return;
        cb.checked = !cb.checked;
        this.toggleCantiereSelection(cb.value, cb.checked);
      });
    });

    // Cambio checkbox
    container.querySelectorAll('.cantiere-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => this.toggleCantiereSelection(cb.value, cb.checked));
    });
  }

  // Compatibilità con eventuali chiamate legacy
  selectCantiere(cantiereId) {
    this.toggleCantiereSelection(cantiereId, !this.selectedCantieri.has(cantiereId));
  }

  toggleCantiereSelection(cantiereId, isSelected) {
    const card = document.querySelector(`.cantiere-card[data-cantiere-id="${cantiereId}"]`);

    if (isSelected) {
      this.selectedCantieri.add(cantiereId);
      if (card) {
        card.classList.add('border-primary');
        card.style.backgroundColor = 'rgba(13, 110, 253, 0.1)';
      }
    } else {
      this.selectedCantieri.delete(cantiereId);
      if (card) {
        card.classList.remove('border-primary');
        card.style.backgroundColor = '';
      }
      const cb = card ? card.querySelector('.cantiere-checkbox') : null;
      if (cb) cb.checked = false;
    }

    const addBtn = document.getElementById('addSelectedCantiereBtn');
    if (addBtn) addBtn.disabled = this.selectedCantieri.size === 0;

    // Update selection counter and preview
    this.updateSelectionPreview();
    this.updateCantiereSelection();
  }

  updateSelectionPreview() {
    const selectedCount = document.getElementById('selectedCount');
    const selectedPreview = document.getElementById('selectedPreview');
    
    if (selectedCount) {
      selectedCount.textContent = this.selectedCantieri.size;
    }
    
    if (selectedPreview) {
      if (this.selectedCantieri.size === 0) {
        selectedPreview.textContent = 'Nessun cantiere selezionato';
      } else {
        const selectedNames = Array.from(this.selectedCantieri).map(id => {
          const cantiere = this.cantiereService.getCantiereById(id);
          return cantiere ? cantiere.name : id;
        }).slice(0, 3);
        
        let preview = selectedNames.join(', ');
        if (this.selectedCantieri.size > 3) {
          preview += ` e altri ${this.selectedCantieri.size - 3}...`;
        }
        selectedPreview.textContent = preview;
      }
    }
  }

  toggleAllCategories() {
    const toggleBtn = document.getElementById('toggleAllCategories');
    const collapses = document.querySelectorAll('#cantieriContainer .collapse');
    
    let allExpanded = true;
    collapses.forEach(collapse => {
      if (!collapse.classList.contains('show')) {
        allExpanded = false;
      }
    });
    
    if (allExpanded) {
      // Collapse all
      collapses.forEach(collapse => {
        const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
        bsCollapse.hide();
      });
      if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="bi bi-arrows-expand me-1"></i>Espandi tutto';
      }
    } else {
      // Expand all
      collapses.forEach(collapse => {
        const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
        bsCollapse.show();
      });
      if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="bi bi-arrows-collapse me-1"></i>Comprimi tutto';
      }
    }
  }

  updateCantiereSelection() {
    let persone = parseInt(document.getElementById('cantierePersone')?.value, 10) || 1;
    if (isNaN(persone) || persone < 1) persone = 1;
    if (persone > 50) persone = 50;

    let totalMinutes = 0;
    this.selectedCantieri.forEach((id) => {
      const c = this.cantiereService.getCantiereById(id);
      if (c) totalMinutes += Math.round(c.minutes / persone);
    });

    const btn = document.getElementById('addSelectedCantiereBtn');
    if (btn) {
      btn.innerHTML = `
        <i class="bi bi-plus me-2"></i>
        Aggiungi ${this.selectedCantieri.size} cantieri (${minutesToHHMM(totalMinutes)})
      `;
    }
  }

  addSelectedCantiere() {
    if (!this.selectedCantieri || this.selectedCantieri.size === 0) {
      showToast('Seleziona almeno un cantiere', 'warning');
      return;
    }

    let persone = parseInt(document.getElementById('cantierePersone')?.value, 10) || 1;
    if (isNaN(persone) || persone < 1) persone = 1;
    if (persone > 50) persone = 50;

    this.selectedCantieri.forEach((id) => {
      const c = this.cantiereService.getCantiereById(id);
      if (!c) return;

      const minutiEff = Math.round(c.minutes / persone);
      const cat = this.cantiereService.getCategoriaById(c.categoria || 'generale') || {
        id: 'generale',
        name: 'Generale',
      };

      const activity = {
        id: generateId('cantiere'),
        cantiereId: c.id,
        nome: c.name,
        categoriaId: cat.id,
        categoriaName: cat.name,
        note: c.descrizione || '',
        minuti: c.minutes,
        persone,
        minutiEffettivi: minutiEff,
        tipo: 'cantiere',
      };

      this.addActivity(activity);
    });

    // Chiudi modal e reset selezione
    const modalEl = document.getElementById('cantiereModal');
    if (modalEl) {
      const bs = window.bootstrap && window.bootstrap.Modal;
      if (bs) {
        const modal = bs.getInstance(modalEl) || (typeof bs.getOrCreateInstance === 'function' ? bs.getOrCreateInstance(modalEl) : new bs(modalEl));
        if (modal) modal.hide();
      } else {
        // fallback
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
      }
    }

    this.selectedCantieri.clear();
    document.querySelectorAll('.cantiere-card').forEach((card) => card.classList.remove('border-primary'));

    const addBtn = document.getElementById('addSelectedCantiereBtn');
    if (addBtn) addBtn.disabled = true;

    const personeInput = document.getElementById('cantierePersone');
    if (personeInput) personeInput.value = '1';

    showToast('Cantieri aggiunti con successo', 'success');
  }

  addPST() {
    const nome = document.getElementById('pstName')?.value.trim();
    let minuti = parseInt(document.getElementById('pstMinutes')?.value, 10) || 480;
    if (isNaN(minuti) || minuti < 0) minuti = 0;
    if (minuti > 1440) minuti = 1440;
    let persone = parseInt(document.getElementById('pstPersone')?.value, 10) || 1;
    if (isNaN(persone) || persone < 1) persone = 1;
    if (persone > 50) persone = 50;

    if (!nome) {
      showToast("Inserisci il nome dell'attività", 'warning');
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

    this.addActivity(activity);

    // Reset form e chiudi modal
    const pstForm = document.getElementById('pstForm');
    if (pstForm) pstForm.reset();
    const pstMinutes = document.getElementById('pstMinutes');
    if (pstMinutes) pstMinutes.value = '480';
    const pstPersone = document.getElementById('pstPersone');
    if (pstPersone) pstPersone.value = '1';

    const modalEl = document.getElementById('pstModal');
    if (modalEl) {
      const bs = window.bootstrap && window.bootstrap.Modal;
      if (bs) {
        const modal = bs.getInstance(modalEl) || (typeof bs.getOrCreateInstance === 'function' ? bs.getOrCreateInstance(modalEl) : new bs(modalEl));
        if (modal) modal.hide();
      } else {
        // fallback
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
      }
    }

    showToast('Attività PST aggiunta con successo', 'success');
  }

  /* ----------------------------- Activity CRUD ---------------------------- */
  async addActivity(activity) {
    // Se è un cantiere: sostituisce quello precedente con stesso cantiereId nello stesso giorno
    if (activity && activity.tipo === 'cantiere' && activity.cantiereId) {
      const idx = this.currentDayData.attivita.findIndex(
        (a) => a.tipo === 'cantiere' && a.cantiereId === activity.cantiereId,
      );
      if (idx !== -1) {
        this.currentDayData.attivita[idx] = activity;
      } else {
        this.currentDayData.attivita.push(activity);
      }
    } else {
      this.currentDayData.attivita.push(activity);
    }

    this.updateActivitiesTable();
    this.updateStats();
    this.autoSave();
    await this.saveNow();
  }

  async updateActivity(activityId, field, value) {
    const activity = this.currentDayData.attivita.find((a) => a.id === activityId);
    if (!activity) return;

    if (field === 'minuti') {
      const minuti = parseInt(value, 10);
      if (!Number.isNaN(minuti) && minuti >= 0 && minuti <= 1440) {
        activity.minuti = minuti;
        activity.minutiEffettivi = Math.round(minuti / activity.persone);
      }
    } else if (field === 'persone') {
      const persone = parseInt(value, 10);
      if (!Number.isNaN(persone) && persone >= 1 && persone <= 50) {
        activity.persone = persone;
        activity.minutiEffettivi = Math.round(activity.minuti / persone);
      }
    }

    this.updateActivitiesTable();
    this.updateStats();
    this.autoSave();
    await this.saveNow();
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
    const activity = this.currentDayData.attivita.find((a) => a.id === activityId);
    if (!activity) return;
    activity.note = note;
    this.updateActivitiesTable();
    this.autoSave();
    await this.saveNow();
  }

  async removeActivity(activityId) {
    const confirmed = await showConfirm(
      'Rimuovi Attività',
      'Sei sicuro di voler rimuovere questa attività?',
      'Rimuovi',
      'Annulla',
      'danger',
    );

    if (!confirmed) return;

    this.currentDayData.attivita = this.currentDayData.attivita.filter((a) => a.id !== activityId);
    this.updateActivitiesTable();
    this.updateStats();
    this.autoSave();
    await this.saveNow();
  }

  updateActivitiesTable() {
    const tbody = document.querySelector('#activitiesTable tbody');
    TableRenderer.renderActivitiesTable(tbody, this.currentDayData.attivita);

    const count = this.currentDayData.attivita.length;
    const counter = document.getElementById('activityCount');
    if (counter) counter.textContent = `${count} attivit${count === 1 ? 'à' : 'à'}`;
  }

  updateStats() {
    let totalMinutes = 0;

    this.currentDayData.attivita.forEach((activity) => {
      totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
    });

    const totalHours = minutesToHHMM(totalMinutes);
    const totalDecimal = minutesToDecimal(totalMinutes);
    const totalActivities = this.currentDayData.attivita.length;

    // Desktop
    const totalHoursEl = document.getElementById('totalHours');
    if (totalHoursEl) totalHoursEl.textContent = totalHours;

    const totalDecimalEl = document.getElementById('totalDecimal');
    if (totalDecimalEl) totalDecimalEl.textContent = totalDecimal;

    const totalActivitiesEl = document.getElementById('totalActivities');
    if (totalActivitiesEl) totalActivitiesEl.textContent = totalActivities;

    // Mobile
    const totalHoursMobile = document.getElementById('totalHoursMobile');
    if (totalHoursMobile) totalHoursMobile.textContent = totalHours;

    const totalDecimalMobile = document.getElementById('totalDecimalMobile');
    if (totalDecimalMobile) totalDecimalMobile.textContent = totalDecimal;

    const totalActivitiesMobile = document.getElementById('totalActivitiesMobile');
    if (totalActivitiesMobile) totalActivitiesMobile.textContent = totalActivities;
  }

  /* ------------------------------- Badge I/O ------------------------------- */
async toggleBadge() {
  try {
    const btn = document.getElementById('badgeBtn');
    if (btn) ButtonUtils.showLoading(btn, 'Elaborazione...');

    if (!this.badgeService.isActive()) {
      const result = await this.badgeService.clockIn();
      showToast(`Entrata registrata alle ${result.formattedTime}`, 'success');
    } else {
      const result = await this.badgeService.clockOut();
      const badgeActivity = this.badgeService.createBadgeActivity(result);
      await this.addActivity(badgeActivity);
      showToast(`Uscita registrata: ${result.formattedDuration}`, 'success');
    }
  } catch (error) {
    console.error('Errore toggle badge:', error);
    showToast(error.message, 'error');
  } finally {
    const btn = document.getElementById('badgeBtn');
    if (btn) ButtonUtils.hideLoading(btn);
  }
}


  updateBadgeUI() {
    const btn = document.getElementById('badgeBtn');
    const badgeText = document.getElementById('badgeText');

    if (this.badgeService && this.badgeService.isActive()) {
      if (btn) btn.className = 'btn btn-danger w-100';
      if (badgeText) badgeText.textContent = 'Uscita';
    } else {
      if (btn) btn.className = 'btn btn-warning w-100';
      if (badgeText) badgeText.textContent = 'Entrata';
    }
  }

  startBadgeTimer() {
    if (this.badgeTimer) clearInterval(this.badgeTimer);
    this.badgeTimer = setInterval(() => this.updateBadgeUI(), 60000);
    // also force immediate paint
    this.updateBadgeUI();
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

  /* --------------------------- Employee badge UI -------------------------- */
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

  /* ------------------------------ Monthly report -------------------------- */
  populateReportYears() {
    const yearSelect = document.getElementById('reportYear');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';

    for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) option.selected = true;
      yearSelect.appendChild(option);
    }

    const reportMonth = document.getElementById('reportMonth');
    if (reportMonth) reportMonth.value = new Date().getMonth() + 1;
  }

  async loadMonthlyReport() {
    const month = parseInt(document.getElementById('reportMonth')?.value, 10);
    const year = parseInt(document.getElementById('reportYear')?.value, 10);

    try {
      showGlobalLoading(true, 'Caricamento report...');

      const { start, end } = getMonthRange(year, month);
      const ore = await FirestoreService.getOrePeriodo(this.currentUser.id, start, end);
      this.renderMonthlyReport(ore);
    } catch (error) {
      console.error('Errore caricamento report:', error);
      showToast('Errore caricamento report', 'error');
    } finally {
      showGlobalLoading(false);
    }
  }

  renderMonthlyReport(ore) {
    const tbody = document.querySelector('#reportTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    let totalMinutes = 0;
    let totalDays = 0;
    let totalActivities = 0;
    const cantieriSet = new Set(); // Per tracciare i cantieri unici

    if (!ore || ore.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            <i class="bi bi-calendar-x me-2"></i>
            Nessuna attività registrata per il periodo selezionato
          </td>
        </tr>
      `;
    } else {
      ore.forEach((day) => {
        let dayMinutes = 0;
        let dayActivities = 0;

        if (day.attivita && day.attivita.length > 0) {
          totalDays += 1;
          dayActivities = day.attivita.length;
          dayMinutes = day.attivita.reduce(
            (sum, activity) => sum + (activity.minutiEffettivi || activity.minuti || 0),
                    0
                );
                
                // Aggiungi cantieri alla lista
                day.attivita.forEach(activity => {
                    if (activity.tipo === 'cantiere' && activity.nome) {
                        cantieriSet.add(activity.nome);
                    }
                });
          );
        }

        totalMinutes += dayMinutes;
        totalActivities += dayActivities;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatDate(day.data)}</td>
          <td><span class="badge bg-${this.getStatusBadgeColor(day.stato)}">${day.stato}</span></td>
          <td>${dayActivities}</td>
          <td>${minutesToHHMM(dayMinutes)}</td>
          <td>${minutesToDecimal(dayMinutes)}</td>
        `;
        tbody.appendChild(row);
      });
    }

    const reportTotalHours = document.getElementById('reportTotalHours');
    if (reportTotalHours) reportTotalHours.textContent = minutesToHHMM(totalMinutes);

    const reportTotalDecimal = document.getElementById('reportTotalDecimal');
    if (reportTotalDecimal) reportTotalDecimal.textContent = minutesToDecimal(totalMinutes);

    const reportWorkingDays = document.getElementById('reportWorkingDays');
    if (reportWorkingDays) reportWorkingDays.textContent = totalDays;

    const reportTotalActivities = document.getElementById('reportTotalActivities');
    if (reportTotalActivities) reportTotalActivities.textContent = totalActivities;

    // Aggiorna la lista dei cantieri
    this.updateCantieriList(Array.from(cantieriSet));
  }

  updateCantieriList(cantieri) {
    const cantieriListElement = document.getElementById('reportCantieriList');
    if (!cantieriListElement) return;

    if (cantieri.length === 0) {
      cantieriListElement.innerHTML = `
        <div class="text-center text-muted py-3">
          <i class="bi bi-building me-2"></i>
          Nessun cantiere registrato nel periodo selezionato
        </div>
      `;
      return;
    }

    const cantieriHtml = cantieri.map(cantiere => `
      <div class="d-flex align-items-center mb-2">
        <i class="bi bi-building text-success me-2"></i>
        <span>${cantiere}</span>
      </div>
    `).join('');

    cantieriListElement.innerHTML = `
      <div class="mb-2">
        <strong class="text-primary">
          <i class="bi bi-list-ul me-1"></i>
          Cantieri lavorati (${cantieri.length}):
        </strong>
      </div>
      ${cantieriHtml}
    `;
  }

  /* ----------------------------- Helpers / misc --------------------------- */
  getStatusBadgeColor(stato) {
    const colors = {
      Normale: 'success',
      Riposo: 'secondary',
      Ferie: 'warning',
      Malattia: 'danger',
    };
    return colors[stato] || 'secondary';
  }

  async saveNow() {
    const payload = JSON.parse(JSON.stringify(this.currentDayData));
    const userId = this.currentUser.id;
    const date = this.currentDate;

    await this.saveQueue.save(async () => {
      try {
        await FirestoreService.saveOreLavorative(userId, date, payload);
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

  // Cleanup risorse
  destroy() {
    // Clear timers
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.badgeTimer) {
      clearInterval(this.badgeTimer);
      this.badgeTimer = null;
    }
    
    // Stop badge service
    if (this.badgeService) {
      this.badgeService.stopWatcher();
      this.badgeService = null;
    }
    
    // Clear selected cantieri
    if (this.selectedCantieri) {
      this.selectedCantieri.clear();
    }
    
    // Clean up memory
    MemoryManager.cleanup();
    
    // Reset current data
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