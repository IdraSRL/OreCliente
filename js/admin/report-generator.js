// Report generation module for admin panel
import { FirestoreService } from '../services/firestore-service.js';
import { ReportService } from '../services/report-service.js';
import { getMonthRange } from '../utils/date-utils.js';
import { showGlobalLoading, showToast } from '../utils/ui-utils.js';
import { ErrorHandler } from '../utils/error-handler.js';

export class ReportGenerator {
    constructor(employeeService) {
        this.employeeService = employeeService;
    }

    async generateReport(filter) {
        try {
            showGlobalLoading(true, 'Generazione report...');

            const { start, end } = getMonthRange(filter.year, filter.month);
            let reportData;

            if (filter.employee) {
                const employee = this.employeeService.getEmployeeById(filter.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    reportData = [{ dipendente: employee, ore }];
                } else {
                    reportData = [];
                }
            } else {
                reportData = await FirestoreService.getRiepilogoCompleto(start, end);
            }

            if (!reportData) {
                reportData = [];
            }

            return ReportService.processReportData(reportData);

        } catch (error) {
            console.error('Error generating report:', error);
            const userMessage = ErrorHandler.handleFirebaseError(error, 'generazione report');
            showToast(userMessage, 'error');
            
            // Return empty data structure
            return ReportService.processReportData([]);
        } finally {
            showGlobalLoading(false);
        }
    }

    async exportToExcel(filter) {
        try {
            showToast('Preparazione export in corso...', 'info');

            const reportData = await this.generateReport(filter);
            
            if (ReportService && ReportService.exportToExcel) {
                await ReportService.exportToExcel(reportData, filter);
                showToast('Export completato!', 'success');
            } else {
                throw new Error('Servizio export non disponibile');
            }

        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showToast('Errore durante l\'export', 'error');
        }
    }

    validateFilter(filter) {
        const errors = [];

        if (!filter.month || filter.month < 1 || filter.month > 12) {
            errors.push('Mese non valido');
        }

        if (!filter.year || filter.year < 2020 || filter.year > 2030) {
            errors.push('Anno non valido');
        }

        if (filter.employee && !this.employeeService.getEmployeeById(filter.employee)) {
            errors.push('Dipendente non trovato');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getAvailableYears() {
        const currentYear = new Date().getFullYear();
        const years = [];
        
        for (let year = currentYear - 3; year <= currentYear + 2; year++) {
            years.push(year);
        }
        
        return years;
    }

    getAvailableMonths() {
        return [
            { value: 1, label: 'Gennaio' },
            { value: 2, label: 'Febbraio' },
            { value: 3, label: 'Marzo' },
            { value: 4, label: 'Aprile' },
            { value: 5, label: 'Maggio' },
            { value: 6, label: 'Giugno' },
            { value: 7, label: 'Luglio' },
            { value: 8, label: 'Agosto' },
            { value: 9, label: 'Settembre' },
            { value: 10, label: 'Ottobre' },
            { value: 11, label: 'Novembre' },
            { value: 12, label: 'Dicembre' }
        ];
    }
}