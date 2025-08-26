// Performance monitoring utility

export class PerformanceMonitor {
    static metrics = new Map();
    static observers = new Map();
    
    static startTimer(label) {
        this.metrics.set(label, {
            start: performance.now(),
            end: null,
            duration: null
        });
    }
    
    static endTimer(label) {
        const metric = this.metrics.get(label);
        if (metric) {
            metric.end = performance.now();
            metric.duration = metric.end - metric.start;
            
            // Log slow operations
            if (metric.duration > 1000) {
                console.warn(`Slow operation detected: ${label} took ${metric.duration.toFixed(2)}ms`);
            }
            
            return metric.duration;
        }
        return null;
    }
    
    static measureFunction(fn, label) {
        return async function(...args) {
            PerformanceMonitor.startTimer(label);
            try {
                const result = await fn.apply(this, args);
                return result;
            } finally {
                PerformanceMonitor.endTimer(label);
            }
        };
    }
    
    static observeElement(element, callback) {
        if (!window.IntersectionObserver) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (callback) callback(entry);
            });
        }, {
            threshold: 0.1
        });
        
        observer.observe(element);
        this.observers.set(element, observer);
        
        return observer;
    }
    
    static unobserveElement(element) {
        const observer = this.observers.get(element);
        if (observer) {
            observer.unobserve(element);
            observer.disconnect();
            this.observers.delete(element);
        }
    }
    
    static getMetrics() {
        const results = {};
        for (const [label, metric] of this.metrics) {
            if (metric.duration !== null) {
                results[label] = {
                    duration: metric.duration,
                    start: metric.start,
                    end: metric.end
                };
            }
        }
        return results;
    }
    
    static clearMetrics() {
        this.metrics.clear();
    }
    
    static logMemoryUsage() {
        if (performance.memory) {
            console.log('Memory Usage:', {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
            });
        }
    }
    
    static cleanup() {
        // Disconnect all observers
        for (const [element, observer] of this.observers) {
            observer.disconnect();
        }
        this.observers.clear();
        this.metrics.clear();
    }
}