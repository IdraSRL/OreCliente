// Configurazione Multi-Cliente
export const CLIENT_ID = 'FastService';   // ← MODIFICARE SOLO QUESTA PER OGNI CLIENTE

// Struttura database migliorata: una collezione per cliente con sottocollezioni
export const DB_STRUCTURE = {
    CLIENT_COLLECTION: CLIENT_ID,
    SUBCOLLECTIONS: {
        MASTER_PASSWORD: 'masterPassword',
        EMPLOYEES: 'employees', 
        CANTIERI: 'cantieri',
        DIPENDENTI: 'dipendenti'
    },
    // Sottocollezioni per i dipendenti
    EMPLOYEE_SUBCOLLECTIONS: {
        ORE: 'ore',
        BADGE: 'badge'
    }
};

export const ERROR_MESSAGES = {
    LOGIN_FAILED: 'Credenziali non valide',
    NETWORK_ERROR: 'Errore di connessione. Riprova.',
    SAVE_ERROR: 'Errore durante il salvataggio',
    LOAD_ERROR: 'Errore durante il caricamento dei dati',
    VALIDATION_ERROR: 'Dati non validi inseriti'
};