// Application constants and configuration
export const APP_CONFIG = {
    NAME: 'Gestione Ore & Cantieri',
    VERSION: '1.2.0',
    DESCRIPTION: 'Sistema professionale per la gestione delle ore lavorative'
};

export const UI_CONSTANTS = {
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300,
    MAX_ACTIVITIES_PER_DAY: 20,
    AUTO_SAVE_DELAY: 1000,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    DATE_FORMAT: 'it-IT',
    TIME_FORMAT: { hour: '2-digit', minute: '2-digit' }
};

export const VALIDATION_RULES = {
    PASSWORD_MIN_LENGTH: 3,
    CODICE_FISCALE_LENGTH: 16,
    MIN_MINUTES: 0,
    MAX_MINUTES: 1440,
    MIN_PERSONE: 1,
    MAX_PERSONE: 50,
    MATRICOLA_PATTERN: /^[A-Z0-9]{3,10}$/,
    COLOR_PATTERN: /^#[0-9A-Fa-f]{6}$/
};

export const STATI_GIORNATA = {
    NORMALE: 'Normale',
    RIPOSO: 'Riposo',
    FERIE: 'Ferie',
    MALATTIA: 'Malattia'
};

export const TIPI_ATTIVITA = {
    CANTIERE: 'cantiere',
    PST: 'pst',
    BADGE: 'badge'
};

export const RUOLI_DIPENDENTE = [
    'Operaio',
    'Capo Squadra',
    'Tecnico',
    'Impiegato',
    'Responsabile',
    'Altro'
];

export const ICONE_CATEGORIA = [
    { value: 'bi-building', label: '🏢 Edificio' },
    { value: 'bi-hammer', label: '🔨 Martello' },
    { value: 'bi-tools', label: '🔧 Strumenti' },
    { value: 'bi-lightning', label: '⚡ Elettrico' },
    { value: 'bi-droplet', label: '💧 Idraulico' },
    { value: 'bi-tree', label: '🌳 Giardinaggio' },
    { value: 'bi-truck', label: '🚛 Trasporti' },
    { value: 'bi-gear', label: '⚙️ Meccanico' },
    { value: 'bi-paint-bucket', label: '🎨 Pittura' },
    { value: 'bi-bricks', label: '🧱 Muratura' }
];

export const BADGE_COLORS = {
    cantiere: 'success',
    pst: 'info',
    badge: 'warning',
    normale: 'success',
    riposo: 'secondary',
    ferie: 'warning',
    malattia: 'danger'
};

export const MESI_ANNO = [
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