// Memory management utility for preventing leaks

export class MemoryManager {
    static activeListeners = new Map();
    static activeTimers = new Set();
    static activeObservers = new Set();
    
    // Register event listener for cleanup
    static addListener(element, event, handler, options = {}) {
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
        const listener = this.activeListeners.get(key);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.activeListeners.delete(key);
        }
    }
    
    // Register timer for cleanup
    static addTimer(timerId) {
        this.activeTimers.add(timerId);
        return timerId;
    }
    
    // Clear specific timer
    static clearTimer(timerId) {
        clearTimeout(timerId);
        clearInterval(timerId);
        this.activeTimers.delete(timerId);
    }
    
    // Register observer for cleanup
    static addObserver(observer) {
        this.activeObservers.add(observer);
        return observer;
    }
    
    // Disconnect specific observer
    static removeObserver(observer) {
        if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect();
            this.activeObservers.delete(observer);
        }
    }
    
    // Clean up all resources
    static cleanup() {
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
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Cleanup on visibility change (mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanup();
            }
        });
    }
}

// Initialize memory manager
MemoryManager.init();