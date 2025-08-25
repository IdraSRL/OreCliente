import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    generateId
} from '../utils/utils.js';
import { sanitizeString } from '../utils/validation-utils.js';

export class EmployeeService {
    constructor() {
        this.employees = [];
    }

    async loadEmployees() {
        try {
            this.employees = await FirestoreService.getEmployees();
            return this.employees;
        } catch (error) {
            console.error('Errore caricamento dipendenti:', error);
            throw error;
        }
    }

    async saveEmployee(employeeData) {
        try {
            const finalId = employeeData.id || generateId('emp');
            const finalMatricola = employeeData.matricola || `EMP${Date.now().toString().slice(-6)}`;

            const employee = {
                ...employeeData,
                id: finalId,
                matricola: finalMatricola,
                name: `${employeeData.nome} ${employeeData.cognome}`.trim()
            };

            if (employeeData.id) {
                // Modifica esistente
                const index = this.employees.findIndex(emp => emp.id === employeeData.id);
                if (index !== -1) {
                    this.employees[index] = employee;
                }
            } else {
                // Nuovo dipendente
                this.employees.push(employee);
            }

            await FirestoreService.saveEmployees(this.employees);
            return employee;
        } catch (error) {
            console.error('Errore salvataggio dipendente:', error);
            throw error;
        }
    }

    async deleteEmployee(employeeId) {
        try {
            const employee = this.employees.find(emp => emp.id === employeeId);
            if (!employee) {
                throw new Error('Dipendente non trovato');
            }

            // Rimuovi da array
            this.employees = this.employees.filter(emp => emp.id !== employeeId);
            
            // Salva su Firestore
            await FirestoreService.saveEmployees(this.employees);
            
            // Elimina dati ore
            await FirestoreService.deleteEmployeeData(employeeId);

            return true;
        } catch (error) {
            console.error('Errore eliminazione dipendente:', error);
            throw error;
        }
    }

    getEmployeeById(employeeId) {
        return this.employees.find(emp => emp.id === employeeId);
    }

    getAllEmployees() {
        return [...this.employees];
    }

    validateEmployeeData(data) {
        const errors = [];

        if (!data.nome || !sanitizeString(data.nome)) {
            errors.push('Nome obbligatorio');
        }

        if (!data.cognome || !sanitizeString(data.cognome)) {
            errors.push('Cognome obbligatorio');
        }

        if (!data.password) {
            errors.push('Password obbligatoria');
        }

        if (data.codiceFiscale && data.codiceFiscale.length !== 16) {
            errors.push('Codice fiscale non valido');
        }

        return errors;
    }
}