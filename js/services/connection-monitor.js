// Connection monitoring service

export class ConnectionMonitor {
    static isOnline = navigator.onLine;
    static listeners = new Set();
    static retryQueue = [];
    
    static init() {
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
        setInterval(() => {
            this.checkConnectivity();
        }, 30000); // Check every 30 seconds
    }
    
    static addListener(callback) {
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
            const response = await fetch('/favicon.ico', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            const wasOnline = this.isOnline;
            this.isOnline = response.ok;
            
            if (!wasOnline && this.isOnline) {
                this.notifyListeners('online');
                this.processRetryQueue();
            } else if (wasOnline && !this.isOnline) {
                this.notifyListeners('offline');
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
        this.retryQueue.push({
            operation,
            context,
            timestamp: Date.now()
        });
        
        // Limit queue size
        if (this.retryQueue.length > 50) {
            this.retryQueue.shift();
        }
    }
    
    static async processRetryQueue() {
        const queue = [...this.retryQueue];
        this.retryQueue = [];
        
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
    
    static getStatus() {
        return {
            isOnline: this.isOnline,
            queueSize: this.retryQueue.length
        };
    }
}

// Initialize connection monitor
ConnectionMonitor.init();