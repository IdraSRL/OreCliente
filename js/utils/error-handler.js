// Centralized error handling utility

export class ErrorHandler {
    static logError(error, context = '') {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            context,
            message: error.message,
            stack: error.stack,
            userAgent: navigator.userAgent
        };
        
        console.error('Application Error:', errorInfo);
        
        // In produzione, inviare a servizio di logging
        if (process.env.NODE_ENV === 'production') {
            this.sendToLoggingService(errorInfo);
        }
    }
    
    static handleFirebaseError(error, operation = '') {
        let userMessage = 'Si è verificato un errore. Riprova.';
        
        switch (error.code) {
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
            default:
                if (error.message.includes('network')) {
                    userMessage = 'Errore di connessione. Verifica la rete.';
                }
        }
        
        this.logError(error, `Firebase ${operation}`);
        return userMessage;
    }
    
    static async sendToLoggingService(errorInfo) {
        try {
            // Implementare invio a servizio di logging esterno
            // await fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorInfo) });
        } catch (e) {
            console.error('Failed to send error to logging service:', e);
        }
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