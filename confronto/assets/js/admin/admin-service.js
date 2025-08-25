import { AuthService } from '../auth/auth.js';
import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    showToast, 
    showLoading, 
    hideLoading,
    showGlobalLoading,
    minutesToHHMM, 
    minutesToDecimal,
    formatDate,
    getMonthRange,
    generateId,
    sanitizeString,
    validateMinutes,
    validatePersone,
    debounce
} from '../utils/utils.js';

class AdminService {
    constructor() {
        this.currentUser = null;
        this.employees = [];
        this.cantieri = [];
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
                }
            });
        });

        // Filtri riepilogo
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        // Toggle vista
        document.getElementById('viewToggle').addEventListener('change', (e) => {
            this.viewMode = e.target.checked ? 'hierarchical' : 'flat';
            this.applyFilters();
        });

        // Export Excel
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Forms
        document.getElementById('employeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEmployee();
        });

        document.getElementById('cantiereForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCantiere();
        });

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

    async loadInitialData() {
        try {
            showGlobalLoading(true);
            
            // Carica dipendenti e cantieri
            [this.employees, this.cantieri] = await Promise.all([
                FirestoreService.getEmployees(),
                FirestoreService.getCantieri()
            ]);

        } catch (error) {
            console.error('Errore caricamento dati iniziali:', error);
            showToast('Errore caricamento dati iniziali', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    populateFilters() {
        // Popola select dipendenti
        const employeeSelect = document.getElementById('filterEmployee');
        employeeSelect.innerHTML = '<option value="">Tutti i dipendenti</option>';
        
        this.employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.id;
            option.textContent = employee.name;
            employeeSelect.appendChild(option);
        });

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
                const employee = this.employees.find(emp => emp.id === this.currentFilter.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    riepilogoData = [{ dipendente: employee, ore: ore }];
                }
            } else {
                // Carica dati per tutti i dipendenti
                riepilogoData = await FirestoreService.getRiepilogoCompleto(start, end);
            }

            this.updateRiepilogoTable(riepilogoData);
            this.updateStats(riepilogoData);

        } catch (error) {
            console.error('Errore caricamento riepilogo:', error);
            showToast('Errore caricamento dati', 'error');
        } finally {
            showGlobalLoading(false);
        }
    }

    updateRiepilogoTable(data) {
        const tbody = document.querySelector('#riepilogoTable tbody');
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

        if (this.viewMode === 'hierarchical') {
            this.renderHierarchicalView(tbody, data);
        } else {
            this.renderFlatView(tbody, data);
        }
    }

    renderHierarchicalView(tbody, data) {
        data.forEach(employeeData => {
            const { dipendente, ore } = employeeData;
            
            // Calcola totali dipendente
            let totalMinutes = 0;
            let totalDays = 0;
            let totalActivities = 0;

            ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    totalDays++;
                    totalActivities += day.attivita.length;
                    day.attivita.forEach(activity => {
                        totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
                    });
                }
            });

            // Riga dipendente (header)
            const employeeRow = document.createElement('tr');
            employeeRow.className = 'table-primary employee-row';
            employeeRow.dataset.employeeId = dipendente.id;
            employeeRow.innerHTML = `
                <td>
                    <i class="bi bi-chevron-down employee-toggle me-2"></i>
                    <strong><i class="bi bi-person-fill me-2"></i>${dipendente.name}</strong>
                </td>
                <td><strong>${totalDays} giorni</strong></td>
                <td><strong>${totalMinutes} min</strong></td>
                <td><strong>${minutesToHHMM(totalMinutes)}</strong></td>
                <td><strong>${minutesToDecimal(totalMinutes)}</strong></td>
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
                                    <span class="badge bg-${activity.tipo === 'cantiere' ? 'success' : activity.tipo === 'pst' ? 'info' : 'warning'} me-2">
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

        // Setup toggle functionality
        this.setupEmployeeToggle();
    }

    renderFlatView(tbody, data) {
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
                                    <span class="badge bg-${activity.tipo === 'cantiere' ? 'success' : activity.tipo === 'pst' ? 'info' : 'warning'} me-1">
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

    setupEmployeeToggle() {
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

    updateStats(data) {
        let totalMinutes = 0;
        let totalDays = 0;
        let totalActivities = 0;

        data.forEach(employeeData => {
            employeeData.ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    totalDays++;
                    totalActivities += day.attivita.length;
                    day.attivita.forEach(activity => {
                        totalMinutes += activity.minutiEffettivi || activity.minuti || 0;
                    });
                }
            });
        });

        document.getElementById('totalHours').textContent = minutesToHHMM(totalMinutes);
        document.getElementById('totalDecimal').textContent = minutesToDecimal(totalMinutes);
        document.getElementById('workingDays').textContent = totalDays;
        document.getElementById('totalActivities').textContent = totalActivities;
    }

    // === GESTIONE DIPENDENTI ===
    async loadEmployeesGrid() {
        const grid = document.getElementById('employeesGrid');
        grid.innerHTML = '';

        if (this.employees.length === 0) {
            grid.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-people display-1 text-muted mb-3"></i>
                            <h5>Nessun dipendente configurato</h5>
                            <p class="text-muted">Aggiungi il primo dipendente per iniziare</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        this.employees.forEach(employee => {
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4 mb-4';
            
            // Costruisci URL foto
            const photoUrl = employee.foto ? `../uploads/employees/${employee.foto}` : null;
            const photoHtml = photoUrl ? 
                `<img src="${photoUrl}" alt="Foto ${employee.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` :
                `<div style="width: 60px; height: 60px; background: var(--custom-light); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-person-fill text-muted" style="font-size: 24px;"></i>
                </div>`;

            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            ${photoHtml}
                            <div class="ms-3 flex-grow-1">
                                <h6 class="mb-1">${employee.name}</h6>
                                <small class="text-muted">
                                    <i class="bi bi-person-badge me-1"></i>
                                    ${employee.matricola || employee.id}
                                </small>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="row g-2 small">
                                <div class="col-6">
                                    <strong>Ruolo:</strong><br>
                                    <span class="text-muted">${employee.ruolo || 'Non specificato'}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Telefono:</strong><br>
                                    <span class="text-muted">${employee.telefono || 'Non specificato'}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${employee.codiceFiscale ? `
                            <div class="mb-3">
                                <small class="text-muted">
                                    <i class="bi bi-credit-card me-1"></i>
                                    CF: ${employee.codiceFiscale}
                                </small>
                            </div>
                        ` : ''}
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="adminService.editEmployee('${employee.id}')">
                                <i class="bi bi-pencil me-1"></i>Modifica
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="adminService.deleteEmployee('${employee.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    resetEmployeeForm() {
        document.getElementById('employeeForm').reset();
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeModalTitle').textContent = 'Aggiungi Dipendente';
        document.getElementById('saveEmployeeBtn').textContent = 'Salva';
        
        // Reset photo preview
        document.getElementById('photoPreview').innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
        document.getElementById('removePhotoBtn').style.display = 'none';
        
        // Reset form values
        document.getElementById('employeeRuolo').value = 'Operaio';
    }

    editEmployee(employeeId) {
        const employee = this.employees.find(emp => emp.id === employeeId);
        if (!employee) return;

        // Popola form
        document.getElementById('employeeId').value = employee.id;
        document.getElementById('employeeName').value = employee.nome || employee.name.split(' ')[0] || '';
        document.getElementById('employeeSurname').value = employee.cognome || employee.name.split(' ').slice(1).join(' ') || '';
        document.getElementById('employeeMatricola').value = employee.matricola || '';
        document.getElementById('employeeCodiceFiscale').value = employee.codiceFiscale || '';
        document.getElementById('employeeDataNascita').value = employee.dataNascita || '';
        document.getElementById('employeeLuogoNascita').value = employee.luogoNascita || '';
        document.getElementById('employeeRuolo').value = employee.ruolo || 'Operaio';
        document.getElementById('employeeDataAssunzione').value = employee.dataAssunzione || '';
        document.getElementById('employeeTelefono').value = employee.telefono || '';
        document.getElementById('employeePassword').value = employee.password || '';

        // Mostra foto se presente
        if (employee.foto) {
            const photoUrl = `../uploads/employees/${employee.foto}`;
            document.getElementById('photoPreview').innerHTML = 
                `<img src="${photoUrl}" alt="Foto dipendente" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`;
            document.getElementById('removePhotoBtn').style.display = 'inline-block';
        } else {
            document.getElementById('photoPreview').innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
            document.getElementById('removePhotoBtn').style.display = 'none';
        }

        // Aggiorna titoli
        document.getElementById('employeeModalTitle').textContent = 'Modifica Dipendente';
        document.getElementById('saveEmployeeBtn').textContent = 'Aggiorna';

        // Mostra modal
        new bootstrap.Modal(document.getElementById('employeeModal')).show();
    }

    async saveEmployee() {
        const employeeId = document.getElementById('employeeId').value;
        const nome = sanitizeString(document.getElementById('employeeName').value);
        const cognome = sanitizeString(document.getElementById('employeeSurname').value);
        const matricola = sanitizeString(document.getElementById('employeeMatricola').value);
        const codiceFiscale = sanitizeString(document.getElementById('employeeCodiceFiscale').value);
        const dataNascita = document.getElementById('employeeDataNascita').value;
        const luogoNascita = sanitizeString(document.getElementById('employeeLuogoNascita').value);
        const ruolo = document.getElementById('employeeRuolo').value;
        const dataAssunzione = document.getElementById('employeeDataAssunzione').value;
        const telefono = sanitizeString(document.getElementById('employeeTelefono').value);
        const password = document.getElementById('employeePassword').value;

        if (!nome || !cognome || !password) {
            showToast('Compila tutti i campi obbligatori', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('saveEmployeeBtn');
            showLoading(btn, 'Salvataggio...');

            const fullName = `${nome} ${cognome}`.trim();
            const finalMatricola = matricola || `EMP${Date.now().toString().slice(-6)}`;
            const finalId = employeeId || generateId('emp');

            // Upload foto se presente
            let fotoFileName = null;
            const photoFile = document.getElementById('employeePhoto').files[0];
            if (photoFile) {
                fotoFileName = await this.uploadPhoto(finalId, photoFile);
            } else if (employeeId) {
                // Mantieni foto esistente
                const existingEmployee = this.employees.find(emp => emp.id === employeeId);
                fotoFileName = existingEmployee?.foto || null;
            }

            const employeeData = {
                id: finalId,
                name: fullName,
                nome: nome,
                cognome: cognome,
                matricola: finalMatricola,
                codiceFiscale: codiceFiscale,
                dataNascita: dataNascita,
                luogoNascita: luogoNascita,
                ruolo: ruolo,
                dataAssunzione: dataAssunzione,
                telefono: telefono,
                password: password,
                foto: fotoFileName
            };

            if (employeeId) {
                // Modifica esistente
                const index = this.employees.findIndex(emp => emp.id === employeeId);
                if (index !== -1) {
                    this.employees[index] = employeeData;
                }
            } else {
                // Nuovo dipendente
                this.employees.push(employeeData);
            }

            await FirestoreService.saveEmployees(this.employees);

            bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
            this.loadEmployeesGrid();
            this.populateFilters(); // Aggiorna filtri

            showToast(employeeId ? 'Dipendente aggiornato con successo' : 'Dipendente aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore salvataggio dipendente:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            hideLoading(document.getElementById('saveEmployeeBtn'), employeeId ? 'Aggiorna' : 'Salva');
        }
    }

    async deleteEmployee(employeeId) {
        const employee = this.employees.find(emp => emp.id === employeeId);
        if (!employee) return;

        if (!confirm(`Eliminare il dipendente "${employee.name}"?\n\nATTENZIONE: Tutti i dati delle ore lavorative verranno persi!`)) {
            return;
        }

        try {
            showGlobalLoading(true);

            // Rimuovi foto se presente
            if (employee.foto) {
                await this.deletePhoto(employeeId);
            }

            // Rimuovi da array
            this.employees = this.employees.filter(emp => emp.id !== employeeId);
            
            // Salva su Firestore
            await FirestoreService.saveEmployees(this.employees);
            
            // Elimina dati ore (nota: in Firestore dovremmo eliminare la collezione)
            await FirestoreService.deleteEmployeeData(employeeId);

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

        // Validazione file
        if (!file.type.startsWith('image/')) {
            showToast('Seleziona un file immagine valido', 'warning');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB
            showToast('File troppo grande. Massimo 2MB', 'warning');
            return;
        }

        // Mostra anteprima
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photoPreview').innerHTML = 
                `<img src="${e.target.result}" alt="Anteprima foto" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`;
            document.getElementById('removePhotoBtn').style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }

    async uploadPhoto(employeeId, file) {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('employeeId', employeeId);

        const response = await fetch('../upload_photo.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore upload foto');
        }

        return result.fileName;
    }

    async removePhoto() {
        const employeeId = document.getElementById('employeeId').value;
        
        if (employeeId) {
            try {
                await this.deletePhoto(employeeId);
            } catch (error) {
                console.error('Errore rimozione foto:', error);
            }
        }

        // Reset preview
        document.getElementById('photoPreview').innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
        document.getElementById('employeePhoto').value = '';
        document.getElementById('removePhotoBtn').style.display = 'none';
    }

    async deletePhoto(employeeId) {
        const response = await fetch('../delete_photo.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ employeeId })
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore eliminazione foto');
        }
    }

    // === GESTIONE CANTIERI ===
    async loadCantieriGrid() {
        const grid = document.getElementById('cantieriGrid');
        grid.innerHTML = '';

        if (this.cantieri.length === 0) {
            grid.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-building display-1 text-muted mb-3"></i>
                            <h5>Nessun cantiere configurato</h5>
                            <p class="text-muted">Aggiungi il primo cantiere per iniziare</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        this.cantieri.forEach(cantiere => {
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4 mb-4';
            
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="bg-success rounded-circle p-2 me-3">
                                <i class="bi bi-building text-white"></i>
                            </div>
                            <div>
                                <h6 class="mb-0">${cantiere.name}</h6>
                                <small class="text-muted">Cantiere</small>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="row g-2">
                                <div class="col-6">
                                    <strong>Minuti Standard:</strong><br>
                                    <span class="text-primary">${cantiere.minutes}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Ore Standard:</strong><br>
                                    <span class="text-success">${minutesToHHMM(cantiere.minutes)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="adminService.editCantiere('${cantiere.id}')">
                                <i class="bi bi-pencil me-1"></i>Modifica
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="adminService.deleteCantiere('${cantiere.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    resetCantiereForm() {
        document.getElementById('cantiereForm').reset();
        document.getElementById('cantiereId').value = '';
        document.getElementById('cantiereModalTitle').textContent = 'Aggiungi Cantiere';
        document.getElementById('saveCantiereBtn').textContent = 'Salva';
        document.getElementById('cantiereMinutes').value = '480';
    }

    editCantiere(cantiereId) {
        const cantiere = this.cantieri.find(c => c.id === cantiereId);
        if (!cantiere) return;

        document.getElementById('cantiereId').value = cantiere.id;
        document.getElementById('cantiereName').value = cantiere.name;
        document.getElementById('cantiereMinutes').value = cantiere.minutes;

        document.getElementById('cantiereModalTitle').textContent = 'Modifica Cantiere';
        document.getElementById('saveCantiereBtn').textContent = 'Aggiorna';

        new bootstrap.Modal(document.getElementById('cantiereModal')).show();
    }

    async saveCantiere() {
        const cantiereId = document.getElementById('cantiereId').value;
        const name = sanitizeString(document.getElementById('cantiereName').value);
        const minutes = parseInt(document.getElementById('cantiereMinutes').value);

        if (!name) {
            showToast('Inserisci il nome del cantiere', 'warning');
            return;
        }

        if (!validateMinutes(minutes)) {
            showToast('Minuti non validi', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('saveCantiereBtn');
            showLoading(btn, 'Salvataggio...');

            const cantiereData = {
                id: cantiereId || generateId('cantiere'),
                name: name,
                minutes: minutes
            };

            if (cantiereId) {
                const index = this.cantieri.findIndex(c => c.id === cantiereId);
                if (index !== -1) {
                    this.cantieri[index] = cantiereData;
                }
            } else {
                this.cantieri.push(cantiereData);
            }

            await FirestoreService.saveCantieri(this.cantieri);

            bootstrap.Modal.getInstance(document.getElementById('cantiereModal')).hide();
            this.loadCantieriGrid();

            showToast(cantiereId ? 'Cantiere aggiornato con successo' : 'Cantiere aggiunto con successo', 'success');

        } catch (error) {
            console.error('Errore salvataggio cantiere:', error);
            showToast('Errore durante il salvataggio', 'error');
        } finally {
            hideLoading(document.getElementById('saveCantiereBtn'), cantiereId ? 'Aggiorna' : 'Salva');
        }
    }

    async deleteCantiere(cantiereId) {
        const cantiere = this.cantieri.find(c => c.id === cantiereId);
        if (!cantiere) return;

        if (!confirm(`Eliminare il cantiere "${cantiere.name}"?`)) {
            return;
        }

        try {
            this.cantieri = this.cantieri.filter(c => c.id !== cantiereId);
            await FirestoreService.saveCantieri(this.cantieri);
            
            this.loadCantieriGrid();
            showToast('Cantiere eliminato con successo', 'success');

        } catch (error) {
            console.error('Errore eliminazione cantiere:', error);
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

        if (newPassword.length < 6) {
            showToast('La password deve essere di almeno 6 caratteri', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('changePasswordBtn');
            showLoading(btn, 'Aggiornamento...');

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
            hideLoading(document.getElementById('changePasswordBtn'), '<i class="bi bi-key me-2"></i>Cambia Password');
        }
    }

    async exportToExcel() {
        try {
            showToast('Preparazione export in corso...', 'info');
            
            // Implementazione export Excel usando ExcelJS
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Riepilogo Ore');

            // Headers
            worksheet.columns = [
                { header: 'Dipendente', key: 'dipendente', width: 20 },
                { header: 'Data', key: 'data', width: 15 },
                { header: 'Stato', key: 'stato', width: 12 },
                { header: 'Tipo Attività', key: 'tipo', width: 15 },
                { header: 'Nome Attività', key: 'nome', width: 30 },
                { header: 'Minuti', key: 'minuti', width: 10 },
                { header: 'Persone', key: 'persone', width: 10 },
                { header: 'Min. Effettivi', key: 'minutiEffettivi', width: 12 },
                { header: 'Ore HH:MM', key: 'oreHHMM', width: 12 },
                { header: 'Ore Decimali', key: 'oreDecimali', width: 12 }
            ];

            // Carica dati per export
            const { start, end } = getMonthRange(this.currentFilter.year, this.currentFilter.month);
            let exportData;

            if (this.currentFilter.employee) {
                const employee = this.employees.find(emp => emp.id === this.currentFilter.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    exportData = [{ dipendente: employee, ore: ore }];
                }
            } else {
                exportData = await FirestoreService.getRiepilogoCompleto(start, end);
            }

            // Popola dati
            exportData.forEach(employeeData => {
                const { dipendente, ore } = employeeData;
                
                ore.forEach(day => {
                    if (day.attivita && day.attivita.length > 0) {
                        day.attivita.forEach(activity => {
                            const minutiEffettivi = activity.minutiEffettivi || activity.minuti || 0;
                            worksheet.addRow({
                                dipendente: dipendente.name,
                                data: formatDate(day.data),
                                stato: day.stato,
                                tipo: activity.tipo,
                                nome: activity.nome,
                                minuti: activity.minuti || 0,
                                persone: activity.persone || 1,
                                minutiEffettivi: minutiEffettivi,
                                oreHHMM: minutesToHHMM(minutiEffettivi),
                                oreDecimali: minutesToDecimal(minutiEffettivi)
                            });
                        });
                    }
                });
            });

            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4285F4' }
            };

            // Generate file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `riepilogo_ore_${this.currentFilter.year}_${this.currentFilter.month.toString().padStart(2, '0')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showToast('Export completato con successo', 'success');

        } catch (error) {
            console.error('Errore export Excel:', error);
            showToast('Errore durante l\'export', 'error');
        }
    }

    // Funzioni per modifica attività (placeholder)
    editEmployeeActivities(employeeId) {
        showToast('Funzionalità in sviluppo', 'info');
    }

    viewDayDetails(employeeId, date) {
        showToast('Funzionalità in sviluppo', 'info');
    }
}

// Inizializza il servizio admin
const adminService = new AdminService();

// Esponi globalmente per gli onclick
window.adminService = adminService;