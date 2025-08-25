# Gestione Ore & Cantieri - Sistema Multi-Cliente

Sistema professionale per la gestione delle ore lavorative con supporto multi-cliente.

## Struttura del Progetto

```
/
├── index.html                 # Homepage
├── pages/                     # Pagine dell'applicazione
│   ├── login.html            # Pagina di login
│   ├── admin.html            # Pannello amministratore
│   └── timeEntry.html        # Inserimento ore dipendenti
├── js/                       # JavaScript organizzato
│   ├── config/               # Configurazioni
│   │   ├── firebase-config.js
│   │   ├── client-config.js  # ← MODIFICARE PER OGNI CLIENTE
│   │   └── constants.js
│   ├── auth/                 # Autenticazione
│   │   └── auth.js
│   ├── services/             # Servizi business logic
│   │   ├── firestore-service.js
│   │   ├── employee-service.js
│   │   ├── cantiere-service.js
│   │   ├── badge-service.js
│   │   ├── photo-service.js
│   │   └── report-service.js
│   ├── ui/                   # Componenti UI
│   │   ├── table-renderer.js
│   │   ├── grid-renderer.js
│   │   ├── form-handlers.js
│   │   └── button-utils.js
│   ├── utils/                # Utilities
│   │   ├── utils.js
│   │   ├── time-utils.js
│   │   ├── date-utils.js
│   │   ├── validation-utils.js
│   │   ├── storage-utils.js
│   │   └── ui-utils.js
│   ├── admin/                # Logica amministratore
│   │   └── admin-service.js
│   └── time-entry/           # Logica inserimento ore
│       └── time-entry.js
├── css/                      # Stili
│   └── style.css
├── uploads/                  # File caricati
│   └── employees/
├── upload_photo.php          # Upload foto
├── delete_photo.php          # Eliminazione foto
└── README.md
```

## Configurazione Multi-Cliente

### Struttura Database Migliorata

**PRIMA (problematica):**
```
cliente1_masterPassword/
cliente1_employees/
cliente1_cantieri/
cliente1_dipendenti/
```

**DOPO (organizzata):**
```
cliente1/                     # Collezione principale
├── masterPassword/           # Documento per password master
├── employees/                # Documento per lista dipendenti
├── cantieri/                 # Documento per lista cantieri
├── categorie/                # Documento per categorie cantieri
└── dipendenti/               # Sottocollezione per dati dipendenti
    └── [nome_dipendente]/    # Documento per ogni dipendente
        ├── ore/              # Sottocollezione ore lavorative
        │   └── [data]/       # Documento per ogni giorno
        └── badge/            # Sottocollezione stati badge
            └── [data]/       # Documento per ogni giorno
```

### Setup per Nuovo Cliente

1. **Modifica configurazione cliente:**
   ```javascript
   // js/config/client-config.js
   export const CLIENT_ID = 'nome_nuovo_cliente';  // ← CAMBIA SOLO QUESTO
   ```

2. **Il sistema creerà automaticamente:**
   - Collezione principale con nome cliente
   - Sottostrutture organizzate
   - Password master di default: `admin`

3. **Vantaggi della nuova struttura:**
   - Database più pulito e organizzato
   - Facile backup per cliente
   - Migliore performance nelle query
   - Struttura logica e scalabile

## Funzionalità

### Amministratore
- Gestione dipendenti con foto
- Gestione cantieri e categorie
- Riepilogo ore con vista gerarchica/flat
- Export Excel con template
- Modifica attività dipendenti
- Cambio password master

### Dipendenti
- Inserimento ore per oggi/ieri
- Sistema badge con timbratura
- Gestione cantieri per categoria
- Attività PST personalizzate
- Report mensile personale
- Badge identificativo digitale

## Tecnologie

- **Frontend:** HTML5, CSS3, JavaScript ES6+, Bootstrap 5
- **Backend:** Firebase Firestore
- **Upload:** PHP per gestione foto
- **Export:** ExcelJS per report

## Sicurezza

- Autenticazione multi-livello
- Sessioni con timeout automatico
- Validazione lato client e server
- Protezione upload file
- Sanitizzazione input

## Responsive Design

- Design mobile-first
- Ottimizzato per tablet e desktop
- Touch-friendly per dispositivi mobili
- Badge digitale responsive