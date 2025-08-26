// Activity management module for time entry
import { generateId } from '../utils/utils.js';
import { showToast, showConfirm } from '../utils/ui-utils.js';
import { TableRenderer } from '../ui/table-renderer.js';
import { minutesToHHMM, minutesToDecimal } from '../utils/time-utils.js';

export class ActivityManager {
    constructor(onDataChange) {
        this.activities = [];
        this.onDataChange = onDataChange;
    }

    setActivities(activities) {
        this.activities = Array.isArray(activities) ? activities : [];
        this.updateUI();
    }

    getActivities() {
        return [...this.activities];
    }

    async addActivity(activity) {
        if (!activity || !activity.nome) {
            throw new Error('Attività non valida');
        }

        // Se è un cantiere: sostituisce quello precedente con stesso cantiereId
        if (activity.tipo === 'cantiere' && activity.cantiereId) {
            const existingIndex = this.activities.findIndex(
                a => a.tipo === 'cantiere' && a.cantiereId === activity.cantiereId
            );
            
            if (existingIndex !== -1) {
                this.activities[existingIndex] = activity;
            } else {
                this.activities.push(activity);
            }
        } else {
            this.activities.push(activity);
        }

        this.updateUI();
        if (this.onDataChange) {
            await this.onDataChange();
        }
    }

    async updateActivity(activityId, field, value) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        if (field === 'minuti') {
            const minuti = parseInt(value, 10);
            if (!Number.isNaN(minuti) && minuti >= 0 && minuti <= 1440) {
                activity.minuti = minuti;
                activity.minutiEffettivi = Math.round(minuti / (activity.persone || 1));
            }
        } else if (field === 'persone') {
            const persone = parseInt(value, 10);
            if (!Number.isNaN(persone) && persone >= 1 && persone <= 50) {
                activity.persone = persone;
                activity.minutiEffettivi = Math.round((activity.minuti || 0) / persone);
            }
        } else if (field === 'note') {
            activity.note = value;
        }

        this.updateUI();
        if (this.onDataChange) {
            await this.onDataChange();
        }
    }

    async removeActivity(activityId) {
        const confirmed = await showConfirm(
            'Rimuovi Attività',
            'Sei sicuro di voler rimuovere questa attività?',
            'Rimuovi',
            'Annulla',
            'danger'
        );

        if (!confirmed) return;

        this.activities = this.activities.filter(a => a.id !== activityId);
        this.updateUI();
        
        if (this.onDataChange) {
            await this.onDataChange();
        }
    }

    updateUI() {
        this.updateActivitiesTable();
        this.updateStats();
    }

    updateActivitiesTable() {
        const tbody = document.querySelector('#activitiesTable tbody');
        if (tbody) {
            TableRenderer.renderActivitiesTable(tbody, this.activities);
        }

        const counter = document.getElementById('activityCount');
        if (counter) {
            counter.textContent = `${this.activities.length} attività`;
        }
    }

    updateStats() {
        const totalMinutes = this.activities.reduce((sum, activity) => {
            return sum + (activity.minutiEffettivi || activity.minuti || 0);
        }, 0);

        const totalHours = minutesToHHMM(totalMinutes);
        const totalDecimal = minutesToDecimal(totalMinutes);
        const totalActivities = this.activities.length;

        // Desktop stats
        this.updateStatElement('totalHours', totalHours);
        this.updateStatElement('totalDecimal', totalDecimal);
        this.updateStatElement('totalActivities', totalActivities);

        // Mobile stats
        this.updateStatElement('totalHoursMobile', totalHours);
        this.updateStatElement('totalDecimalMobile', totalDecimal);
        this.updateStatElement('totalActivitiesMobile', totalActivities);
    }

    updateStatElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    getTotalMinutes() {
        return this.activities.reduce((sum, activity) => {
            return sum + (activity.minutiEffettivi || activity.minuti || 0);
        }, 0);
    }

    getActivitiesByType(type) {
        return this.activities.filter(activity => activity.tipo === type);
    }

    clear() {
        this.activities = [];
        this.updateUI();
    }
}