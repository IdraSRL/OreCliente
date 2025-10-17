// Cantiere selection module for time entry
import { showToast } from '../utils/ui-utils.js';
import { minutesToHHMM } from '../utils/time-utils.js';
import { generateId } from '../utils/utils.js';

export class CantiereSelector {
    constructor(cantiereService, onCantieriSelected) {
        this.cantiereService = cantiereService;
        this.onCantieriSelected = onCantieriSelected;
        this.selectedCantieri = new Set();
        this.currentCategoryFilter = '';
        this.currentSearchTerm = '';
    }

    populateModal() {
        const container = document.getElementById('cantieriContainer');
        if (!container) return;

        this.populateCategoryFilter();
        this.setupFilterListeners();
        this.renderCantieri();
    }

    populateCategoryFilter() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;

        const categorie = this.cantiereService.getAllCategorie();
        const currentValue = categoryFilter.value;

        categoryFilter.innerHTML = '<option value="">Tutte le categorie</option>';

        categorie.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.name;
            categoryFilter.appendChild(option);
        });

        if (currentValue) {
            categoryFilter.value = currentValue;
        }
    }

    setupFilterListeners() {
        const categoryFilter = document.getElementById('categoryFilter');
        const searchInput = document.getElementById('cantiereSearch');

        if (categoryFilter) {
            categoryFilter.removeEventListener('change', this.handleFilterChange);
            categoryFilter.addEventListener('change', (e) => {
                this.currentCategoryFilter = e.target.value;
                this.renderCantieri();
            });
        }

        if (searchInput) {
            searchInput.removeEventListener('input', this.handleSearchChange);
            searchInput.addEventListener('input', (e) => {
                this.currentSearchTerm = e.target.value.toLowerCase().trim();
                this.renderCantieri();
            });
        }
    }

    renderCantieri() {
        const container = document.getElementById('cantieriContainer');
        if (!container) return;

        let cantieriByCategoria = this.cantiereService.getCantieriByCategoria();

        // Apply category filter
        if (this.currentCategoryFilter) {
            cantieriByCategoria = cantieriByCategoria.filter(group =>
                group.categoria.id === this.currentCategoryFilter
            );
        }

        // Apply search filter
        if (this.currentSearchTerm) {
            cantieriByCategoria = cantieriByCategoria.map(group => ({
                ...group,
                cantieri: group.cantieri.filter(cantiere =>
                    cantiere.name.toLowerCase().includes(this.currentSearchTerm) ||
                    (cantiere.descrizione && cantiere.descrizione.toLowerCase().includes(this.currentSearchTerm))
                )
            })).filter(group => group.cantieri.length > 0);
        }

        container.innerHTML = '';

        const totalCantieri = cantieriByCategoria.reduce(
            (total, group) => total + (group.cantieri ? group.cantieri.length : 0),
            0
        );

        if (totalCantieri === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        this.setupToggleAllButton();
        this.renderCategories(container, cantieriByCategoria);
        this.setupEventListeners(container);
        this.restoreSelections();
    }

    restoreSelections() {
        // Restore checkbox states for selected cantieri
        this.selectedCantieri.forEach(cantiereId => {
            const checkbox = document.querySelector(`.cantiere-checkbox[value="${cantiereId}"]`);
            if (checkbox) {
                checkbox.checked = true;
                const card = document.querySelector(`.cantiere-card[data-cantiere-id="${cantiereId}"]`);
                if (card) {
                    card.classList.add('border-primary');
                    card.style.backgroundColor = 'rgba(13, 110, 253, 0.1)';
                }
            }
        });
    }

    getEmptyStateHTML() {
        return `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Nessun cantiere disponibile. Contatta l'amministratore per configurare i cantieri.
            </div>
        `;
    }

    setupToggleAllButton() {
        const toggleBtn = document.getElementById('toggleAllCategories');
        if (toggleBtn) {
            toggleBtn.replaceWith(toggleBtn.cloneNode(true)); // Remove existing listeners
            document.getElementById('toggleAllCategories').addEventListener('click', () => {
                this.toggleAllCategories();
            });
        }
    }

    renderCategories(container, cantieriByCategoria) {
        cantieriByCategoria.forEach(group => {
            if (!group.cantieri || group.cantieri.length === 0) return;

            const categoryElement = this.createCategoryElement(group);
            container.appendChild(categoryElement);
            this.setupCategoryCollapse(categoryElement, group.categoria.id);
        });
    }

    createCategoryElement(group) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-3';
        const categoryId = `category-${group.categoria.id}`;

        categoryDiv.innerHTML = `
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
                        <div class="cantieri-grid">
                            ${this.renderCantieri(group.cantieri)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return categoryDiv;
    }

    renderCantieri(cantieri) {
        return cantieri.map(cantiere => `
            <div class="cantiere-item mb-2">
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
            </div>
        `).join('');
    }

    setupCategoryCollapse(categoryElement, categoryId) {
        const toggleIcon = categoryElement.querySelector('.category-toggle');
        const collapseElement = categoryElement.querySelector('.collapse');

        collapseElement.addEventListener('show.bs.collapse', () => {
            toggleIcon.className = 'bi bi-chevron-up text-muted category-toggle';
        });

        collapseElement.addEventListener('hide.bs.collapse', () => {
            toggleIcon.className = 'bi bi-chevron-down text-muted category-toggle';
        });
    }

    setupEventListeners(container) {
        // Click card to toggle checkbox
        container.querySelectorAll('.cantiere-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('cantiere-checkbox')) return;
                const checkbox = card.querySelector('.cantiere-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleCantiereSelection(checkbox.value, checkbox.checked);
                }
            });
        });

        // Checkbox change events
        container.querySelectorAll('.cantiere-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleCantiereSelection(checkbox.value, checkbox.checked);
            });
        });
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
        }

        this.updateSelectionUI();
    }

    updateSelectionUI() {
        this.updateSelectionCounter();
        this.updateSelectionPreview();
        this.updateAddButton();
    }

    updateSelectionCounter() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = this.selectedCantieri.size;
        }
    }

    updateSelectionPreview() {
        const selectedPreview = document.getElementById('selectedPreview');
        if (!selectedPreview) return;

        if (this.selectedCantieri.size === 0) {
            selectedPreview.textContent = 'Nessun cantiere selezionato';
            return;
        }

        const selectedNames = Array.from(this.selectedCantieri)
            .map(id => {
                const cantiere = this.cantiereService.getCantiereById(id);
                return cantiere ? cantiere.name : id;
            })
            .slice(0, 3);

        let preview = selectedNames.join(', ');
        if (this.selectedCantieri.size > 3) {
            preview += ` e altri ${this.selectedCantieri.size - 3}...`;
        }
        selectedPreview.textContent = preview;
    }

    updateAddButton() {
        const addBtn = document.getElementById('addSelectedCantiereBtn');
        if (!addBtn) return;

        addBtn.disabled = this.selectedCantieri.size === 0;

        if (this.selectedCantieri.size > 0) {
            const persone = parseInt(document.getElementById('cantierePersone')?.value) || 1;
            let totalMinutes = 0;

            this.selectedCantieri.forEach(id => {
                const cantiere = this.cantiereService.getCantiereById(id);
                if (cantiere) {
                    totalMinutes += Math.round(cantiere.minutes / persone);
                }
            });

            const text = this.selectedCantieri.size === 1 ? 'cantiere' : 'cantieri';
            addBtn.innerHTML = `
                <i class="bi bi-plus me-2"></i>
                Aggiungi ${this.selectedCantieri.size} ${text} (${minutesToHHMM(totalMinutes)})
            `;
        } else {
            addBtn.innerHTML = '<i class="bi bi-plus me-2"></i>Aggiungi Cantiere';
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
            collapses.forEach(collapse => {
                const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
                bsCollapse.hide();
            });
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="bi bi-arrows-expand me-1"></i>Espandi tutto';
            }
        } else {
            collapses.forEach(collapse => {
                const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
                bsCollapse.show();
            });
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="bi bi-arrows-collapse me-1"></i>Comprimi tutto';
            }
        }
    }

    addSelectedCantieri() {
        if (this.selectedCantieri.size === 0) {
            showToast('Seleziona almeno un cantiere', 'warning');
            return;
        }

        const persone = parseInt(document.getElementById('cantierePersone')?.value) || 1;
        const activities = [];

        this.selectedCantieri.forEach(id => {
            const cantiere = this.cantiereService.getCantiereById(id);
            if (!cantiere) return;

            const minutiEffettivi = Math.round(cantiere.minutes / persone);
            const categoria = this.cantiereService.getCategoriaById(cantiere.categoria || 'generale') || {
                id: 'generale',
                name: 'Generale'
            };

            const activity = {
                id: generateId('cantiere'),
                cantiereId: cantiere.id,
                nome: cantiere.name,
                categoriaId: categoria.id,
                categoriaName: categoria.name,
                note: cantiere.descrizione || '',
                minuti: cantiere.minutes,
                persone,
                minutiEffettivi,
                tipo: 'cantiere'
            };

            activities.push(activity);
        });

        if (this.onCantieriSelected) {
            this.onCantieriSelected(activities);
        }

        this.resetSelection();
        showToast('Cantieri aggiunti con successo', 'success');
    }

    resetSelection() {
        this.selectedCantieri.clear();

        // Reset UI
        document.querySelectorAll('.cantiere-card').forEach(card => {
            card.classList.remove('border-primary');
            card.style.backgroundColor = '';
        });

        document.querySelectorAll('.cantiere-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        const addBtn = document.getElementById('addSelectedCantiereBtn');
        if (addBtn) addBtn.disabled = true;

        const personeInput = document.getElementById('cantierePersone');
        if (personeInput) personeInput.value = '1';

        // Reset filters
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) categoryFilter.value = '';

        const searchInput = document.getElementById('cantiereSearch');
        if (searchInput) searchInput.value = '';

        this.currentCategoryFilter = '';
        this.currentSearchTerm = '';

        this.updateSelectionUI();
    }
}