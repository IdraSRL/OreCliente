// Validation utilities for form inputs and data

import { VALIDATION_RULES } from '../config/constants.js';

// Sanitize string input
export function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str.trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 255); // Limit length
}

// Validate minutes input
export function validateMinutes(minutes) {
    const num = parseInt(minutes, 10);
    return !isNaN(num) && 
           num >= VALIDATION_RULES.MIN_MINUTES && 
           num <= VALIDATION_RULES.MAX_MINUTES;
}

// Validate number of people
export function validatePersone(persone) {
    const num = parseInt(persone, 10);
    return !isNaN(num) && 
           num >= VALIDATION_RULES.MIN_PERSONE && 
           num <= VALIDATION_RULES.MAX_PERSONE;
}

// Validate email format
export function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

// Validate Italian fiscal code (Codice Fiscale)
export function validateCodiceFiscale(cf) {
    if (!cf || typeof cf !== 'string') return false;
    
    const cleanCF = cf.trim().toUpperCase();
    
    // Check length
    if (cleanCF.length !== VALIDATION_RULES.CODICE_FISCALE_LENGTH) return false;
    
    // Basic pattern check (16 alphanumeric characters)
    const cfRegex = /^[A-Z0-9]{16}$/;
    if (!cfRegex.test(cleanCF)) return false;
    
    // More detailed validation could be added here
    // For now, we'll accept any 16-character alphanumeric string
    return true;
}

// Validate password strength
export function validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    
    return password.length >= VALIDATION_RULES.PASSWORD_MIN_LENGTH;
}

// Validate matricola format
export function validateMatricola(matricola) {
    if (!matricola || typeof matricola !== 'string') return false;
    
    const cleanMatricola = matricola.trim().toUpperCase();
    return VALIDATION_RULES.MATRICOLA_PATTERN.test(cleanMatricola);
}

// Validate color hex format
export function validateColor(color) {
    if (!color || typeof color !== 'string') return false;
    
    return VALIDATION_RULES.COLOR_PATTERN.test(color.trim());
}

// Validate phone number (Italian format)
export function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // Italian phone number patterns
    const phoneRegex = /^(\+39)?[0-9]{8,11}$/;
    return phoneRegex.test(cleanPhone);
}

// Validate date string (YYYY-MM-DD format)
export function validateDateString(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    const date = new Date(dateString + 'T00:00:00');
    return !isNaN(date.getTime());
}

// Validate required field
export function validateRequired(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    return true;
}

// Validate string length
export function validateLength(str, minLength = 0, maxLength = 255) {
    if (!str || typeof str !== 'string') return false;
    
    const length = str.trim().length;
    return length >= minLength && length <= maxLength;
}

// Validate numeric range
export function validateRange(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
}

// Validate file type
export function validateFileType(file, allowedTypes = []) {
    if (!file || !file.type) return false;
    if (allowedTypes.length === 0) return true;
    
    return allowedTypes.includes(file.type);
}

// Validate file size
export function validateFileSize(file, maxSize = 2 * 1024 * 1024) { // 2MB default
    if (!file || !file.size) return false;
    
    return file.size <= maxSize;
}

// Comprehensive form validation
export function validateForm(formData, rules) {
    const errors = {};
    
    for (const [field, value] of Object.entries(formData)) {
        const fieldRules = rules[field];
        if (!fieldRules) continue;
        
        const fieldErrors = [];
        
        // Required validation
        if (fieldRules.required && !validateRequired(value)) {
            fieldErrors.push('Campo obbligatorio');
        }
        
        // Skip other validations if field is empty and not required
        if (!validateRequired(value) && !fieldRules.required) {
            continue;
        }
        
        // Length validation
        if (fieldRules.minLength || fieldRules.maxLength) {
            if (!validateLength(value, fieldRules.minLength, fieldRules.maxLength)) {
                fieldErrors.push(`Lunghezza deve essere tra ${fieldRules.minLength || 0} e ${fieldRules.maxLength || 255} caratteri`);
            }
        }
        
        // Email validation
        if (fieldRules.email && !validateEmail(value)) {
            fieldErrors.push('Formato email non valido');
        }
        
        // Phone validation
        if (fieldRules.phone && !validatePhone(value)) {
            fieldErrors.push('Formato telefono non valido');
        }
        
        // Custom validation function
        if (fieldRules.custom && typeof fieldRules.custom === 'function') {
            const customResult = fieldRules.custom(value);
            if (customResult !== true) {
                fieldErrors.push(customResult || 'Valore non valido');
            }
        }
        
        if (fieldErrors.length > 0) {
            errors[field] = fieldErrors;
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}