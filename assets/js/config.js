// Configurazione Multi-Tenant
export const CLIENT_DB = 'cliente1';   // ← MODIFICARE SOLO QUESTA PER OGNI CLIENTE

export const COLL = {
    MASTER_PASS: `${CLIENT_DB}_masterPassword`, // doc singolo: { password }
    EMPLOYEES: `${CLIENT_DB}_employees`,        // doc singolo: { employees:[...] }
    CANTIERI: `${CLIENT_DB}_cantieri`,          // doc singolo: { cantieri:[...] }
    DIPENDENTI: `${CLIENT_DB}_dipendenti`,      // collection
    ORE_SUB: 'ore'                              // sub-collection fissa
};

export const ERROR_MESSAGES = {
    LOGIN_FAILED: 'Credenziali non valide',
    NETWORK_ERROR: 'Errore di connessione. Riprova.',
    SAVE_ERROR: 'Errore durante il salvataggio',
    LOAD_ERROR: 'Errore durante il caricamento dei dati',
    VALIDATION_ERROR: 'Dati non validi inseriti'
};