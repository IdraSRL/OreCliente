// Badge management module for time entry
import { BadgeService } from '../services/badge-service.js';
import { showToast, showGlobalLoading } from '../utils/ui-utils.js';
import { ButtonUtils } from '../ui/button-utils.js';

export class BadgeManager {
    constructor(employeeId, onActivityAdd) {
        this.employeeId = employeeId;
        this.onActivityAdd = onActivityAdd;
        this.badgeService = null;
        this.badgeTimer = null;
    }

    async init() {
        if (!this.employeeId) {
            throw new Error('Employee ID is required');
        }

        this.badgeService = new BadgeService(this.employeeId);
        await this.badgeService.startWatcher(({ isOpen }) => {
            this.updateBadgeUI(isOpen);
        });

        this.startBadgeTimer();
        this.updateBadgeUI();
    }

    updateBadgeUI(isActive = null) {
        const btn = document.getElementById('badgeBtn');
        const badgeText = document.getElementById('badgeText');

        if (!btn || !badgeText) return;

        const active = isActive !== null ? isActive : (this.badgeService && this.badgeService.isActive());
        
        if (active) {
            btn.className = 'btn btn-danger w-100';
            badgeText.textContent = 'Uscita';
        } else {
            btn.className = 'btn btn-warning w-100';
            badgeText.textContent = 'Entrata';
        }
    }

    async toggleBadge() {
        try {
            const btn = document.getElementById('badgeBtn');
            if (btn) ButtonUtils.showLoading(btn, 'Elaborazione...');

            if (!this.badgeService.isActive()) {
                const result = await this.badgeService.clockIn();
                this.updateBadgeUI();
                showToast(`Entrata registrata alle ${result.formattedTime}`, 'success');
            } else {
                const result = await this.badgeService.clockOut();
                const badgeActivity = this.badgeService.createBadgeActivity(result);
                
                if (this.onActivityAdd) {
                    await this.onActivityAdd(badgeActivity);
                }
                
                this.updateBadgeUI();
                showToast(`Uscita registrata: ${result.formattedDuration}`, 'success');
            }
        } catch (error) {
            console.error('Errore toggle badge:', error);
            showToast(error.message, 'error');
        } finally {
            const btn = document.getElementById('badgeBtn');
            if (btn) {
                ButtonUtils.hideLoading(btn);
                setTimeout(() => this.updateBadgeUI(), 100);
            }
        }
    }

    startBadgeTimer() {
        if (this.badgeTimer) clearInterval(this.badgeTimer);
        
        this.badgeTimer = setInterval(() => this.updateBadgeUI(), 30000);
        this.updateBadgeUI();
    }

    destroy() {
        if (this.badgeTimer) {
            clearInterval(this.badgeTimer);
            this.badgeTimer = null;
        }

        if (this.badgeService) {
            this.badgeService.stopWatcher();
            this.badgeService = null;
        }
    }
}