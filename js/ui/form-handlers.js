// Form handling utilities for managing form submissions and validation

import { generateId } from '../utils/utils.js';
import { validateForm } from '../utils/validation-utils.js';
import { RUOLI_DIPENDENTE, ICONE_CATEGORIA } from '../config/constants.js';

export class FormHandlers {
    // Setup employee form
    static setupEmployeeForm(onSubmit) {
        const form = document.getElementById('employeeForm');
        if (!form) return;
        
        // Populate role select
        const roleSelect = document.getElementById('employeeRuolo');
        if (roleSelect) {
            roleSelect.innerHTML = '';
            RUOLI_DIPENDENTE.forEach(ruolo => {
                const option = document.createElement('option');
                option.value = ruolo;
                option.textContent = ruolo;
                roleSelect.appendChild(option);
            });
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getEmployeeFormData();
            const validation = this.validateEmployeeForm(formData);
            
            if (!validation.isValid) {
                this.showFormErrors(validation.errors);
                return;
            }
            
            if (onSubmit) {
                await onSubmit(formData);
            }
        });
    }
    
    // Setup cantiere form
    static setupCantiereForm(onSubmit) {
        const form = document.getElementById('cantiereForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getCantiereFormData();
            const validation = this.validateCantiereForm(formData);
            
            if (!validation.isValid) {
                this.showFormErrors(validation.errors);
                return;
            }
            
            if (onSubmit) {
                await onSubmit(formData);
            }
        });
    }
    
    // Setup categoria form
    static setupCategoriaForm(onSubmit) {
        const form = document.getElementById('categoriaForm');
        if (!form) return;
        
        // Populate icon select
        const iconSelect = document.getElementById('categoriaIcon');
        if (iconSelect) {
            iconSelect.innerHTML = '';
            ICONE_CATEGORIA.forEach(icona => {
                const option = document.createElement('option');
                option.value = icona.value;
                option.textContent = icona.label;
                iconSelect.appendChild(option);
            });
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getCategoriaFormData();
            const validation = this.validateCategoriaForm(formData);
            
            if (!validation.isValid) {
                this.showFormErrors(validation.errors);
                return;
            }
            
            if (onSubmit) {
                await onSubmit(formData);
            }
        });
    }
    
    // Setup activity forms for time entry
    static setupActivityForms(onCantiereSubmit, onPSTSubmit) {
        // Cantiere form is handled by modal selection
        // PST form
        const pstForm = document.getElementById('pstForm');
        if (pstForm && onPSTSubmit) {
            pstForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = this.getPSTFormData();
                const validation = this.validatePSTForm(formData);
                
                if (!validation.isValid) {
                    this.showFormErrors(validation.errors);
                    return;
                }
                
                await onPSTSubmit(formData);
            });
        }
    }
    
    // Get employee form data
    static getEmployeeFormData() {
        return {
            id: document.getElementById('employeeId')?.value || generateId('emp'),
            nome: document.getElementById('employeeName')?.value?.trim() || '',
            cognome: document.getElementById('employeeSurname')?.value?.trim() || '',
            name: `${document.getElementById('employeeName')?.value?.trim() || ''} ${document.getElementById('employeeSurname')?.value?.trim() || ''}`.trim(),
            matricola: document.getElementById('employeeMatricola')?.value?.trim() || '',
            codiceFiscale: document.getElementById('employeeCodiceFiscale')?.value?.trim().toUpperCase() || '',
            dataNascita: document.getElementById('employeeDataNascita')?.value || '',
            luogoNascita: document.getElementById('employeeLuogoNascita')?.value?.trim() || '',
            ruolo: document.getElementById('employeeRuolo')?.value || 'Operaio',
            dataAssunzione: document.getElementById('employeeDataAssunzione')?.value || '',
            telefono: document.getElementById('employeeTelefono')?.value?.trim() || '',
            password: document.getElementById('employeePassword')?.value || 'dipendente123'
        };
    }
    
    // Get cantiere form data
    static getCantiereFormData() {
        return {
            id: document.getElementById('cantiereId')?.value || generateId('cantiere'),
            name: document.getElementById('cantiereName')?.value?.trim() || '',
            minutes: parseInt(document.getElementById('cantiereMinutes')?.value) || 480,
            categoria: document.getElementById('cantiereCategoria')?.value || 'generale',
            descrizione: document.getElementById('cantiereDescrizione')?.value?.trim() || '',
            attivo: document.getElementById('cantiereAttivo')?.checked !== false
        };
    }
    
    // Get categoria form data
    static getCategoriaFormData() {
        return {
            id: document.getElementById('categoriaId')?.value || generateId('cat'),
            name: document.getElementById('categoriaName')?.value?.trim() || '',
            color: document.getElementById('categoriaColor')?.value || '#4285f4',
            icon: document.getElementById('categoriaIcon')?.value || 'bi-building'
        };
    }
    
    // Get PST form data
    static getPSTFormData() {
        return {
            nome: document.getElementById('pstName')?.value?.trim() || '',
            minuti: parseInt(document.getElementById('pstMinutes')?.value) || 480,
            persone: parseInt(document.getElementById('pstPersone')?.value) || 1
        };
    }
    
    // Validate employee form
    static validateEmployeeForm(data) {
        const rules = {
            nome: { required: true, minLength: 2 },
            cognome: { required: true, minLength: 2 },
            password: { required: true, minLength: 3 }
        };
        
        return validateForm(data, rules);
    }
    
    // Validate cantiere form
    static validateCantiereForm(data) {
        const rules = {
            name: { required: true, minLength: 2 },
            minutes: { 
                required: true,
                custom: (value) => {
                    const num = parseInt(value);
                    return (!isNaN(num) && num > 0 && num <= 1440) || 'I minuti devono essere tra 1 e 1440';
                }
            }
        };
        
        return validateForm(data, rules);
    }
    
    // Validate categoria form
    static validateCategoriaForm(data) {
        const rules = {
            name: { required: true, minLength: 2 },
            color: { 
                required: true,
                custom: (value) => /^#[0-9A-Fa-f]{6}$/.test(value) || 'Formato colore non valido'
            },
            icon: { required: true }
        };
        
        return validateForm(data, rules);
    }
    
    // Validate PST form
    static validatePSTForm(data) {
        const rules = {
            nome: { required: true, minLength: 2 },
            minuti: {
                required: true,
                custom: (value) => {
                    const num = parseInt(value);
                    return (!isNaN(num) && num > 0 && num <= 1440) || 'I minuti devono essere tra 1 e 1440';
                }
            },
            persone: {
                required: true,
                custom: (value) => {
                    const num = parseInt(value);
                    return (!isNaN(num) && num >= 1 && num <= 50) || 'Il numero di persone deve essere tra 1 e 50';
                }
            }
        };
        
        return validateForm(data, rules);
    }
    
    // Show form validation errors
    static showFormErrors(errors) {
        // Remove existing error messages
        document.querySelectorAll('.form-error').forEach(el => el.remove());
        
        for (const [field, fieldErrors] of Object.entries(errors)) {
            const input = document.getElementById(`employee${field.charAt(0).toUpperCase() + field.slice(1)}`) ||
                         document.getElementById(`cantiere${field.charAt(0).toUpperCase() + field.slice(1)}`) ||
                         document.getElementById(`categoria${field.charAt(0).toUpperCase() + field.slice(1)}`) ||
                         document.getElementById(`pst${field.charAt(0).toUpperCase() + field.slice(1)}`);
            
            if (input) {
                input.classList.add('is-invalid');
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback form-error';
                errorDiv.textContent = fieldErrors[0];
                
                input.parentNode.appendChild(errorDiv);
            }
        }
    }
    
    // Reset employee form
    static resetEmployeeForm() {
        const form = document.getElementById('employeeForm');
        if (form) {
            form.reset();
            document.getElementById('employeeId').value = '';
            document.getElementById('employeeModalTitle').textContent = 'Aggiungi Dipendente';
            
            // Reset photo preview
            const photoPreview = document.getElementById('photoPreview');
            if (photoPreview) {
                photoPreview.innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
            }
            
            const removePhotoBtn = document.getElementById('removePhotoBtn');
            if (removePhotoBtn) {
                removePhotoBtn.style.display = 'none';
            }
            
            // Clear validation errors
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            form.querySelectorAll('.form-error').forEach(el => el.remove());
        }
    }
    
    // Reset cantiere form
    static resetCantiereForm() {
        const form = document.getElementById('cantiereForm');
        if (form) {
            form.reset();
            document.getElementById('cantiereId').value = '';
            document.getElementById('cantiereModalTitle').textContent = 'Aggiungi Cantiere';
            document.getElementById('cantiereMinutes').value = '480';
            document.getElementById('cantiereAttivo').checked = true;
            
            // Clear validation errors
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            form.querySelectorAll('.form-error').forEach(el => el.remove());
        }
    }
    
    // Reset categoria form
    static resetCategoriaForm() {
        const form = document.getElementById('categoriaForm');
        if (form) {
            form.reset();
            document.getElementById('categoriaId').value = '';
            document.getElementById('categoriaModalTitle').textContent = 'Aggiungi Categoria';
            document.getElementById('categoriaColor').value = '#4285f4';
            document.getElementById('categoriaColorText').value = '#4285f4';
            
            // Clear validation errors
            form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            form.querySelectorAll('.form-error').forEach(el => el.remove());
        }
    }
    
    // Populate employee form with data
    static populateEmployeeForm(employee) {
        if (!employee) return;
        
        document.getElementById('employeeId').value = employee.id || '';
        document.getElementById('employeeName').value = employee.nome || '';
        document.getElementById('employeeSurname').value = employee.cognome || '';
        document.getElementById('employeeMatricola').value = employee.matricola || '';
        document.getElementById('employeeCodiceFiscale').value = employee.codiceFiscale || '';
        document.getElementById('employeeDataNascita').value = employee.dataNascita || '';
        document.getElementById('employeeLuogoNascita').value = employee.luogoNascita || '';
        document.getElementById('employeeRuolo').value = employee.ruolo || 'Operaio';
        document.getElementById('employeeDataAssunzione').value = employee.dataAssunzione || '';
        document.getElementById('employeeTelefono').value = employee.telefono || '';
        document.getElementById('employeePassword').value = employee.password || 'dipendente123';
        
        document.getElementById('employeeModalTitle').textContent = 'Modifica Dipendente';
        
        // Show photo if available
        if (employee.foto) {
            const photoPreview = document.getElementById('photoPreview');
            const photoUrl = `../uploads/employees/${employee.foto}`;
            photoPreview.innerHTML = `<img src="${photoUrl}" alt="Foto dipendente" style="width: 100%; height: 100%; object-fit: cover;">`;
            document.getElementById('removePhotoBtn').style.display = 'inline-block';
        }
    }
    
    // Populate cantiere form with data
    static populateCantiereForm(cantiere) {
        if (!cantiere) return;
        
        document.getElementById('cantiereId').value = cantiere.id || '';
        document.getElementById('cantiereName').value = cantiere.name || '';
        document.getElementById('cantiereMinutes').value = cantiere.minutes || 480;
        document.getElementById('cantiereCategoria').value = cantiere.categoria || 'generale';
        document.getElementById('cantiereDescrizione').value = cantiere.descrizione || '';
        document.getElementById('cantiereAttivo').checked = cantiere.attivo !== false;
        
        document.getElementById('cantiereModalTitle').textContent = 'Modifica Cantiere';
    }
    
    // Populate categoria form with data
    static populateCategoriaForm(categoria) {
        if (!categoria) return;
        
        document.getElementById('categoriaId').value = categoria.id || '';
        document.getElementById('categoriaName').value = categoria.name || '';
        document.getElementById('categoriaColor').value = categoria.color || '#4285f4';
        document.getElementById('categoriaColorText').value = categoria.color || '#4285f4';
        document.getElementById('categoriaIcon').value = categoria.icon || 'bi-building';
        
        document.getElementById('categoriaModalTitle').textContent = 'Modifica Categoria';
    }
}