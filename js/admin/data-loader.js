// Data loading module for admin panel
import { FirestoreService } from '../services/firestore-service.js';
import { EmployeeService } from '../services/employee-service.js';
import { CantiereService } from '../services/cantiere-service.js';
import { showGlobalLoading, showToast } from '../utils/ui-utils.js';
import { ErrorHandler } from '../utils/error-handler.js';

export class DataLoader {
    constructor() {
        this.employeeService = new EmployeeService();
        this.cantiereService = new CantiereService();
    }

    async loadInitialData() {
        try {
            showGlobalLoading(true, 'Caricamento dati...');
            
            // Verify connection first
            await FirestoreService.testConnection();
            
            // Load all data in parallel
            await Promise.all([
                this.employeeService.loadEmployees(),
                this.cantiereService.loadCantieri(),
                this.cantiereService.loadCategorie()
            ]);

            return {
                employees: this.employeeService.getAllEmployees(),
                cantieri: this.cantiereService.getAllCantieri(),
                categorie: this.cantiereService.getAllCategorie()
            };

        } catch (error) {
            console.error('Error loading initial data:', error);
            const userMessage = ErrorHandler.handleFirebaseError(error, 'caricamento dati iniziali');
            showToast(userMessage, 'error');
            
            // Return empty data to prevent crashes
            return {
                employees: [],
                cantieri: [],
                categorie: []
            };
        } finally {
            showGlobalLoading(false);
        }
    }

    getEmployeeService() {
        return this.employeeService;
    }

    getCantiereService() {
        return this.cantiereService;
    }

    async reloadEmployees() {
        try {
            await this.employeeService.loadEmployees();
            return this.employeeService.getAllEmployees();
        } catch (error) {
            console.error('Error reloading employees:', error);
            throw error;
        }
    }

    async reloadCantieri() {
        try {
            await this.cantiereService.loadCantieri();
            return this.cantiereService.getAllCantieri();
        } catch (error) {
            console.error('Error reloading cantieri:', error);
            throw error;
        }
    }

    async reloadCategorie() {
        try {
            await this.cantiereService.loadCategorie();
            return this.cantiereService.getAllCategorie();
        } catch (error) {
            console.error('Error reloading categorie:', error);
            throw error;
        }
    }
}