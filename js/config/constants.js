// Application constants and configuration
export const APP_CONFIG = {
    NAME: 'Gestione Ore & Cantieri',
    VERSION: '1.4.0',
    DESCRIPTION: 'Sistema professionale per la gestione delle ore lavorative'
};

export const UI_CONSTANTS = {
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300,
    MAX_ACTIVITIES_PER_DAY: 20,
    AUTO_SAVE_DELAY: 2000, // Increased to reduce server load
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    DATE_FORMAT: 'it-IT',
    TIME_FORMAT: { hour: '2-digit', minute: '2-digit' },
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
    CONNECTION_CHECK_INTERVAL: 30000
};

export const VALIDATION_RULES = {
    PASSWORD_MIN_LENGTH: 3,
    CODICE_FISCALE_LENGTH: 16,
    MIN_MINUTES: 0,
    MAX_MINUTES: 1440,
    MIN_PERSONE: 1,
    MAX_PERSONE: 5,
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
    'Altro'
];

export const ICONE_CATEGORIA = [
    { value: 'bi-cone-striped', label: '🚧 Cantieri Edili' },
    { value: 'bi-building', label: '🏢 Uffici' },
    { value: 'bi-house-door', label: '🏠 Residenziale' },
    { value: 'bi-shop', label: '🏪 Commerciale' },
    { value: 'bi-hospital', label: '🏥 Sanitario' },
    { value: 'bi-bank', label: '🏛️ Pubblico' },
    { value: 'bi-factory', label: '🏭 Industriale' },
    { value: 'bi-tree', label: '🌳 Verde/Parchi' },
    { value: 'bi-water', label: '💧 Idraulico' },
    { value: 'bi-lightning', label: '⚡ Elettrico' },
    { value: 'bi-thermometer-sun', label: '🔥 Termoidraulico' },
    { value: 'bi-tools', label: '🔧 Manutenzione' },
    { value: 'bi-paint-bucket', label: '🎨 Pittura' },
    { value: 'bi-bricks', label: '🧱 Muratura' },
    { value: 'bi-hammer', label: '🔨 Carpenteria' },
    { value: 'bi-truck', label: '🚛 Trasporti' },
    { value: 'bi-shield-check', label: '🛡️ Sicurezza' },
    { value: 'bi-clipboard-check', label: '📋 Controlli' },
    { value: 'bi-gear', label: '⚙️ Impianti' },
    { value: 'bi-wifi', label: '📡 Tecnologico' }
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