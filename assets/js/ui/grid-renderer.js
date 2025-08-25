import { minutesToHHMM } from '../utils/time-utils.js';

export class GridRenderer {
    static renderEmployeesGrid(container, employees, onEdit, onDelete) {
        container.innerHTML = '';

        if (employees.length === 0) {
            container.innerHTML = `
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

        employees.forEach(employee => {
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
            container.appendChild(card);
        });
    }

    static renderCantieriGrid(container, cantieri, categorie = []) {
        container.innerHTML = '';

        if (cantieri.length === 0) {
            container.innerHTML = `
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

        // Crea mappa categorie per lookup veloce
        const categorieMap = {};
        categorie.forEach(cat => {
            categorieMap[cat.id] = cat;
        });

        cantieri.forEach(cantiere => {
            const categoria = categorieMap[cantiere.categoria] || { 
                name: 'Generale', 
                color: '#6c757d', 
                icon: 'bi-building' 
            };
            
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4 mb-4';
            
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="rounded-circle p-2 me-3" style="background-color: ${categoria.color};">
                                <i class="bi ${categoria.icon} text-white"></i>
                            </div>
                            <div>
                                <h6 class="mb-0">${cantiere.name}</h6>
                                <small class="text-muted">${categoria.name}</small>
                            </div>
                        </div>
                        
                        ${cantiere.descrizione ? `
                            <div class="mb-3">
                                <small class="text-muted">${cantiere.descrizione}</small>
                            </div>
                        ` : ''}
                        
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
                        
                        <div class="mb-3">
                            <span class="badge ${cantiere.attivo !== false ? 'bg-success' : 'bg-secondary'}">
                                ${cantiere.attivo !== false ? 'Attivo' : 'Disattivato'}
                            </span>
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
            container.appendChild(card);
        });
    }

    static renderCategorieGrid(container, categorie) {
        container.innerHTML = '';

        if (categorie.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-tags display-1 text-muted mb-3"></i>
                            <h5>Nessuna categoria configurata</h5>
                            <p class="text-muted">Aggiungi la prima categoria per iniziare</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        categorie.forEach(categoria => {
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4 mb-4';
            
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="rounded-circle p-3 me-3" style="background-color: ${categoria.color};">
                                <i class="bi ${categoria.icon} text-white" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h6 class="mb-0">${categoria.name}</h6>
                                <small class="text-muted">Categoria</small>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex align-items-center">
                                <span class="me-2">Colore:</span>
                                <div class="rounded" style="width: 20px; height: 20px; background-color: ${categoria.color}; border: 1px solid var(--border-color);"></div>
                                <code class="ms-2 small">${categoria.color}</code>
                            </div>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="adminService.editCategoria('${categoria.id}')">
                                <i class="bi bi-pencil me-1"></i>Modifica
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="adminService.deleteCategoria('${categoria.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    static populateSelect(selectElement, options, valueKey = 'id', textKey = 'name', placeholder = 'Seleziona...') {
        selectElement.innerHTML = `<option value="">${placeholder}</option>`;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option[valueKey];
            optionElement.textContent = option[textKey];
            selectElement.appendChild(optionElement);
        });
    }

    static populateCantieriSelect(selectElement, cantieri) {
        selectElement.innerHTML = '<option value="">Seleziona un cantiere</option>';
        
        if (cantieri.length === 0) {
            selectElement.innerHTML = '<option value="">Nessun cantiere configurato</option>';
            return;
        }

        cantieri.forEach(cantiere => {
            const option = document.createElement('option');
            option.value = cantiere.id;
            option.textContent = `${cantiere.name} (${minutesToHHMM(cantiere.minutes)})`;
            option.dataset.minutes = cantiere.minutes;
            option.dataset.name = cantiere.name;
            selectElement.appendChild(option);
        });
    }
}