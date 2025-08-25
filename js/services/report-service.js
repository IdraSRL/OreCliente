// Report service for generating and exporting reports

import { FirestoreService } from './firestore-service.js';
import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';
import { formatDate, getMonthName } from '../utils/date-utils.js';

export class ReportService {
    // Generate comprehensive report data
    static async generateReport(filter) {
        try {
            const { start, end } = this.getDateRange(filter);
            
            let reportData;
            if (filter.employee) {
                // Single employee report
                const employees = await FirestoreService.getEmployees();
                const employee = employees.find(emp => emp.id === filter.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    reportData = [{ dipendente: employee, ore: ore }];
                }
            } else {
                // All employees report
                reportData = await FirestoreService.getRiepilogoCompleto(start, end);
            }
            
            return this.processReportData(reportData);
        } catch (error) {
            console.error('Error generating report:', error);
            throw error;
        }
    }
    
    // Process raw report data into structured format
    static processReportData(rawData) {
        if (!rawData || rawData.length === 0) {
            return {
                data: [],
                totalStats: {
                    totalHours: '00:00',
                    totalDecimal: '0.00',
                    totalDays: 0,
                    totalActivities: 0
                }
            };
        }
        
        const processedData = [];
        let grandTotalMinutes = 0;
        let grandTotalDays = 0;
        let grandTotalActivities = 0;
        
        rawData.forEach(employeeData => {
            let employeeTotalMinutes = 0;
            let employeeTotalDays = 0;
            let employeeTotalActivities = 0;
            
            const processedOre = employeeData.ore.map(day => {
                let dayMinutes = 0;
                let dayActivities = 0;
                
                if (day.attivita && day.attivita.length > 0) {
                    dayActivities = day.attivita.length;
                    dayMinutes = day.attivita.reduce((sum, activity) => 
                        sum + (activity.minutiEffettivi || activity.minuti || 0), 0);
                    
                    if (dayMinutes > 0) {
                        employeeTotalDays++;
                    }
                }
                
                employeeTotalMinutes += dayMinutes;
                employeeTotalActivities += dayActivities;
                
                return {
                    ...day,
                    dayMinutes,
                    dayHours: minutesToHHMM(dayMinutes),
                    dayDecimal: minutesToDecimal(dayMinutes),
                    dayActivities
                };
            });
            
            grandTotalMinutes += employeeTotalMinutes;
            grandTotalDays += employeeTotalDays;
            grandTotalActivities += employeeTotalActivities;
            
            processedData.push({
                dipendente: employeeData.dipendente,
                ore: processedOre,
                totalMinutes: employeeTotalMinutes,
                totalHours: minutesToHHMM(employeeTotalMinutes),
                totalDecimal: minutesToDecimal(employeeTotalMinutes),
                totalDays: employeeTotalDays,
                totalActivities: employeeTotalActivities
            });
        });
        
        return {
            data: processedData,
            totalStats: {
                totalHours: minutesToHHMM(grandTotalMinutes),
                totalDecimal: minutesToDecimal(grandTotalMinutes),
                totalDays: grandTotalDays,
                totalActivities: grandTotalActivities
            }
        };
    }
    
    // Export report to Excel
    static async exportToExcel(reportData, filter) {
        if (!window.ExcelJS) {
            throw new Error('ExcelJS library not loaded');
        }
        
        const workbook = new ExcelJS.Workbook();
        
        // Add metadata
        workbook.creator = 'Gestione Ore & Cantieri';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Create main worksheet
        const worksheet = workbook.addWorksheet('Riepilogo Ore');
        
        // Add title and filters info
        this.addExcelHeader(worksheet, filter);
        
        // Add summary statistics
        this.addExcelSummary(worksheet, reportData.totalStats);
        
        // Add detailed data
        this.addExcelData(worksheet, reportData.data);
        
        // Style the worksheet
        this.styleExcelWorksheet(worksheet);
        
        // Generate and download file
        const buffer = await workbook.xlsx.writeBuffer();
        this.downloadExcelFile(buffer, this.generateFileName(filter));
    }
    
    // Add header section to Excel
    static addExcelHeader(worksheet, filter) {
        const { start, end } = this.getDateRange(filter);
        
        worksheet.addRow(['RIEPILOGO ORE LAVORATIVE']);
        worksheet.addRow([]);
        worksheet.addRow(['Periodo:', `${formatDate(start)} - ${formatDate(end)}`]);
        
        if (filter.employee) {
            worksheet.addRow(['Dipendente:', filter.employee]);
        } else {
            worksheet.addRow(['Dipendenti:', 'Tutti']);
        }
        
        worksheet.addRow(['Generato il:', new Date().toLocaleDateString('it-IT')]);
        worksheet.addRow([]);
    }
    
    // Add summary statistics to Excel
    static addExcelSummary(worksheet, stats) {
        worksheet.addRow(['RIEPILOGO GENERALE']);
        worksheet.addRow(['Ore Totali:', stats.totalHours]);
        worksheet.addRow(['Ore Decimali:', stats.totalDecimal]);
        worksheet.addRow(['Giorni Lavorati:', stats.totalDays]);
        worksheet.addRow(['Attività Totali:', stats.totalActivities]);
        worksheet.addRow([]);
    }
    
    // Add detailed data to Excel
    static addExcelData(worksheet, data) {
        worksheet.addRow(['DETTAGLIO PER DIPENDENTE']);
        worksheet.addRow([]);
        
        // Headers
        const headers = ['Dipendente', 'Data', 'Stato', 'Attività', 'Tipo', 'Minuti', 'Persone', 'Min. Effettivi', 'Ore'];
        worksheet.addRow(headers);
        
        data.forEach(employeeData => {
            employeeData.ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    day.attivita.forEach((activity, index) => {
                        const row = [
                            index === 0 ? employeeData.dipendente.name : '',
                            index === 0 ? formatDate(day.data) : '',
                            index === 0 ? day.stato : '',
                            activity.nome,
                            activity.tipo,
                            activity.minuti,
                            activity.persone,
                            activity.minutiEffettivi || activity.minuti,
                            minutesToHHMM(activity.minutiEffettivi || activity.minuti)
                        ];
                        worksheet.addRow(row);
                    });
                } else {
                    // Day with no activities
                    const row = [
                        employeeData.dipendente.name,
                        formatDate(day.data),
                        day.stato,
                        'Nessuna attività',
                        '',
                        0,
                        0,
                        0,
                        '00:00'
                    ];
                    worksheet.addRow(row);
                }
            });
            
            // Add employee total row
            worksheet.addRow([
                `TOTALE ${employeeData.dipendente.name}`,
                '',
                '',
                '',
                '',
                '',
                '',
                employeeData.totalMinutes,
                employeeData.totalHours
            ]);
            worksheet.addRow([]);
        });
    }
    
    // Style Excel worksheet
    static styleExcelWorksheet(worksheet) {
        // Title styling
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
        
        // Header styling
        const headerRow = worksheet.getRow(worksheet.rowCount - worksheet.actualRowCount + 1);
        headerRow.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });
    }
    
    // Download Excel file
    static downloadExcelFile(buffer, filename) {
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        window.URL.revokeObjectURL(url);
    }
    
    // Generate filename for export
    static generateFileName(filter) {
        const { start, end } = this.getDateRange(filter);
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        let filename = 'riepilogo_ore';
        
        if (filter.employee) {
            filename += `_${filter.employee}`;
        }
        
        if (filter.month && filter.year) {
            filename += `_${getMonthName(filter.month)}_${filter.year}`;
        } else {
            filename += `_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
        }
        
        filename += '.xlsx';
        
        return filename;
    }
    
    // Get date range from filter
    static getDateRange(filter) {
        if (filter.month && filter.year) {
            const startDate = new Date(filter.year, filter.month - 1, 1);
            const endDate = new Date(filter.year, filter.month, 0);
            
            return {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            };
        }
        
        // Default to current month if no specific range provided
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    }
    
    // Generate PDF report (future enhancement)
    static async exportToPDF(reportData, filter) {
        // This would require a PDF library like jsPDF
        throw new Error('PDF export not yet implemented');
    }
    
    // Generate CSV report
    static exportToCSV(reportData, filter) {
        const headers = ['Dipendente', 'Data', 'Stato', 'Attività', 'Tipo', 'Minuti', 'Persone', 'Min. Effettivi', 'Ore'];
        const rows = [headers];
        
        reportData.data.forEach(employeeData => {
            employeeData.ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    day.attivita.forEach(activity => {
                        rows.push([
                            employeeData.dipendente.name,
                            formatDate(day.data),
                            day.stato,
                            activity.nome,
                            activity.tipo,
                            activity.minuti,
                            activity.persone,
                            activity.minutiEffettivi || activity.minuti,
                            minutesToHHMM(activity.minutiEffettivi || activity.minuti)
                        ]);
                    });
                }
            });
        });
        
        const csvContent = rows.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.generateFileName(filter).replace('.xlsx', '.csv');
        link.click();
        URL.revokeObjectURL(url);
    }
}