// Time conversion utilities

export function minutesToHHMM(minutes) {
    if (!minutes || minutes < 0) return "00:00";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function minutesToDecimal(minutes) {
    if (!minutes || minutes < 0) return "0.00";
    return (minutes / 60).toFixed(2);
}

export function HHMMToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
}

export function formatTime(date) {
    if (!date) return '';
    try {
        return date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Errore formattazione ora:', error);
        return '';
    }
}

export function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    try {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        return Math.round(diffMs / (1000 * 60));
    } catch (error) {
        console.error('Errore calcolo durata:', error);
        return 0;
    }
}