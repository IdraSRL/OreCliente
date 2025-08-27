// Centralized error handling utility

export class ErrorHandler {
    static errorCounts = new Map();
    static maxErrorsPerMinute = 10;
    
    static logError(error, context = '') {
        // Rate limiting per prevenire spam di errori
        const now = Date.now();
        const key = `${context}_${now - (now % 60000)}`; // Raggruppa per minuto
        const count = this.errorCounts.get(key) || 0;
        
        if (count >= this.maxErrorsPerMinute) {
            console.warn(`Rate limit raggiunto per errori ${context}`);
            return;
        }
        
        this.errorCounts.set(key, count + 1);
        
        // Pulizia periodica della mappa
        if (this.errorCounts.size > 100) {
            const cutoff = now - 300000; // 5 minuti fa
            for (const [k] of this.errorCounts) {
                const timestamp = parseInt(k.split('_').pop());
                if (timestamp < cutoff) {
                    this.errorCounts.delete(k);
                }
            }
        }
        
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            context,
            message: error?.message || 'Errore sconosciuto',
            stack: error?.stack || 'Stack non disponibile',
            userAgent: navigator.userAgent
        };
        
        console.error('Application Error:', errorInfo);
        
        // In produzione, inviare a servizio di logging (con rate limiting)
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
            this.sendToLoggingService(errorInfo);
        }
    }
    
    static handleFirebaseError(error, operation = '') {
        if (!error) {
            return 'Errore sconosciuto';
        }
        
        let userMessage = 'Si è verificato un errore. Riprova.';
        
        const errorCode = error.code || error.message || '';
        
        switch (errorCode) {
            case 'permission-denied':
                userMessage = 'Accesso negato. Verifica i permessi.';
                break;
            case 'unavailable':
                userMessage = 'Servizio temporaneamente non disponibile.';
                break;
            case 'deadline-exceeded':
                userMessage = 'Operazione scaduta. Riprova.';
                break;
            case 'resource-exhausted':
                userMessage = 'Limite di utilizzo raggiunto.';
                break;
            case 'unauthenticated':
                userMessage = 'Sessione scaduta. Effettua nuovamente il login.';
                break;
            case 'not-found':
                userMessage = 'Risorsa non trovata.';
                break;
            default:
                if (error.message && error.message.includes('network')) {
                    userMessage = 'Errore di connessione. Verifica la rete.';
                } else if (error.message && error.message.includes('quota')) {
                    userMessage = 'Quota database superata. Contatta l\'amministratore.';
                }
        }
        
        this.logError(error, `Firebase ${operation}`);
        return userMessage;
    }
    
    static handleValidationError(errors, context = '') {
        if (!errors || typeof errors !== 'object') {
            return 'Errore di validazione';
        }
        
        const errorMessages = [];
        for (const [field, fieldErrors] of Object.entries(errors)) {
            if (Array.isArray(fieldErrors)) {
                errorMessages.push(`${field}: ${fieldErrors.join(', ')}`);
            }
        }
        
        const message = errorMessages.length > 0 ? errorMessages.join('; ') : 'Dati non validi';
        this.logError(new Error(message), `Validation ${context}`);
        return message;
    }
    
    static async sendToLoggingService(errorInfo) {
        try {
            // Implementazione base per logging remoto
            if (typeof fetch !== 'undefined') {
                await fetch('/api/log-error', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorInfo),
                    signal: AbortSignal.timeout(5000) // Timeout di 5 secondi
                });
            }
        } catch (e) {
            console.error('Failed to send error to logging service:', e);
        }
    }
    
    static createSafeWrapper(fn, context = 'unknown') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.logError(error, context);
                throw error;
            }
        };
    }
    
    static isNetworkError(error) {
        if (!error) return false;
        
        const networkIndicators = [
            'network',
            'fetch',
            'connection',
            'timeout',
            'offline',
            'unavailable'
        ];
        
        const message = (error.message || '').toLowerCase();
        return networkIndicators.some(indicator => message.includes(indicator));
    }
    
    static createErrorBoundary(component, fallbackUI) {
        return {
            ...component,
            errorBoundary: true,
            onError: (error) => {
                this.logError(error, 'Component Error');
                return fallbackUI;
            }
        };
    }
}