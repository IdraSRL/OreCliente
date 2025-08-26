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
    
    let timeout;
    return function executedFunction(...args) {
        try {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, Math.max(0, wait || 300));
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
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'item';
    return `${cleanBaseName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Utility functions
export function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (error) {
        console.error('Errore deep clone:', error);
        return obj;
    }
}

// Format currency
export function formatCurrency(amount, currency = 'EUR') {
    try {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: currency
        }).format(amount);
    } catch (error) {
        console.error('Errore formattazione valuta:', error);
        return `${amount} ${currency}`;
    }
}

// Format file size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Capitalize first letter
export function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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