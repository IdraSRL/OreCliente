// Badge service for managing employee time tracking and badge states

import { FirestoreService } from './firestore-service.js';
import { formatTime, calculateDuration, minutesToHHMM } from '../utils/time-utils.js';
import { getTodayString } from '../utils/date-utils.js';
import { generateId } from '../utils/utils.js';

export class BadgeService {
    constructor(employeeId) {
        this.employeeId = employeeId;
        this.badgeState = {
            isActive: false,
            entryTime: null,
            exitTime: null,
            totalMinutes: 0,
            sessions: []
        };
    }
    
    // Load badge state from Firestore
    async loadBadgeState() {
        try {
            const today = getTodayString();
            const savedState = await FirestoreService.getBadgeState(this.employeeId, today);
            
            if (savedState) {
                this.badgeState = {
                    ...this.badgeState,
                    ...savedState
                };
                
                // Convert string dates back to Date objects
                if (this.badgeState.entryTime) {
                    this.badgeState.entryTime = new Date(this.badgeState.entryTime);
                }
                if (this.badgeState.exitTime) {
                    this.badgeState.exitTime = new Date(this.badgeState.exitTime);
                }
                
                // Convert session times
                if (this.badgeState.sessions) {
                    this.badgeState.sessions = this.badgeState.sessions.map(session => ({
                        ...session,
                        startTime: new Date(session.startTime),
                        endTime: session.endTime ? new Date(session.endTime) : null
                    }));
                }
            }
        } catch (error) {
            console.error('Error loading badge state:', error);
            // Continue with default state
        }
    }
    
    // Save badge state to Firestore
    async saveBadgeState() {
        try {
            const today = getTodayString();
            await FirestoreService.saveBadgeState(this.employeeId, today, this.badgeState);
        } catch (error) {
            console.error('Error saving badge state:', error);
            throw error;
        }
    }
    
    // Clock in (start work session)
    async clockIn() {
        const now = new Date();
        
        this.badgeState.isActive = true;
        this.badgeState.entryTime = now;
        this.badgeState.exitTime = null;
        
        // Start new session
        const newSession = {
            id: generateId('session'),
            startTime: now,
            endTime: null,
            minutes: 0
        };
        
        this.badgeState.sessions = this.badgeState.sessions || [];
        this.badgeState.sessions.push(newSession);
        
        await this.saveBadgeState();
        
        return {
            time: now,
            formattedTime: formatTime(now)
        };
    }
    
    // Clock out (end work session)
    async clockOut() {
        if (!this.badgeState.isActive || !this.badgeState.entryTime) {
            throw new Error('Non sei attualmente in servizio');
        }
        
        const now = new Date();
        const sessionMinutes = calculateDuration(this.badgeState.entryTime, now);
        
        this.badgeState.isActive = false;
        this.badgeState.exitTime = now;
        this.badgeState.totalMinutes += sessionMinutes;
        
        // Update current session
        const currentSession = this.badgeState.sessions[this.badgeState.sessions.length - 1];
        if (currentSession && !currentSession.endTime) {
            currentSession.endTime = now;
            currentSession.minutes = sessionMinutes;
        }
        
        await this.saveBadgeState();
        
        return {
            startTime: this.badgeState.entryTime,
            endTime: now,
            sessionMinutes,
            totalMinutes: this.badgeState.totalMinutes,
            formattedStartTime: formatTime(this.badgeState.entryTime),
            formattedEndTime: formatTime(now),
            formattedDuration: minutesToHHMM(sessionMinutes)
        };
    }
    
    // Check if currently clocked in
    isActive() {
        return this.badgeState.isActive;
    }
    
    // Get current session duration
    getCurrentSessionDuration() {
        if (!this.badgeState.isActive || !this.badgeState.entryTime) {
            return 0;
        }
        
        return calculateDuration(this.badgeState.entryTime, new Date());
    }
    
    // Get formatted current session duration
    getFormattedCurrentSessionDuration() {
        return minutesToHHMM(this.getCurrentSessionDuration());
    }
    
    // Get total hours worked today
    getTotalHours() {
        let total = this.badgeState.totalMinutes;
        
        // Add current session if active
        if (this.badgeState.isActive) {
            total += this.getCurrentSessionDuration();
        }
        
        return total;
    }
    
    // Get formatted total hours
    getFormattedTotalHours() {
        return minutesToHHMM(this.getTotalHours());
    }
    
    // Get entry time
    getEntryTime() {
        return this.badgeState.entryTime;
    }
    
    // Get formatted entry time
    getFormattedEntryTime() {
        if (!this.badgeState.entryTime) return '';
        return formatTime(this.badgeState.entryTime);
    }
    
    // Get exit time
    getExitTime() {
        return this.badgeState.exitTime;
    }
    
    // Get formatted exit time
    getFormattedExitTime() {
        if (!this.badgeState.exitTime) return '';
        return formatTime(this.badgeState.exitTime);
    }
    
    // Get all sessions for today
    getSessions() {
        return this.badgeState.sessions || [];
    }
    
    // Get badge state for external access
    getBadgeState() {
        return { ...this.badgeState };
    }
    
    // Update badge state (for admin modifications)
    updateBadgeState(newState) {
        this.badgeState = { ...this.badgeState, ...newState };
    }
    
    // Create badge activity for time entry
    createBadgeActivity(sessionData) {
        return {
            id: generateId('badge'),
            nome: `Badge ${sessionData.formattedStartTime} - ${sessionData.formattedEndTime}`,
            minuti: sessionData.sessionMinutes,
            persone: 1,
            minutiEffettivi: sessionData.sessionMinutes,
            tipo: 'badge',
            startTime: sessionData.startTime.toISOString(),
            endTime: sessionData.endTime.toISOString()
        };
    }
    
    // Reset badge state (for new day or admin reset)
    async resetBadgeState() {
        this.badgeState = {
            isActive: false,
            entryTime: null,
            exitTime: null,
            totalMinutes: 0,
            sessions: []
        };
        
        await this.saveBadgeState();
    }
    
    // Get badge statistics
    getBadgeStats() {
        const sessions = this.getSessions();
        const completedSessions = sessions.filter(s => s.endTime);
        
        return {
            totalSessions: sessions.length,
            completedSessions: completedSessions.length,
            activeSessions: sessions.length - completedSessions.length,
            totalMinutes: this.getTotalHours(),
            averageSessionMinutes: completedSessions.length > 0 
                ? Math.round(completedSessions.reduce((sum, s) => sum + s.minutes, 0) / completedSessions.length)
                : 0,
            isCurrentlyActive: this.isActive()
        };
    }
    
    // Update badge minutes from activities (for consistency)
    updateBadgeMinutesFromActivities(dayData) {
        if (!dayData || !dayData.attivita) return;
        
        const badgeActivities = dayData.attivita.filter(activity => activity.tipo === 'badge');
        const totalBadgeMinutes = badgeActivities.reduce((sum, activity) => 
            sum + (activity.minutiEffettivi || activity.minuti || 0), 0);
        
        // Update total minutes to match activities
        this.badgeState.totalMinutes = totalBadgeMinutes;
    }
    
    // Validate badge state consistency
    validateBadgeState() {
        const issues = [];
        
        if (this.badgeState.isActive && !this.badgeState.entryTime) {
            issues.push('Badge attivo ma senza orario di entrata');
        }
        
        if (!this.badgeState.isActive && this.badgeState.entryTime && !this.badgeState.exitTime) {
            issues.push('Badge inattivo ma senza orario di uscita');
        }
        
        const sessions = this.getSessions();
        const activeSessions = sessions.filter(s => !s.endTime);
        
        if (activeSessions.length > 1) {
            issues.push('Più sessioni attive contemporaneamente');
        }
        
        if (this.badgeState.isActive && activeSessions.length === 0) {
            issues.push('Badge attivo ma nessuna sessione attiva');
        }
        
        return {
            isValid: issues.length === 0,
            issues
        };
    }
}