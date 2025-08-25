// Date utilities

export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Errore formattazione data:', error);
        return dateString;
    }
}

export function getTodayString() {
    try {
        return new Date().toISOString().split('T')[0];
    } catch (error) {
        console.error('Errore generazione data oggi:', error);
        return '2024-01-01';
    }
}

export function getYesterdayString() {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    } catch (error) {
        console.error('Errore generazione data ieri:', error);
        return '2024-01-01';
    }
}

export function getMonthRange(year, month) {
    try {
        if (!year || !month || year < 1900 || year > 2100 || month < 1 || month > 12) {
            throw new Error('Anno o mese non validi');
        }
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    } catch (error) {
        console.error('Errore calcolo range mese:', error);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    }
}

export function isDateAllowed(dateString) {
    try {
        if (!dateString) return false;
        const today = getTodayString();
        const yesterday = getYesterdayString();
        return dateString === today || dateString === yesterday;
    } catch (error) {
        console.error('Errore verifica data consentita:', error);
        return false;
    }
}

export function isDateAllowedForAdmin(dateString) {
    try {
        if (!dateString) return false;
        const inputDate = new Date(dateString + 'T00:00:00');
        if (isNaN(inputDate.getTime())) return false;
        
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(today.getFullYear() + 1);
        
        return inputDate >= oneYearAgo && inputDate <= oneYearFromNow;
    } catch (error) {
        console.error('Errore verifica data admin:', error);
        return false;
    }
}

export function formatDateTime(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('it-IT');
    } catch (error) {
        console.error('Errore formattazione data/ora:', error);
        return dateString;
    }
}

export function getWeekday(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('it-IT', { weekday: 'long' });
    } catch (error) {
        console.error('Errore ottenimento giorno settimana:', error);
        return '';
    }
}