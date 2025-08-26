// Date utilities for formatting and validation

// Get today's date as YYYY-MM-DD string
export function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Get yesterday's date as YYYY-MM-DD string
export function getYesterdayString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

// Format date for display (Italian format)
export function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// Format date and time
export function formatDateTime(date) {
    if (!date) return '';
    
    try {
        const dateObj = date instanceof Date ? date : new Date(date);
        return dateObj.toLocaleDateString('it-IT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting datetime:', error);
        return '';
    }
}

// Get weekday name in Italian
export function getWeekday(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('it-IT', { weekday: 'long' });
    } catch (error) {
        console.error('Error getting weekday:', error);
        return '';
    }
}

// Check if date is allowed for employees (today or yesterday only)
export function isDateAllowed(dateString) {
    if (!dateString) return false;
    
    const today = getTodayString();
    const yesterday = getYesterdayString();
    
    return dateString === today || dateString === yesterday;
}

// Check if date is allowed for admin (any date within reasonable range)
export function isDateAllowedForAdmin(dateString) {
    if (!dateString) return false;
    
    try {
        const date = new Date(dateString);
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(today.getFullYear() + 1);
        
        return date >= oneYearAgo && date <= oneYearFromNow;
    } catch (error) {
        console.error('Error validating admin date:', error);
        return false;
    }
}

// Get month range (start and end dates)
export function getMonthRange(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

// Check if date is today
export function isToday(dateString) {
    return dateString === getTodayString();
}

// Check if date is yesterday
export function isYesterday(dateString) {
    return dateString === getYesterdayString();
}

// Get date difference in days
export function getDaysDifference(startDate, endDate) {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
        console.error('Error calculating days difference:', error);
        return 0;
    }
}

// Add days to a date
export function addDays(dateString, days) {
    try {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error adding days:', error);
        return dateString;
    }
}

// Subtract days from a date
export function subtractDays(dateString, days) {
    return addDays(dateString, -days);
}

// Check if date is weekend
export function isWeekend(dateString) {
    try {
        const date = new Date(dateString + 'T00:00:00');
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    } catch (error) {
        console.error('Error checking weekend:', error);
        return false;
    }
}

// Get month name in Italian
export function getMonthName(month) {
    const months = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    
    return months[month - 1] || '';
}

// Parse date string to Date object
export function parseDate(dateString) {
    if (!dateString) return null;
    
    try {
        // Handle YYYY-MM-DD format
        if (dateString.includes('-')) {
            return new Date(dateString + 'T00:00:00');
        }
        
        // Handle other formats
        return new Date(dateString);
    } catch (error) {
        console.error('Error parsing date:', error);
        return null;
    }
}