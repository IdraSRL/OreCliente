// Employee service for managing employee data and operations

import { FirestoreService } from './firestore-service.js';
import { generateId } from '../utils/utils.js';
import { validateCodiceFiscale, validateEmail, validatePhone } from '../utils/validation-utils.js';

export class EmployeeService {
    constructor() {
        this.employees = [];
    }
    
    // Load employees from Firestore
    async loadEmployees() {
        try {
            this.employees = await FirestoreService.getEmployees();
            return this.employees;
        } catch (error) {
            console.error('Error loading employees:', error);
            this.employees = [];
            throw error;
        }
    }
    
    // Get all employees
    getAllEmployees() {
        return [...this.employees];
    }
    
    // Get employee by ID
    getEmployeeById(id) {
        return this.employees.find(employee => employee.id === id);
    }
    
    // Get employee by matricola
    getEmployeeByMatricola(matricola) {
        return this.employees.find(employee => employee.matricola === matricola);
    }
    
    // Save employee
    async saveEmployee(employeeData) {
        try {
            // Generate ID if not provided
            if (!employeeData.id) {
                employeeData.id = this.generateEmployeeId(employeeData);
            }
            
            // Generate matricola if not provided
            if (!employeeData.matricola) {
                employeeData.matricola = this.generateMatricola(employeeData);
            }
            
            // Validate employee data
            const validation = this.validateEmployee(employeeData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            // Ensure password is set
            if (!employeeData.password) {
                employeeData.password = 'dipendente123';
            }
            
            // Update or add employee
            const existingIndex = this.employees.findIndex(e => e.id === employeeData.id);
            
            if (existingIndex >= 0) {
                this.employees[existingIndex] = { ...this.employees[existingIndex], ...employeeData };
            } else {
                this.employees.push(employeeData);
            }
            
            // Save to Firestore
            await FirestoreService.saveEmployees(this.employees);
            
            return employeeData;
        } catch (error) {
            console.error('Error saving employee:', error);
            throw error;
        }
    }
    
    // Delete employee
    async deleteEmployee(employeeId) {
        try {
            const index = this.employees.findIndex(e => e.id === employeeId);
            
            if (index === -1) {
                throw new Error('Dipendente non trovato');
            }
            
            this.employees.splice(index, 1);
            
            // Save to Firestore
            await FirestoreService.saveEmployees(this.employees);
            
            // Also delete employee data from Firestore
            await FirestoreService.deleteEmployeeData(employeeId);
            
            return true;
        } catch (error) {
            console.error('Error deleting employee:', error);
            throw error;
        }
    }
    
    // Generate employee ID
    generateEmployeeId(employeeData) {
        // Use name-based ID if possible
        if (employeeData.nome && employeeData.cognome) {
            const baseId = `${employeeData.nome.trim()}${employeeData.cognome.trim()}`
                .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters but keep case
                .substring(0, 30); // Limit length
            
            // Check if ID already exists
            let counter = 1;
            let finalId = baseId;
            
            while (this.getEmployeeById(finalId)) {
                finalId = `${baseId}${counter}`;
                counter++;
            }
            
            return finalId;
        }
        
        // Fallback to generated ID
        return generateId('emp');
    }
    
    // Generate matricola
    generateMatricola(employeeData) {
        // Try to use initials + number
        let baseMatricola = '';
        
        if (employeeData.nome && employeeData.cognome) {
            baseMatricola = `${employeeData.nome.charAt(0)}${employeeData.cognome.charAt(0)}`.toUpperCase();
        } else {
            baseMatricola = 'EMP';
        }
        
        // Find next available number
        let counter = 1;
        let finalMatricola = `${baseMatricola}${counter.toString().padStart(3, '0')}`;
        
        while (this.getEmployeeByMatricola(finalMatricola)) {
            counter++;
            finalMatricola = `${baseMatricola}${counter.toString().padStart(3, '0')}`;
        }
        
        return finalMatricola;
    }
    
    // Validate employee data
    validateEmployee(employeeData) {
        const errors = [];
        
        // Required fields
        if (!employeeData.nome || employeeData.nome.trim().length < 2) {
            errors.push('Nome deve essere di almeno 2 caratteri');
        }
        
        if (!employeeData.cognome || employeeData.cognome.trim().length < 2) {
            errors.push('Cognome deve essere di almeno 2 caratteri');
        }
        
        if (!employeeData.password || employeeData.password.length < 3) {
            errors.push('Password deve essere di almeno 3 caratteri');
        }
        
        // Optional field validations
        if (employeeData.codiceFiscale && !validateCodiceFiscale(employeeData.codiceFiscale)) {
            errors.push('Codice fiscale non valido');
        }
        
        if (employeeData.email && !validateEmail(employeeData.email)) {
            errors.push('Email non valida');
        }
        
        if (employeeData.telefono && !validatePhone(employeeData.telefono)) {
            errors.push('Numero di telefono non valido');
        }
        
        // Check for duplicate matricola (excluding current employee)
        if (employeeData.matricola) {
            const existingEmployee = this.employees.find(e => 
                e.matricola === employeeData.matricola && e.id !== employeeData.id
            );
            
            if (existingEmployee) {
                errors.push('Matricola già esistente');
            }
        }
        
        // Check for duplicate codice fiscale (excluding current employee)
        if (employeeData.codiceFiscale) {
            const existingEmployee = this.employees.find(e => 
                e.codiceFiscale === employeeData.codiceFiscale && e.id !== employeeData.id
            );
            
            if (existingEmployee) {
                errors.push('Codice fiscale già esistente');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Search employees
    searchEmployees(query) {
        if (!query || query.trim() === '') {
            return this.getAllEmployees();
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        return this.employees.filter(employee => 
            employee.name.toLowerCase().includes(searchTerm) ||
            employee.matricola.toLowerCase().includes(searchTerm) ||
            (employee.codiceFiscale && employee.codiceFiscale.toLowerCase().includes(searchTerm)) ||
            (employee.ruolo && employee.ruolo.toLowerCase().includes(searchTerm))
        );
    }
    
    // Get employees by role
    getEmployeesByRole(role) {
        return this.employees.filter(employee => employee.ruolo === role);
    }
    
    // Get employee statistics
    getEmployeeStats() {
        const total = this.employees.length;
        const byRole = {};
        
        this.employees.forEach(employee => {
            const role = employee.ruolo || 'Non specificato';
            byRole[role] = (byRole[role] || 0) + 1;
        });
        
        const withPhoto = this.employees.filter(e => e.foto).length;
        const withPhone = this.employees.filter(e => e.telefono).length;
        const withCF = this.employees.filter(e => e.codiceFiscale).length;
        
        return {
            total,
            byRole,
            withPhoto,
            withPhone,
            withCF,
            completionRate: total > 0 ? Math.round(((withPhoto + withPhone + withCF) / (total * 3)) * 100) : 0
        };
    }
    
    // Import employees from array
    async importEmployees(employeesArray) {
        try {
            const validEmployees = [];
            const errors = [];
            
            employeesArray.forEach((employee, index) => {
                // Generate required fields
                if (!employee.id) {
                    employee.id = this.generateEmployeeId(employee);
                }
                
                if (!employee.matricola) {
                    employee.matricola = this.generateMatricola(employee);
                }
                
                if (!employee.password) {
                    employee.password = 'dipendente123';
                }
                
                // Ensure name field is set
                if (employee.nome && employee.cognome) {
                    employee.name = `${employee.nome} ${employee.cognome}`;
                }
                
                const validation = this.validateEmployee(employee);
                
                if (validation.isValid) {
                    validEmployees.push(employee);
                } else {
                    errors.push(`Riga ${index + 1}: ${validation.errors.join(', ')}`);
                }
            });
            
            if (validEmployees.length > 0) {
                this.employees = [...this.employees, ...validEmployees];
                await FirestoreService.saveEmployees(this.employees);
            }
            
            return {
                imported: validEmployees.length,
                errors
            };
        } catch (error) {
            console.error('Error importing employees:', error);
            throw error;
        }
    }
    
    // Export employees to array
    exportEmployees() {
        return this.employees.map(employee => ({
            nome: employee.nome,
            cognome: employee.cognome,
            matricola: employee.matricola,
            codiceFiscale: employee.codiceFiscale,
            dataNascita: employee.dataNascita,
            luogoNascita: employee.luogoNascita,
            ruolo: employee.ruolo,
            dataAssunzione: employee.dataAssunzione,
            telefono: employee.telefono,
            email: employee.email
        }));
    }
    
    // Update employee password
    async updateEmployeePassword(employeeId, newPassword) {
        try {
            const employee = this.getEmployeeById(employeeId);
            
            if (!employee) {
                throw new Error('Dipendente non trovato');
            }
            
            if (!newPassword || newPassword.length < 3) {
                throw new Error('Password deve essere di almeno 3 caratteri');
            }
            
            employee.password = newPassword;
            
            await FirestoreService.saveEmployees(this.employees);
            
            return true;
        } catch (error) {
            console.error('Error updating employee password:', error);
            throw error;
        }
    }
    
    // Get employee work summary
    async getEmployeeWorkSummary(employeeId, startDate, endDate) {
        try {
            const employee = this.getEmployeeById(employeeId);
            
            if (!employee) {
                throw new Error('Dipendente non trovato');
            }
            
            const ore = await FirestoreService.getOrePeriodo(employeeId, startDate, endDate);
            
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
            
            return {
                employee,
                period: { startDate, endDate },
                summary: {
                    totalMinutes,
                    totalHours: Math.floor(totalMinutes / 60) + ':' + (totalMinutes % 60).toString().padStart(2, '0'),
                    totalDecimal: (totalMinutes / 60).toFixed(2),
                    totalDays,
                    totalActivities,
                    averageHoursPerDay: totalDays > 0 ? (totalMinutes / totalDays / 60).toFixed(2) : 0
                },
                details: ore
            };
        } catch (error) {
            console.error('Error getting employee work summary:', error);
            throw error;
        }
    }
}