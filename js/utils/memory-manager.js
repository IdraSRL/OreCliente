// Memory management utility for preventing leaks

export class MemoryManager {
    static activeListeners = new Map();
    static activeTimers = new Set();
    static activeObservers = new Set();
    static isInitialized = false;
    
    // Register event listener for cleanup
    static addListener(element, event, handler, options = {}) {
        if (!element || typeof element.addEventListener !== 'function') {
            console.warn('MemoryManager: elemento non valido per listener');
            return null;
        }
        
        if (typeof handler !== 'function') {
            console.warn('MemoryManager: handler deve essere una funzione');
            return null;
        }
        
        const key = `${element.constructor.name}-${event}-${Date.now()}`;
        element.addEventListener(event, handler, options);
        
        this.activeListeners.set(key, {
            element,
            event,
            handler,
            options
        });
        
        return key;
    }
    
    // Remove specific listener
    static removeListener(key) {
        if (!key) return;
        
        const listener = this.activeListeners.get(key);
        if (listener) {
            try {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            } catch (error) {
                console.warn('Errore rimozione listener:', error);
            }
            this.activeListeners.delete(key);
        }
    }
    
    // Register timer for cleanup
    static addTimer(timerId) {
        if (!timerId) return null;
        this.activeTimers.add(timerId);
        return timerId;
    }
    
    // Clear specific timer
    static clearTimer(timerId) {
        if (timerId) {
            try {
                clearTimeout(timerId);
                clearInterval(timerId);
            } catch (error) {
                console.warn('Errore pulizia timer:', error);
            }
        }
        this.activeTimers.delete(timerId);
    }
    
    // Register observer for cleanup
    static addObserver(observer) {
        if (!observer || typeof observer.disconnect !== 'function') {
            console.warn('MemoryManager: observer non valido');
            return null;
        }
        this.activeObservers.add(observer);
        return observer;
    }
    
    // Disconnect specific observer
    static removeObserver(observer) {
        if (observer && typeof observer.disconnect === 'function') {
            try {
                observer.disconnect();
            } catch (error) {
                console.warn('Errore disconnessione observer:', error);
            }
            this.activeObservers.delete(observer);
        }
    }
    
    // Clean up all resources
    static cleanup() {
        console.log(`MemoryManager cleanup: ${this.activeListeners.size} listeners, ${this.activeTimers.size} timers, ${this.activeObservers.size} observers`);
        
        // Remove all listeners
        for (const [key, listener] of this.activeListeners) {
            try {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            } catch (e) {
                console.warn('Error removing listener:', e);
            }
        }
        this.activeListeners.clear();
        
        // Clear all timers
        for (const timerId of this.activeTimers) {
            try {
                clearTimeout(timerId);
                clearInterval(timerId);
            } catch (e) {
                console.warn('Error clearing timer:', e);
            }
        }
        this.activeTimers.clear();
        
        // Disconnect all observers
        for (const observer of this.activeObservers) {
            try {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            } catch (e) {
                console.warn('Error disconnecting observer:', e);
            }
        }
        this.activeObservers.clear();
    }
    
    // Auto cleanup on page unload
    static init() {
        if (this.isInitialized) {
            return;
        }
        
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Cleanup on visibility change (mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Cleanup parziale quando la pagina diventa nascosta
                this.partialCleanup();
            }
        });
        
        this.isInitialized = true;
    }
    
    // Cleanup parziale per quando la pagina è nascosta
    static partialCleanup() {
        // Pulisci solo i timer non critici
        let cleanedTimers = 0;
        for (const timerId of this.activeTimers) {
            try {
                clearTimeout(timerId);
                cleanedTimers++;
            } catch (e) {
                // Ignora errori per timer già scaduti
            }
        }
        
        if (cleanedTimers > 0) {
            console.log(`MemoryManager: puliti ${cleanedTimers} timer durante visibilitychange`);
        }
    }
    
    // Get memory usage stats
    static getStats() {
        return {
            listeners: this.activeListeners.size,
            timers: this.activeTimers.size,
            observers: this.activeObservers.size,
            isInitialized: this.isInitialized
        };
    }
}

// Initialize memory manager
if (typeof window !== 'undefined') {
    MemoryManager.init();
}