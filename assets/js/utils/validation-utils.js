// Validation utilities

export function sanitizeString(str) {
    if (!str) return '';
    return str.toString().trim().replace(/[<>'"]/g, '');
}

export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validateCodiceFiscale(cf) {
    if (!cf || typeof cf !== 'string') return false;
    return cf.length === 16 && /^[A-Z0-9]+$/.test(cf.toUpperCase());
}

export function validateTelefono(phone) {
    if (!phone) return true;
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

export function validatePassword(password, minLength = 3) {
    if (!password) return false;
    return password.length >= minLength;
}

export function validateMinutes(value) {
    try {
        const num = parseInt(value);
        return !isNaN(num) && num >= 0 && num <= 1440;
    } catch (error) {
        return false;
    }
}

export function validatePersone(value) {
    try {
        const num = parseInt(value);
        return !isNaN(num) && num >= 1 && num <= 50;
    } catch (error) {
        return false;
    }
}

export function validateDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

export function validateRequired(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    return true;
}

export function validateMatricola(matricola) {
    if (!matricola) return true;
    return /^[A-Z0-9]{3,10}$/.test(matricola.toUpperCase());
}

export function validateColor(color) {
    if (!color) return false;
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}