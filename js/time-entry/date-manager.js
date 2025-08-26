// Date management module for time entry
import { 
    getTodayString, 
    getYesterdayString, 
    formatDate, 
    isDateAllowed, 
    getWeekday 
} from '../utils/date-utils.js';
import { showToast } from '../utils/ui-utils.js';

export class DateManager {
    constructor(onDateChange) {
        this.currentDate = getTodayString();
        this.onDateChange = onDateChange;
        this.setupEventListeners();
        this.setCurrentDate(this.currentDate);
    }

    setupEventListeners() {
        const workDate = document.getElementById('workDate');
        if (workDate) {
            workDate.addEventListener('change', (e) => {
                this.validateAndSetDate(e.target.value);
            });
        }
    }

    validateAndSetDate(dateString) {
        if (!isDateAllowed(dateString)) {
            showToast('Puoi inserire ore solo per oggi o ieri', 'warning');
            const workDate = document.getElementById('workDate');
            if (workDate) workDate.value = this.currentDate;
            return false;
        }
        
        this.setCurrentDate(dateString);
        return true;
    }

    setCurrentDate(dateString) {
        this.currentDate = dateString;
        this.updateDateInput();
        this.updateDateDisplay();
        
        if (this.onDateChange) {
            this.onDateChange(dateString);
        }
    }

    updateDateInput() {
        const workDate = document.getElementById('workDate');
        if (workDate) {
            workDate.value = this.currentDate;
        }
    }

    updateDateDisplay() {
        const displayElement = document.getElementById('selectedDateDisplay');
        const badgeElement = document.getElementById('selectedDateBadge');

        if (!displayElement || !badgeElement) return;

        displayElement.textContent = formatDate(this.currentDate);

        if (this.currentDate === getTodayString()) {
            badgeElement.textContent = 'OGGI';
            badgeElement.className = 'badge bg-success';
        } else if (this.currentDate === getYesterdayString()) {
            badgeElement.textContent = 'IERI';
            badgeElement.className = 'badge bg-warning';
        } else {
            badgeElement.textContent = getWeekday(this.currentDate).toUpperCase();
            badgeElement.className = 'badge bg-info';
        }
    }

    getCurrentDate() {
        return this.currentDate;
    }

    isToday() {
        return this.currentDate === getTodayString();
    }

    isYesterday() {
        return this.currentDate === getYesterdayString();
    }

    setToday() {
        this.setCurrentDate(getTodayString());
    }

    setYesterday() {
        this.setCurrentDate(getYesterdayString());
    }
}