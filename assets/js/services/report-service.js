import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    minutesToHHMM, 
    minutesToDecimal
} from '../utils/time-utils.js';
import { formatDate, getMonthRange } from '../utils/date-utils.js';

export class ReportService {
    static async generateReport(filters) {
        try {
            const { start, end } = getMonthRange(filters.year, filters.month);
            let reportData;

            if (filters.employee) {
                // Report per singolo dipendente
                const employees = await FirestoreService.getEmployees();
                const employee = employees.find(emp => emp.id === filters.employee);
                if (employee) {
                    const ore = await FirestoreService.getOrePeriodo(employee.id, start, end);
                    reportData = [{ dipendente: employee, ore: ore }];
                }
            } else {
                // Report per tutti i dipendenti
                reportData = await FirestoreService.getRiepilogoCompleto(start, end);
            }

            return this.processReportData(reportData);
        } catch (error) {
            console.error('Errore generazione report:', error);
            throw error;
        }
    }

    static processReportData(data) {
        const processedData = [];
        let totalStats = {
            totalMinutes: 0,
            totalDays: 0,
            totalActivities: 0
        };

        data.forEach(employeeData => {
            const { dipendente, ore } = employeeData;
            
            let employeeMinutes = 0;
            let employeeDays = 0;
            let employeeActivities = 0;

            ore.forEach(day => {
                if (day.attivita && day.attivita.length > 0) {
                    employeeDays++;
                    employeeActivities += day.attivita.length;
                    day.attivita.forEach(activity => {
                        const minutes = activity.minutiEffettivi || activity.minuti || 0;
                        employeeMinutes += minutes;
                    });
                }
            });

            processedData.push({
                dipendente,
                ore,
                stats: {
                    totalMinutes: employeeMinutes,
                    totalDays: employeeDays,
                    totalActivities: employeeActivities,
                    totalHours: minutesToHHMM(employeeMinutes),
                    totalDecimal: minutesToDecimal(employeeMinutes)
                }
            });

            totalStats.totalMinutes += employeeMinutes;
            totalStats.totalDays += employeeDays;
            totalStats.totalActivities += employeeActivities;
        });

        return {
            data: processedData,
            totalStats: {
                ...totalStats,
                totalHours: minutesToHHMM(totalStats.totalMinutes),
                totalDecimal: minutesToDecimal(totalStats.totalMinutes)
            }
        };
    }

    static async exportToExcel(reportData, filters) {
        try {
            // Carica il template esistente
            const templateResponse = await fetch('../template_ore_dipendenti.xlsx');
            if (!templateResponse.ok) {
                throw new Error('Template non trovato');
            }
            
            const templateBuffer = await templateResponse.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);
            
            // Ottieni il worksheet principale
            const worksheet = workbook.getWorksheet(1);
            if (!worksheet) {
                throw new Error('Worksheet non trovato nel template');
            }

            // Aggiorna il mese nell'header (cella A1)
            const monthNames = [
                'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
            ];
            const monthName = monthNames[filters.month - 1];
            worksheet.getCell(1, 1).value = `${monthName} ${filters.year}`;

            // Calcola il numero di giorni nel mese
            const daysInMonth = new Date(filters.year, filters.month, 0).getDate();

            // Nascondi le colonne dei giorni che non esistono nel mese
            for (let day = daysInMonth + 1; day <= 31; day++) {
                const colIndex = day + 1; // +1 perché la colonna A è per i nomi
                const column = worksheet.getColumn(colIndex);
                if (column) {
                    column.hidden = true;
                }
            }

            // Popola i dati per ogni dipendente
            let currentRow = 3; // Inizia dalla riga 3 (lascia una riga vuota dopo l'header)
            
            reportData.data.forEach((employeeData, employeeIndex) => {
                const { dipendente, ore } = employeeData;
                
                // Crea una mappa dei giorni lavorati
                const dayMap = {};
                ore.forEach(day => {
                    const dayNum = new Date(day.data + 'T00:00:00').getDate();
                    dayMap[dayNum] = day;
                });

                // Nome dipendente (cella A)
                worksheet.getCell(currentRow, 1).value = dipendente.name;
                worksheet.getCell(currentRow, 1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF90EE90' } // Verde chiaro
                };
                worksheet.getCell(currentRow, 1).font = { bold: true };

                // Riga Permessi
                currentRow++;
                worksheet.getCell(currentRow, 1).value = 'Permessi';
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayData = dayMap[day];
                    if (dayData && (dayData.stato === 'Riposo' || dayData.stato === 'Permesso')) {
                        worksheet.getCell(currentRow, day + 1).value = 'P';
                    }
                }

                // Riga Ferie
                currentRow++;
                worksheet.getCell(currentRow, 1).value = 'Ferie';
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayData = dayMap[day];
                    if (dayData && dayData.stato === 'Ferie') {
                        worksheet.getCell(currentRow, day + 1).value = 'F';
                    }
                }

                // Riga Malattia
                currentRow++;
                worksheet.getCell(currentRow, 1).value = 'Malattia';
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayData = dayMap[day];
                    if (dayData && dayData.stato === 'Malattia') {
                        worksheet.getCell(currentRow, day + 1).value = 'M';
                    }
                }

                // Riga Ore
                currentRow++;
                worksheet.getCell(currentRow, 1).value = 'Ore';
                let totalMonthHours = 0;
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayData = dayMap[day];
                    if (dayData && dayData.attivita && dayData.attivita.length > 0 && dayData.stato === 'Normale') {
                        let dayMinutes = 0;
                        dayData.attivita.forEach(activity => {
                            dayMinutes += activity.minutiEffettivi || activity.minuti || 0;
                        });
                        
                        if (dayMinutes > 0) {
                            const decimalHours = parseFloat(minutesToDecimal(dayMinutes));
                            worksheet.getCell(currentRow, day + 1).value = decimalHours;
                            totalMonthHours += decimalHours;
                        }
                    }
                }

                // Calcola i totali per ogni tipo
                let totalPermessi = 0;
                let totalFerie = 0;
                let totalMalattia = 0;
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayData = dayMap[day];
                    if (dayData) {
                        if (dayData.stato === 'Riposo' || dayData.stato === 'Permesso') totalPermessi++;
                        if (dayData.stato === 'Ferie') totalFerie++;
                        if (dayData.stato === 'Malattia') totalMalattia++;
                    }
                }
                
                // Totale mensile nella colonna TOTALE (colonna 33)
                worksheet.getCell(currentRow - 3, 33).value = totalPermessi; // Permessi
                worksheet.getCell(currentRow - 2, 33).value = totalFerie; // Ferie
                worksheet.getCell(currentRow - 1, 33).value = totalMalattia; // Malattia
                worksheet.getCell(currentRow, 33).value = parseFloat(totalMonthHours.toFixed(2)); // Ore

                // Aggiungi una riga vuota tra i dipendenti
                currentRow += 2;
            });

            // Rimuovi righe vuote in eccesso se necessario
            const totalRows = worksheet.rowCount;
            if (currentRow < totalRows) {
                for (let row = currentRow; row <= totalRows; row++) {
                    worksheet.spliceRows(currentRow, 1);
                }
            }

            // Applica formattazione alle celle delle ore
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) { // Salta l'header
                    row.eachCell((cell, colNumber) => {
                        if (colNumber > 1 && colNumber <= 32) { // Colonne dei giorni
                            if (typeof cell.value === 'number' && cell.value > 0) {
                                cell.numFmt = '0.00';
                                cell.alignment = { horizontal: 'center' };
                            } else if (typeof cell.value === 'string' && ['P', 'F', 'M'].includes(cell.value)) {
                                cell.alignment = { horizontal: 'center' };
                            }
                        }
                    });
                }
            });

            // Genera e scarica il file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `riepilogo_ore_${monthNames[filters.month - 1]}_${filters.year}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('Errore export Excel:', error);
            throw error;
        }
    }
}