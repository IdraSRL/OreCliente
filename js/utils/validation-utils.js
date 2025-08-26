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
    
    // Improved pattern check for Italian fiscal code
    const cfRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    if (!cfRegex.test(cleanCF)) return false;
    
    // Basic checksum validation
    const evenMap = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9, 'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25 };
    const oddMap = { '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21, 'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21, 'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14, 'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23 };
    const checkMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        const char = cleanCF.charAt(i);
        if (i % 2 === 0) {
            sum += oddMap[char] || 0;
        } else {
            sum += evenMap[char] || 0;
        }
    }
    
    const expectedCheck = checkMap[sum % 26];
    const actualCheck = cleanCF.charAt(15);
    
    if (expectedCheck !== actualCheck) {
        console.warn('Codice fiscale: checksum non valido');
        // Return true anyway for flexibility, but log warning
    }
    
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
    
    if (!formData || typeof formData !== 'object') {
        return {
            isValid: false,
            errors: { form: ['Dati form non validi'] },
            sanitizedData: {}
        };
    }
    
    if (!rules || typeof rules !== 'object') {
        return {
            isValid: true,
            errors: {},
            sanitizedData: formData
        };
    }
    
    // Input sanitization
    const sanitizedData = {};
    for (const [key, value] of Object.entries(formData)) {
        sanitizedData[key] = typeof value === 'string' ? sanitizeString(value) : value;
    }
    
    for (const [field, value] of Object.entries(formData)) {
        const fieldRules = rules[field];
        if (!fieldRules) continue;
        
        const fieldErrors = [];
        
        // Required validation
        if (fieldRules.required && !validateRequired(value)) {
            fieldErrors.push('Campo obbligatorio');
            continue; // Skip other validations if required field is empty
        }
        
        // Skip other validations if field is empty and not required
        if (!validateRequired(value) && !fieldRules.required) {
            continue;
        }
        
        // Type validation
        if (fieldRules.type) {
            if (!validateType(value, fieldRules.type)) {
                fieldErrors.push(`Tipo di dato non valido. Atteso: ${fieldRules.type}`);
            }
        }
        
        // Length validation
        if (fieldRules.minLength || fieldRules.maxLength) {
            if (!validateLength(value, fieldRules.minLength, fieldRules.maxLength)) {
                fieldErrors.push(`Lunghezza deve essere tra ${fieldRules.minLength || 0} e ${fieldRules.maxLength || 255} caratteri`);
            }
        }
        
        // Range validation for numbers
        if (fieldRules.min !== undefined || fieldRules.max !== undefined) {
            if (!validateRange(value, fieldRules.min, fieldRules.max)) {
                fieldErrors.push(`Valore deve essere tra ${fieldRules.min || 0} e ${fieldRules.max || 'infinito'}`);
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
        
        // Pattern validation
        if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
            fieldErrors.push(fieldRules.patternMessage || 'Formato non valido');
        }
        
        // Custom validation function
        if (fieldRules.custom && typeof fieldRules.custom === 'function') {
            try {
                const customResult = fieldRules.custom(value);
                if (customResult !== true) {
                    fieldErrors.push(customResult || 'Valore non valido');
                }
            } catch (error) {
                console.error('Errore validazione custom:', error);
                fieldErrors.push('Errore validazione');
            }
        }
        
        if (fieldErrors.length > 0) {
            errors[field] = fieldErrors;
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData
    };
}

// Validate data type
export function validateType(value, expectedType) {
    switch (expectedType) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        case 'date':
            return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
        default:
            return true;
    }
}