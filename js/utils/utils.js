// Main utilities - imports from specialized modules
export { minutesToHHMM, minutesToDecimal, HHMMToMinutes, formatTime, calculateDuration } from './time-utils.js';
export { formatDate, getTodayString, getYesterdayString, getMonthRange, isDateAllowed, isDateAllowedForAdmin, formatDateTime, getWeekday } from './date-utils.js';
export { sanitizeString, validateMinutes, validatePersone, validateEmail, validateCodiceFiscale, validatePassword, validateForm } from './validation-utils.js';
export { saveToStorage, loadFromStorage, removeFromStorage, clearStorage } from './storage-utils.js';
export { showToast, showGlobalLoading, showConfirm, showLoading, hideLoading } from './ui-utils.js';
export { ErrorHandler } from './error-handler.js';
export { MemoryManager } from './memory-manager.js';
export { PerformanceMonitor } from './performance-monitor.js';

// Performance
export function debounce(func, wait) {
    if (typeof func !== 'function') {
        console.error('debounce: primo parametro deve essere una funzione');
        return () => {};
    }
    
    const safeWait = Math.max(0, Math.min(wait || 300, 10000)); // Limita wait tra 0-10 secondi
    let timeout;
    
    return function executedFunction(...args) {
        try {
            const later = () => {
                clearTimeout(timeout);
                try {
                    func(...args);
                } catch (error) {
                    ErrorHandler.logError(error, 'Debounced function execution');
                }
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, safeWait);
        } catch (error) {
            ErrorHandler.logError(error, 'Debounce function');
        }
    };
}

// ID generation
export function generateId(baseName = 'item') {
    if (!baseName || typeof baseName !== 'string' || baseName.trim() === '') {
        baseName = 'item';
    }
    
    // Sanitizza baseName
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20) || 'item';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 9);
    
    return `${cleanBaseName}-${timestamp}-${random}`;
}

// Utility functions
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    try {
        // Usa JSON per oggetti semplici
        const jsonString = JSON.stringify(obj);
        if (jsonString === undefined) {
            console.warn('deepClone: oggetto non serializzabile');
            return obj;
        }
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn('Errore deep clone, fallback a shallow copy:', error);
        // Fallback a shallow copy
        if (typeof obj === 'object' && obj !== null) {
            return { ...obj };
        }
        return obj;
    }
}

// Format currency
export function formatCurrency(amount, currency = 'EUR') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return `0.00 ${currency}`;
    }
    
    try {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: currency
        }).format(amount);
    } catch (error) {
        console.error('Errore formattazione valuta:', error);
        return `${amount.toFixed(2)} ${currency}`;
    }
}

// Format file size
export function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
        return '0 Bytes';
    }
    
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    const size = bytes / Math.pow(k, i);
    const formattedSize = size < 10 ? size.toFixed(2) : size.toFixed(1);
    
    return formattedSize + ' ' + (sizes[i] || 'Bytes');
}

// Capitalize first letter
export function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (trimmed.length === 0) return '';
    
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// Generate random color
export function generateRandomColor() {
    const colors = [
        '#4285f4', '#34a853', '#fbbc04', '#ea4335',
        '#9c27b0', '#ff9800', '#795548', '#607d8b',
        '#e91e63', '#00bcd4', '#8bc34a', '#ffc107'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}