// Grid rendering utilities for displaying data in card grids

export class GridRenderer {
    // Render employees grid
    static renderEmployeesGrid(container, employees) {
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!employees || employees.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-people display-1 text-muted mb-3"></i>
                            <h5 class="text-muted">Nessun dipendente configurato</h5>
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
            
            const photoUrl = employee.foto ? `../uploads/employees/${employee.foto}` : null;
            const initials = this.getInitials(employee.name);
            
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="employee-avatar me-3" style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, var(--custom-accent), var(--custom-success)); display: flex; align-items: center; justify-content: center;">
                                ${photoUrl ? 
                                    `<img src="${photoUrl}" alt="${employee.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                    `<span style="color: white; font-weight: bold; font-size: 18px;">${initials}</span>`
                                }
                            </div>
                            <div class="flex-grow-1">
                                <h5 class="mb-1">${employee.name}</h5>
                                <small class="text-muted">${employee.ruolo || 'Dipendente'}</small>
                                <div class="mt-1">
                                    <span class="badge bg-primary">${employee.matricola || employee.id}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="employee-details mb-3">
                            ${employee.codiceFiscale ? `
                                <div class="mb-1">
                                    <small class="text-muted">C.F.:</small>
                                    <small class="ms-1">${employee.codiceFiscale}</small>
                                </div>
                            ` : ''}
                            ${employee.telefono ? `
                                <div class="mb-1">
                                    <small class="text-muted">Tel:</small>
                                    <small class="ms-1">${employee.telefono}</small>
                                </div>
                            ` : ''}
                            ${employee.dataAssunzione ? `
                                <div class="mb-1">
                                    <small class="text-muted">Assunto:</small>
                                    <small class="ms-1">${new Date(employee.dataAssunzione).toLocaleDateString('it-IT')}</small>
                                </div>
                            ` : ''}
                        </div>
                        
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
    
    // Render cantieri grid
    static renderCantieriGrid(container, cantieri, categorie = []) {
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!cantieri || cantieri.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-building display-1 text-muted mb-3"></i>
                            <h5 class="text-muted">Nessun cantiere configurato</h5>
                            <p class="text-muted">Aggiungi il primo cantiere per iniziare</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        cantieri.forEach(cantiere => {
            const categoria = categorie.find(cat => cat.id === cantiere.categoria) || 
                            { name: 'Nessuna Categoria', color: '#6c757d', icon: 'bi-building' };
            
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4 mb-4';
            
            card.innerHTML = `
                <div class="card h-100 ${cantiere.attivo === false ? 'opacity-75' : ''}">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="cantiere-icon me-3" style="width: 50px; height: 50px; border-radius: 8px; background: ${categoria.color}20; border: 2px solid ${categoria.color}; display: flex; align-items: center; justify-content: center;">
                                <i class="bi ${categoria.icon}" style="color: ${categoria.color}; font-size: 1.5rem;"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h5 class="mb-1">${cantiere.name}</h5>
                                <small class="text-muted">${categoria.name}</small>
                                ${cantiere.attivo === false ? '<span class="badge bg-secondary ms-2">Disattivo</span>' : ''}
                            </div>
                        </div>
                        
                        <div class="cantiere-details mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-muted">Durata standard:</span>
                                <span class="fw-bold">${this.minutesToHHMM(cantiere.minutes)}</span>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="text-muted">Minuti:</span>
                                <span class="badge bg-primary">${cantiere.minutes}</span>
                            </div>
                            ${cantiere.descrizione ? `
                                <div class="mt-2">
                                    <small class="text-muted">${cantiere.descrizione}</small>
                                </div>
                            ` : ''}
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
    
    // Render categorie grid
    static renderCategorieGrid(container, categorie) {
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!categorie || categorie.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-tags display-1 text-muted mb-3"></i>
                            <h5 class="text-muted">Nessuna categoria configurata</h5>
                            <p class="text-muted">Aggiungi la prima categoria per organizzare i cantieri</p>
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
                <div class="card h-100" style="border-left: 4px solid ${categoria.color};">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="categoria-icon me-3" style="width: 50px; height: 50px; border-radius: 8px; background: ${categoria.color}20; border: 2px solid ${categoria.color}; display: flex; align-items: center; justify-content: center;">
                                <i class="bi ${categoria.icon}" style="color: ${categoria.color}; font-size: 1.5rem;"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h5 class="mb-1">${categoria.name}</h5>
                                <small class="text-muted">ID: ${categoria.id}</small>
                            </div>
                        </div>
                        
                        <div class="categoria-details mb-3">
                            <div class="d-flex align-items-center mb-2">
                                <span class="text-muted me-2">Colore:</span>
                                <div class="color-preview" style="width: 20px; height: 20px; border-radius: 4px; background: ${categoria.color}; border: 1px solid var(--border-color);"></div>
                                <code class="ms-2 small">${categoria.color}</code>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="text-muted me-2">Icona:</span>
                                <i class="bi ${categoria.icon} me-2"></i>
                                <code class="small">${categoria.icon}</code>
                            </div>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="adminService.editCategoria('${categoria.id}')">
                                <i class="bi bi-pencil me-1"></i>Modifica
                            </button>
                            ${categoria.id !== 'generale' ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="adminService.deleteCategoria('${categoria.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
    
    // Populate select element with options
    static populateSelect(selectElement, items, valueField, textField, defaultOption = null) {
        if (!selectElement) return;
        
        selectElement.innerHTML = '';
        
        if (defaultOption) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = defaultOption;
            selectElement.appendChild(option);
        }
        
        if (items && items.length > 0) {
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item[valueField];
                option.textContent = item[textField];
                selectElement.appendChild(option);
            });
        }
    }
    
    // Helper method to get initials from name
    static getInitials(name) {
        if (!name) return 'ND';
        
        const names = name.trim().split(' ');
        if (names.length === 1) {
            return names[0].substring(0, 2).toUpperCase();
        }
        
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    
    // Helper method to convert minutes to HH:MM
    static minutesToHHMM(minutes) {
        if (!minutes || minutes < 0) return "00:00";
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
}