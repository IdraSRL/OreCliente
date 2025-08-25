import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    generateId
} from '../utils/utils.js';
import { getTodayString } from '../utils/date-utils.js';
import { minutesToHHMM } from '../utils/time-utils.js';

export class BadgeService {
    constructor(employeeId) {
        this.employeeId = employeeId;
        this.currentSessionStart = null;
        this.cachedBadgeMinutes = 0;
    }

    async loadBadgeState(currentData = null) {
        try {
            const today = getTodayString();
            
            // Carica stato badge dal database
            const badgeData = await FirestoreService.getBadgeState(this.employeeId, today);
            
            // Inizializza stato badge
            this.badgeState = badgeData || {
                isActive: false,
                entryTime: null,
                exitTime: null
            };
            
            // Protezione anti-reset: se il badge è attivo da più di 12 ore, resettalo
            if (this.badgeState.isActive && this.badgeState.entryTime) {
                const entryTime = new Date(this.badgeState.entryTime);
                const now = new Date();
                const diffHours = (now - entryTime) / (1000 * 60 * 60);
                
                if (diffHours > 12) {
                    console.warn('Badge attivo da più di 12 ore, reset automatico');
                    this.badgeState.isActive = false;
                    this.badgeState.entryTime = null;
                    await this.saveBadgeState();
                }
            }
            
            // Imposta il tempo di inizio sessione corrente se attivo
            if (this.badgeState.isActive && this.badgeState.entryTime) {
                this.currentSessionStart = new Date(this.badgeState.entryTime);
            }
            
            // Calcola minuti badge dalle attività se disponibili
            if (currentData) {
                this.updateBadgeMinutesFromActivities(currentData);
            }
            
        } catch (error) {
            console.error('Errore caricamento stato badge:', error);
            // Fallback: inizializza stato di default
            this.badgeState = {
                isActive: false,
                entryTime: null,
                exitTime: null
            };
        }
    }
    
    // Calcola i minuti badge dalle attività della giornata
    updateBadgeMinutesFromActivities(currentData) {
        if (!currentData || !currentData.attivita) {
            this.cachedBadgeMinutes = 0;
            return;
        }
        
        let totalBadgeMinutes = 0;
        currentData.attivita.forEach(activity => {
            if (activity.tipo === 'badge') {
                totalBadgeMinutes += activity.minutiEffettivi || activity.minuti || 0;
            }
        });
        
        this.cachedBadgeMinutes = totalBadgeMinutes;
    }

    async saveBadgeState() {
        try {
            const today = getTodayString();
            await FirestoreService.saveBadgeState(this.employeeId, today, this.badgeState);
        } catch (error) {
            console.error('Errore salvataggio stato badge:', error);
            throw error;
        }
    }

    async clockIn() {
        if (this.badgeState.isActive) {
            throw new Error('Badge già attivo');
        }

        const now = new Date();
        this.badgeState.isActive = true;
        this.badgeState.entryTime = now.toISOString();
        this.badgeState.exitTime = null;
        this.currentSessionStart = now;
        
        await this.saveBadgeState();
        return {
            entryTime: this.badgeState.entryTime,
            formattedTime: now.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }

    async clockOut() {
        if (!this.badgeState.isActive) {
            throw new Error('Badge non attivo');
        }

        const now = new Date();
        this.badgeState.isActive = false;
        this.badgeState.exitTime = now.toISOString();
        
        // Calcola minuti della sessione
        let sessionMinutes = 0;
        if (this.badgeState.entryTime) {
            const entryTime = new Date(this.badgeState.entryTime);
            const diffMs = now - entryTime;
            sessionMinutes = Math.round(diffMs / (1000 * 60));
        }
        
        this.currentSessionStart = null;
        await this.saveBadgeState();
        
        return {
            sessionMinutes,
            entryTime: this.badgeState.entryTime,
            exitTime: this.badgeState.exitTime,
            formattedStartTime: new Date(this.badgeState.entryTime).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            formattedEndTime: now.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }

    createBadgeActivity(sessionData) {
        const entryTime = new Date(sessionData.entryTime);
        const exitTime = new Date(sessionData.exitTime);
        
        const startTime = entryTime.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const endTime = exitTime.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return {
            id: generateId('badge'),
            nome: `Timbratura (${startTime} - ${endTime})`,
            minuti: sessionData.sessionMinutes,
            persone: 1,
            minutiEffettivi: sessionData.sessionMinutes,
            tipo: 'badge',
            categoria: 'Sistema'
        };
    }

    getBadgeState() {
        return { ...this.badgeState };
    }

    getFormattedTotalHours() {
        return minutesToHHMM(this.cachedBadgeMinutes);
    }
    
    getTotalMinutes() {
        return this.cachedBadgeMinutes;
    }

    isActive() {
        return this.badgeState.isActive;
    }

    getEntryTime() {
        return this.badgeState.entryTime ? new Date(this.badgeState.entryTime) : null;
    }

    getExitTime() {
        return this.badgeState.exitTime ? new Date(this.badgeState.exitTime) : null;
    }

    getCurrentSessionDuration() {
        if (!this.isActive() || !this.currentSessionStart) {
            return 0;
        }
        
        const now = new Date();
        const diffMs = now - this.currentSessionStart;
        return Math.round(diffMs / (1000 * 60));
    }

    getFormattedCurrentSessionDuration() {
        return minutesToHHMM(this.getCurrentSessionDuration());
    }

    getFormattedEntryTime() {
        if (!this.badgeState.entryTime) return null;
        return new Date(this.badgeState.entryTime).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}