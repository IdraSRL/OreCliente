// Time utilities for formatting and calculations

// Convert minutes to HH:MM format
export function minutesToHHMM(minutes) {
    if (!minutes || minutes < 0) return "00:00";
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Convert minutes to decimal hours
export function minutesToDecimal(minutes) {
    if (!minutes || minutes < 0) return "0.00";
    
    const decimal = minutes / 60;
    return decimal.toFixed(2);
}

// Convert HH:MM format to minutes
export function HHMMToMinutes(timeString) {
    if (!timeString || typeof timeString !== 'string') return 0;
    
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) return 0;
    if (hours < 0 || minutes < 0 || minutes >= 60) return 0;
    
    return (hours * 60) + minutes;
}

// Format time from Date object
export function formatTime(date) {
    if (!date || !(date instanceof Date)) return '00:00';
    
    return date.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate duration between two times
export function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    return Math.max(0, diffMinutes);
}

// Get current time as HH:MM string
export function getCurrentTimeString() {
    return formatTime(new Date());
}

// Add minutes to a time string (HH:MM)
export function addMinutesToTime(timeString, minutesToAdd) {
    const totalMinutes = HHMMToMinutes(timeString) + minutesToAdd;
    return minutesToHHMM(totalMinutes);
}

// Subtract minutes from a time string (HH:MM)
export function subtractMinutesFromTime(timeString, minutesToSubtract) {
    const totalMinutes = Math.max(0, HHMMToMinutes(timeString) - minutesToSubtract);
    return minutesToHHMM(totalMinutes);
}

// Check if time string is valid HH:MM format
export function isValidTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') return false;
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
}

// Convert decimal hours to minutes
export function decimalToMinutes(decimal) {
    if (!decimal || decimal < 0) return 0;
    
    return Math.round(decimal * 60);
}

// Format duration in a human-readable way
export function formatDuration(minutes) {
    if (!minutes || minutes < 0) return '0 minuti';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
        return `${mins} minuti`;
    } else if (mins === 0) {
        return `${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    } else {
        return `${hours} ${hours === 1 ? 'ora' : 'ore'} e ${mins} minuti`;
    }
}

// Get time difference in minutes between two HH:MM strings
export function getTimeDifference(startTime, endTime) {
    const startMinutes = HHMMToMinutes(startTime);
    const endMinutes = HHMMToMinutes(endTime);
    
    // Handle overnight times
    if (endMinutes < startMinutes) {
        return (24 * 60) - startMinutes + endMinutes;
    }
    
    return endMinutes - startMinutes;
}