// Connection monitoring service

export class ConnectionMonitor {
    static isOnline = navigator.onLine;
    static listeners = new Set();
    static retryQueue = [];
    static maxRetryQueueSize = 100;
    static connectivityCheckInterval = null;
    
    static init() {
        // Evita doppia inizializzazione
        if (this.connectivityCheckInterval) {
            return;
        }
        
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online');
            this.processRetryQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline');
        });
        
        // Periodic connectivity check
        this.connectivityCheckInterval = setInterval(() => {
            this.checkConnectivity();
        }, 30000); // Check every 30 seconds
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    static addListener(callback) {
        if (typeof callback !== 'function') {
            console.warn('ConnectionMonitor: callback deve essere una funzione');
            return () => {};
        }
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    static notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status, this.isOnline);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }
    
    static async checkConnectivity() {
        try {
            // Test di connettività con timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                cache: 'no-cache',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const wasOnline = this.isOnline;
            this.isOnline = true; // Se arriviamo qui, siamo online
            
            if (!wasOnline && this.isOnline) {
                this.notifyListeners('online');
                this.processRetryQueue();
            }
        } catch (error) {
            const wasOnline = this.isOnline;
            this.isOnline = false;
            
            if (wasOnline) {
                this.notifyListeners('offline');
            }
        }
    }
    
    static addToRetryQueue(operation, context = '') {
        if (typeof operation !== 'function') {
            console.warn('ConnectionMonitor: operation deve essere una funzione');
            return;
        }
        
        // Limita dimensione coda
        if (this.retryQueue.length >= this.maxRetryQueueSize) {
            console.warn('Retry queue piena, rimuovo operazione più vecchia');
            this.retryQueue.shift();
        }
        
        this.retryQueue.push({
            operation,
            context,
            timestamp: Date.now()
        });
    }
    
    static async processRetryQueue() {
        if (this.retryQueue.length === 0) {
            return;
        }
        
        const queue = [...this.retryQueue];
        this.retryQueue = [];
        
        console.log(`Processando ${queue.length} operazioni in coda...`);
        
        for (const item of queue) {
            try {
                await item.operation();
                console.log(`Retry successful for: ${item.context}`);
            } catch (error) {
                console.error(`Retry failed for: ${item.context}`, error);
                // Re-add to queue if still relevant (less than 5 minutes old)
                if (Date.now() - item.timestamp < 300000) {
                    this.retryQueue.push(item);
                }
            }
        }
    }
    
    static cleanup() {
        if (this.connectivityCheckInterval) {
            clearInterval(this.connectivityCheckInterval);
            this.connectivityCheckInterval = null;
        }
        this.listeners.clear();
        this.retryQueue = [];
    }
    
    static getStatus() {
        return {
            isOnline: this.isOnline,
            queueSize: this.retryQueue.length
        };
    }
}

// Initialize connection monitor
if (typeof window !== 'undefined') {
    ConnectionMonitor.init();
}