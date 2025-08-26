import { FirestoreService } from './firestore-service.js';
import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';
import { formatDate, getMonthName } from '../utils/date-utils.js';

export class ReportService {
    static async generateReport(filter) {
        const { start, end } = this.getDateRange(filter);

        let reportData;
        if (filter.employee) {
            const employees = await FirestoreService.getEmployees();
            const employee = employees.find(emp => emp.id === filter.employee);
            if (employee) {
                const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                reportData = [{ dipendente: employee, ore }];
            }
        } else {
            reportData = await FirestoreService.getRiepilogoCompleto(start, end);
        }
        return this.processReportData(reportData);
    }

    static processReportData(rawData) {
        if (!rawData || rawData.length === 0) {
            return { data: [], totalStats: {} };
        }

        const processedData = [];
        let grandTotalMinutes = 0;

        rawData.forEach(employeeData => {
            let employeeTotalMinutes = 0;
            const processedOre = employeeData.ore.map(day => {
                const dayMinutes = (day.attivita || [])
                    .reduce((sum, a) => sum + (a.minutiEffettivi || a.minuti || 0), 0);

                employeeTotalMinutes += dayMinutes;

                return {
                    ...day,
                    dayMinutes,
                    dayHours: minutesToHHMM(dayMinutes),
                    dayDecimal: minutesToDecimal(dayMinutes)
                };
            });

            grandTotalMinutes += employeeTotalMinutes;
            processedData.push({
                dipendente: employeeData.dipendente,
                ore: processedOre,
                totalMinutes: employeeTotalMinutes,
                totalHours: minutesToHHMM(employeeTotalMinutes),
                totalDecimal: minutesToDecimal(employeeTotalMinutes)
            });
        });

        return {
            data: processedData,
            totalStats: {
                totalHours: minutesToHHMM(grandTotalMinutes),
                totalDecimal: minutesToDecimal(grandTotalMinutes)
            }
        };
    }

    static async exportToExcel(reportData, filter) {
        if (typeof ExcelJS === 'undefined') {
            throw new Error('ExcelJS library not loaded');
        }
        try {
            const templateResponse = await fetch('../template_ore_dipendenti.xlsx');
            const templateBuffer = await templateResponse.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);

            const worksheet = workbook.getWorksheet(1);
            this.populateTemplateData(worksheet, reportData.data, filter);

            const buffer = await workbook.xlsx.writeBuffer();
            this.downloadExcelFile(buffer, this.generateFileName(filter));
        } catch (err) {
            console.error('Errore export Excel:', err);
        }
    }

    static createTemplateStructure(worksheet, data, filter) {
        const { start } = this.getDateRange(filter);
        const d = new Date(start);
        const monthName = this.getMonthName(d.getMonth() + 1);

        // Ora il mese è in A1
        worksheet.getCell('A1').value = `${monthName} ${d.getFullYear()}`;

        if (!worksheet.getCell(2, 33).value) {
            worksheet.getCell(2, 33).value = 'TOTALE';
        }
    }

    static populateTemplateData(worksheet, data, filter) {
        const { start } = this.getDateRange(filter);
        const startDate = new Date(start);
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthName = this.getMonthName(month);

        // intestazione mese in A1
        worksheet.getCell('A1').value = `${monthName} ${year}`;

        let row = 3;
        data.forEach(employeeData => {
            const employee = employeeData.dipendente;
            worksheet.getCell(row, 1).value = employee.name || employee.nome || 'Dipendente';

            for (let day = 1; day <= daysInMonth; day++) {
                worksheet.getCell(row, day + 1).value = day;
            }
            worksheet.getCell(row, 33).value = 'TOTALE';
            row++;

            const dailyMinutes = {};
            const dailyStatus = {};
            employeeData.ore.forEach(day => {
                const d = new Date(day.data).getDate();
                const minutes = (day.attivita || []).reduce((s,a)=>s+(a.minutiEffettivi||a.minuti||0),0);
                dailyMinutes[d] = minutes;
                dailyStatus[d]  = day.stato || 'Normale';
            });

            const writeCategoryRow = (label, predicate) => {
                worksheet.getCell(row, 1).value = label;
                let total = 0;
                for (let d = 1; d <= daysInMonth; d++) {
                    const minutes = dailyMinutes[d] || 0;
                    const status  = dailyStatus[d] || 'Normale';
                    if (predicate(status, minutes)) {
                        const dec = +(minutes/60).toFixed(2);
                        worksheet.getCell(row, d+1).value = dec;
                        total += dec;
                    }
                }
                worksheet.getCell(row, 33).value = +total.toFixed(2);
                row++;
            };

            writeCategoryRow('Permessi', (s, m) => s === 'Riposo' && m > 0);
            writeCategoryRow('Ferie', (s, m) => s === 'Ferie' && m > 0);
            writeCategoryRow('Malattia', (s, m) => s === 'Malattia' && m > 0);
            writeCategoryRow('Ore', (s, m) => s === 'Normale' && m > 0);
            row++;
        });
    }

    static getMonthName(month) {
        const months = [
            'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
            'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
        ];
        return months[month - 1] || '';
    }

    static downloadExcelFile(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    static generateFileName(filter) {
        const { start, end } = this.getDateRange(filter);
        const startDate = new Date(start);
        const endDate = new Date(end);

        let filename = 'riepilogo_ore';
        if (filter.employee) filename += `_${filter.employee}`;
        if (filter.month && filter.year) {
            filename += `_${getMonthName(filter.month)}_${filter.year}`;
        } else {
            filename += `_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
        }
        return filename + '.xlsx';
    }

    static getDateRange(filter) {
        if (filter.month && filter.year) {
            const startDate = new Date(filter.year, filter.month - 1, 1);
            const endDate = new Date(filter.year, filter.month, 0);
            return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
        }
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
    }
}
