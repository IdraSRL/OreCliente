import { db } from '../config/firebase-config.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js';
import { DB_STRUCTURE } from '../config/client-config.js';

export class FirestoreService {
    
    // Test connessione database
    static async testConnection() {
        try {
            const testDoc = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'test');
            await getDoc(testDoc);
            return true;
        } catch (error) {
            console.error('Errore connessione Firebase:', error);
            return false;
        }
    }
    
    // === GESTIONE MASTER PASSWORD ===
    static async getMasterPassword() {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const password = docSnap.data().password;
                return password || 'admin'; // Fallback se password è vuota
            } else {
                // Crea password di default se non esiste
                await this.updateMasterPassword('admin');
                return 'admin';
            }
        } catch (error) {
            console.error('Errore caricamento master password:', error);
            // Fallback in caso di errore di connessione
            return 'admin';
        }
    }
    
    static async updateMasterPassword(newPassword) {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
            await setDoc(docRef, { password: newPassword });
            return true;
        } catch (error) {
            console.error('Errore aggiornamento master password:', error);
            throw error;
        }
    }
    
    // === GESTIONE DIPENDENTI ===
    static async getEmployees() {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const employees = docSnap.data().list || [];
                // Assicurati che ogni dipendente abbia una password
                return employees.map(emp => ({
                    ...emp,
                    password: emp.password || 'dipendente123'
                }));
            } else {
                return [];
            }
        } catch (error) {
            console.error('Errore caricamento dipendenti:', error);
            // Ritorna array vuoto invece di lanciare errore
            return [];
        }
    }
    
    static async saveEmployees(employees) {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
            await setDoc(docRef, { list: employees });
            return true;
        } catch (error) {
            console.error('Errore salvataggio dipendenti:', error);
            throw error;
        }
    }
    
    // === GESTIONE CANTIERI ===
    static async getCantieri() {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.CANTIERI);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data().list || [];
            } else {
                return [];
            }
        } catch (error) {
            console.error('Errore caricamento cantieri:', error);
            // Ritorna array vuoto invece di lanciare errore
            return [];
        }
    }
    
    static async saveCantieri(cantieri) {
        try {
            const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.CANTIERI);
            await setDoc(docRef, { list: cantieri });
            return true;
        } catch (error) {
            console.error('Errore salvataggio cantieri:', error);
            throw error;
        }
    }
    
    // === GESTIONE CATEGORIE CANTIERI ===
    static async getCategorieCantieri() {
        try {
            const categorieDocRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'categorie');
            const docSnap = await getDoc(categorieDocRef);
            
            if (docSnap.exists()) {
                return docSnap.data().list || [];
            } else {
                // Ritorna array vuoto se non ci sono categorie
                return [];
            }
        } catch (error) {
            console.error('Errore caricamento categorie cantieri:', error);
            // Ritorna array vuoto invece di categorie di default
            return [];
        }
    }
    
    static async saveCategorieCantieri(categorie) {
        try {
            const categorieDocRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'categorie');
            await setDoc(categorieDocRef, { list: categorie });
            return true;
        } catch (error) {
            console.error('Errore salvataggio categorie cantieri:', error);
            throw error;
        }
    }
    
    // === GESTIONE ORE LAVORATIVE ===
    static async getOreLavorative(employeeId, date) {
        try {
            if (!employeeId || !date) {
                throw new Error('EmployeeId e date sono obbligatori');
            }
            
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                console.warn(`Dipendente non trovato: ${employeeId}`);
                return {
                    data: date,
                    stato: 'Normale',
                    attivita: []
                };
            }
            
            const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Costruisci il path corretto per il documento (deve avere numero pari di segmenti)
            const docRef = doc(db, 
                DB_STRUCTURE.CLIENT_COLLECTION, 
                DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, 
                employeeName, 
                date
            );
            
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data();
            } else {
                // Restituisce struttura di default
                return {
                    data: date,
                    stato: 'Normale',
                    attivita: []
                };
            }
        } catch (error) {
            console.error('Errore caricamento ore lavorative:', error);
            // Ritorna struttura di default invece di lanciare errore
            return {
                data: date || new Date().toISOString().split('T')[0],
                stato: 'Normale',
                attivita: []
            };
        }
    }
    
    static async saveOreLavorative(employeeId, date, data) {
        try {
            if (!employeeId || !date || !data) {
                throw new Error('Parametri obbligatori mancanti');
            }
            
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                throw new Error(`Dipendente non trovato: ${employeeId}`);
            }
            
            const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Costruisci il path corretto per il documento (deve avere numero pari di segmenti)
            const docRef = doc(db, 
                DB_STRUCTURE.CLIENT_COLLECTION, 
                DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, 
                employeeName, 
                date
            );
            
            await setDoc(docRef, {
                data: date,
                stato: data.stato || 'Normale',
                attivita: data.attivita || [],
                ultimaModifica: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Errore salvataggio ore lavorative:', error);
            throw error;
        }
    }
    
    // Carica ore per un periodo
    static async getOrePeriodo(employeeId, startDate, endDate) {
        try {
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                console.warn(`Dipendente non trovato: ${employeeId}`);
                return [];
            }
            
            const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Costruisci il path corretto per la collezione (deve avere numero dispari di segmenti)
            const collRef = collection(db, 
                DB_STRUCTURE.CLIENT_COLLECTION, 
                DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, 
                employeeName
            );
            
            const q = query(
                collRef,
                where('data', '>=', startDate),
                where('data', '<=', endDate),
                orderBy('data', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const ore = [];
            
            querySnapshot.forEach((doc) => {
                ore.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return ore;
        } catch (error) {
            console.error('Errore caricamento ore periodo:', error);
            // Ritorna array vuoto invece di lanciare errore per evitare crash
            return [];
        }
    }
    
    // Carica tutte le ore di un dipendente per un mese
    static async getOreByMonth(employeeId, year, month) {
        try {
            const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            
            return await this.getOrePeriodo(employeeId, startDate, endDate);
        } catch (error) {
            console.error('Errore caricamento ore mensili:', error);
            throw error;
        }
    }
    
    // Carica riepilogo per tutti i dipendenti in un periodo
    static async getRiepilogoCompleto(startDate, endDate) {
        try {
            const employees = await this.getEmployees();
            const riepilogo = [];
            
            for (const employee of employees) {
                try {
                    const ore = await this.getOrePeriodo(employee.id, startDate, endDate);
                    riepilogo.push({
                        dipendente: employee,
                        ore: ore
                    });
                } catch (employeeError) {
                    console.error(`Errore caricamento ore per dipendente ${employee.id}:`, employeeError);
                    // Aggiungi comunque il dipendente con ore vuote
                    riepilogo.push({
                        dipendente: employee,
                        ore: []
                    });
                }
            }
            
            return riepilogo;
        } catch (error) {
            console.error('Errore caricamento riepilogo completo:', error);
            // Ritorna array vuoto invece di lanciare errore
            return [];
        }
    }
    
    // === GESTIONE BADGE STATE ===
    static async getBadgeState(employeeId, date) {
        try {
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                console.warn(`Dipendente non trovato per badge: ${employeeId}`);
                return null;
            }
            
            const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Costruisci il path corretto per il documento badge nella sottocollezione badge
            const docRef = doc(db, 
                DB_STRUCTURE.CLIENT_COLLECTION, 
                DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, 
                employeeName, 
                'badge',
                date
            );
            
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Errore caricamento stato badge:', error);
            return null;
        }
    }
    
    static async saveBadgeState(employeeId, date, badgeState) {
        try {
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                throw new Error(`Dipendente non trovato per salvataggio badge: ${employeeId}`);
            }
            
            const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Costruisci il path corretto per il documento badge nella sottocollezione badge
            const docRef = doc(db, 
                DB_STRUCTURE.CLIENT_COLLECTION, 
                DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, 
                employeeName, 
                'badge',
                date
            );
            
            await setDoc(docRef, {
                ...badgeState,
                ultimaModifica: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Errore salvataggio stato badge:', error);
            throw error;
        }
    }
    
    // Elimina tutti i dati di un dipendente
    static async deleteEmployeeData(employeeId) {
        try {
            // Ottieni il nome del dipendente per usarlo come ID documento
            const employees = await this.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            const employeeName = employee ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
            
            // Nota: In Firestore non possiamo eliminare una collezione direttamente
            // Dovremmo eliminare tutti i documenti uno per uno
            console.log(`Richiesta eliminazione dati per dipendente: ${employeeName} (ID: ${employeeId})`);
            
            // In un'implementazione completa, qui caricheremmo tutti i documenti
            // delle sub-collezioni e li elimineremmo uno per uno
            
            return true;
        } catch (error) {
            console.error('Errore eliminazione dati dipendente:', error);
            throw error;
        }
    }
    
    // Ottieni statistiche generali
    static async getStatistiche() {
        try {
            const employees = await this.getEmployees();
            const cantieri = await this.getCantieri();
            
            // Calcola statistiche di base
            const stats = {
                totaleDipendenti: employees.length,
                totaleCantieri: cantieri.length,
                ultimoAggiornamento: new Date().toISOString()
            };
            
            return stats;
        } catch (error) {
            console.error('Errore caricamento statistiche:', error);
            throw error;
        }
    }
}