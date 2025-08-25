import { showToast } from '../utils/ui-utils.js';
import { ButtonUtils } from './button-utils.js';
import { sanitizeString, validateMinutes, validatePersone } from '../utils/validation-utils.js';
import { RUOLI_DIPENDENTE, ICONE_CATEGORIA } from '../config/constants.js';

export class FormHandlers {
    static setupEmployeeForm(onSubmit) {
        const form = document.getElementById('employeeForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getEmployeeFormData();
            const errors = this.validateEmployeeForm(formData);
            
            if (errors.length > 0) {
                showToast(errors.join(', '), 'warning');
                return;
            }

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.showLoading(submitBtn, 'Salvataggio...');
                
                await onSubmit(formData);
                
                ButtonUtils.setButtonState(submitBtn, 'success', 'Salvato!');
            } catch (error) {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.setButtonState(submitBtn, 'error', 'Errore');
                showToast('Errore durante il salvataggio', 'error');
            }
        });
    }

    static setupCantiereForm(onSubmit) {
        const form = document.getElementById('cantiereForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getCantiereFormData();
            const errors = this.validateCantiereForm(formData);
            
            if (errors.length > 0) {
                showToast(errors.join(', '), 'warning');
                return;
            }

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.showLoading(submitBtn, 'Salvataggio...');
                
                await onSubmit(formData);
                
                ButtonUtils.setButtonState(submitBtn, 'success', 'Salvato!');
            } catch (error) {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.setButtonState(submitBtn, 'error', 'Errore');
                showToast('Errore durante il salvataggio', 'error');
            }
        });
    }

    static setupCategoriaForm(onSubmit) {
        const form = document.getElementById('categoriaForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.getCategoriaFormData();
            const errors = this.validateCategoriaForm(formData);
            
            if (errors.length > 0) {
                showToast(errors.join(', '), 'warning');
                return;
            }

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.showLoading(submitBtn, 'Salvataggio...');
                
                await onSubmit(formData);
                
                ButtonUtils.setButtonState(submitBtn, 'success', 'Salvato!');
            } catch (error) {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                ButtonUtils.setButtonState(submitBtn, 'error', 'Errore');
                showToast('Errore durante il salvataggio', 'error');
            }
        });
    }

    static setupActivityForms(onCantiereSubmit, onPSTSubmit) {
        // Pulsante aggiungi cantiere selezionato
        const addCantiereBtn = document.getElementById('addSelectedCantiereBtn');
        if (addCantiereBtn) {
            addCantiereBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await onCantiereSubmit();
                } catch (error) {
                    showToast('Errore aggiunta cantiere', 'error');
                }
            });
        }

        // Form PST
        const pstForm = document.getElementById('pstForm');
        if (pstForm) {
            pstForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
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

                try {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    ButtonUtils.showLoading(submitBtn, 'Aggiunta...');
                    
                    const btn = document.getElementById('addSelectedCantiereBtn');
                    ButtonUtils.showLoading(btn, 'Aggiunta...');
                    
                    await onPSTSubmit({ nome, minuti, persone });
                    
                    ButtonUtils.setButtonState(submitBtn, 'success', 'Aggiunto!');
                    
                    ButtonUtils.setButtonState(btn, 'success', 'Aggiunto!');
                } catch (error) {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    ButtonUtils.setButtonState(submitBtn, 'error', 'Errore');
                    const btn = document.getElementById('addSelectedCantiereBtn');
                    ButtonUtils.setButtonState(btn, 'error', 'Errore');
                    showToast('Errore aggiunta attività', 'error');
                }
            });
        }
    }

    static getEmployeeFormData() {
        return {
            id: document.getElementById('employeeId').value,
            nome: sanitizeString(document.getElementById('employeeName').value),
            cognome: sanitizeString(document.getElementById('employeeSurname').value),
            matricola: sanitizeString(document.getElementById('employeeMatricola').value),
            codiceFiscale: sanitizeString(document.getElementById('employeeCodiceFiscale').value),
            dataNascita: document.getElementById('employeeDataNascita').value,
            luogoNascita: sanitizeString(document.getElementById('employeeLuogoNascita').value),
            ruolo: document.getElementById('employeeRuolo').value,
            dataAssunzione: document.getElementById('employeeDataAssunzione').value,
            telefono: sanitizeString(document.getElementById('employeeTelefono').value),
            password: document.getElementById('employeePassword').value
        };
    }

    static getCantiereFormData() {
        return {
            id: document.getElementById('cantiereId').value,
            name: sanitizeString(document.getElementById('cantiereName').value),
            minutes: parseInt(document.getElementById('cantiereMinutes').value),
            categoria: document.getElementById('cantiereCategoria').value,
            descrizione: sanitizeString(document.getElementById('cantiereDescrizione').value),
            attivo: document.getElementById('cantiereAttivo').checked
        };
    }

    static getCategoriaFormData() {
        return {
            id: document.getElementById('categoriaId').value,
            name: sanitizeString(document.getElementById('categoriaName').value),
            color: document.getElementById('categoriaColor').value,
            icon: document.getElementById('categoriaIcon').value
        };
    }

    static validateEmployeeForm(data) {
        const errors = [];

        if (!data.nome) errors.push('Nome obbligatorio');
        if (!data.cognome) errors.push('Cognome obbligatorio');
        if (!data.password) errors.push('Password obbligatoria');
        if (data.password && data.password.length < 3) {
            errors.push('Password deve essere di almeno 3 caratteri');
        }
        if (data.codiceFiscale && data.codiceFiscale.length !== 16) {
            errors.push('Codice fiscale non valido');
        }

        return errors;
    }

    static validateCantiereForm(data) {
        const errors = [];

        if (!data.name) errors.push('Nome cantiere obbligatorio');
        if (!validateMinutes(data.minutes)) errors.push('Minuti non validi');

        return errors;
    }

    static validateCategoriaForm(data) {
        const errors = [];

        if (!data.name) errors.push('Nome categoria obbligatorio');
        if (!data.color) errors.push('Colore obbligatorio');
        if (!data.icon) errors.push('Icona obbligatoria');

        return errors;
    }

    static resetEmployeeForm() {
        const form = document.getElementById('employeeForm');
        if (form) {
            form.reset();
            document.getElementById('employeeId').value = '';
            document.getElementById('employeeModalTitle').textContent = 'Aggiungi Dipendente';
            document.getElementById('saveEmployeeBtn').textContent = 'Salva';
            document.getElementById('employeeRuolo').value = 'Operaio';
            
            // Reset photo preview
            const preview = document.getElementById('photoPreview');
            if (preview) {
                preview.innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
            }
            
            const removeBtn = document.getElementById('removePhotoBtn');
            if (removeBtn) {
                removeBtn.style.display = 'none';
            }
        }
    }

    static resetCantiereForm() {
        const form = document.getElementById('cantiereForm');
        if (form) {
            form.reset();
            document.getElementById('cantiereId').value = '';
            document.getElementById('cantiereModalTitle').textContent = 'Aggiungi Cantiere';
            document.getElementById('saveCantiereBtn').textContent = 'Salva';
            document.getElementById('cantiereMinutes').value = '480';
            document.getElementById('cantiereAttivo').checked = true;
        }
    }

    static resetCategoriaForm() {
        const form = document.getElementById('categoriaForm');
        if (form) {
            form.reset();
            document.getElementById('categoriaId').value = '';
            document.getElementById('categoriaModalTitle').textContent = 'Aggiungi Categoria';
            document.getElementById('saveCategoriaBtn').textContent = 'Salva';
            document.getElementById('categoriaColor').value = '#4285f4';
            document.getElementById('categoriaIcon').value = 'bi-building';
        }
    }

    static populateEmployeeForm(employee) {
        if (!employee) return;

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
        const preview = document.getElementById('photoPreview');
        const removeBtn = document.getElementById('removePhotoBtn');
        
        if (employee.foto && preview) {
            const photoUrl = `../uploads/employees/${employee.foto}`;
            preview.innerHTML = 
                `<img src="${photoUrl}" alt="Foto dipendente" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`;
            if (removeBtn) removeBtn.style.display = 'inline-block';
        } else if (preview) {
            preview.innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
            if (removeBtn) removeBtn.style.display = 'none';
        }

        // Aggiorna titoli
        document.getElementById('employeeModalTitle').textContent = 'Modifica Dipendente';
        const saveBtn = document.getElementById('saveEmployeeBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-pencil me-2"></i>Aggiorna';
        }
    }

    static populateCantiereForm(cantiere) {
        if (!cantiere) return;

        document.getElementById('cantiereId').value = cantiere.id;
        document.getElementById('cantiereName').value = cantiere.name;
        document.getElementById('cantiereMinutes').value = cantiere.minutes;
        document.getElementById('cantiereCategoria').value = cantiere.categoria || 'generale';
        document.getElementById('cantiereDescrizione').value = cantiere.descrizione || '';
        document.getElementById('cantiereAttivo').checked = cantiere.attivo !== false;

        document.getElementById('cantiereModalTitle').textContent = 'Modifica Cantiere';
        const saveBtn = document.getElementById('saveCantiereBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-pencil me-2"></i>Aggiorna';
        }
    }

    static populateCategoriaForm(categoria) {
        if (!categoria) return;

        document.getElementById('categoriaId').value = categoria.id;
        document.getElementById('categoriaName').value = categoria.name;
        document.getElementById('categoriaColor').value = categoria.color;
        document.getElementById('categoriaIcon').value = categoria.icon;

        document.getElementById('categoriaModalTitle').textContent = 'Modifica Categoria';
        const saveBtn = document.getElementById('saveCategoriaBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-pencil me-2"></i>Aggiorna';
        }
    }
    
    static populateRuoliSelect(selectElement) {
        selectElement.innerHTML = '';
        RUOLI_DIPENDENTE.forEach(ruolo => {
            const option = document.createElement('option');
            option.value = ruolo;
            option.textContent = ruolo;
            selectElement.appendChild(option);
        });
    }
    
    static populateIconeSelect(selectElement) {
        selectElement.innerHTML = '';
        ICONE_CATEGORIA.forEach(icona => {
            const option = document.createElement('option');
            option.value = icona.value;
            option.textContent = icona.label;
            selectElement.appendChild(option);
        });
    }
}