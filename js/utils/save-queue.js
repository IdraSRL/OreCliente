// Save queue utility for serializing database writes and avoiding race conditions
import { ErrorHandler } from './error-handler.js';
import { ConnectionMonitor } from '../services/connection-monitor.js';

export class SaveQueue {
    constructor() {
        this._saving = false;
        this._pending = false;
        this._lastTask = null;
        this._maxRetries = 3;
    }

    async save(task) {
        this._lastTask = task;
        if (this._saving) {
            this._pending = true;
            return;
        }
        
        this._saving = true;
        let retries = 0;

        try {
            while (retries <= this._maxRetries) {
                try {
                    await task();
                    break;
                } catch (error) {
                    retries++;
                    if (retries > this._maxRetries) {
                        throw error;
                    }
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        } catch (error) {
            ErrorHandler.logError(error, 'SaveQueue');

            // Add to retry queue if offline
            if (!ConnectionMonitor.isOnline) {
                ConnectionMonitor.addToRetryQueue(task, 'SaveQueue operation');
            }
            
            throw error; // Re-throw to allow caller to handle
        } finally {
            const shouldRunAgain = this._pending;
            this._pending = false;
            this._saving = false;
            
            if (shouldRunAgain && this._lastTask) {
                const lastTask = this._lastTask;
                this._lastTask = null;
                // Prevent immediate recursion
                setTimeout(() => this.save(lastTask), 100);
            }
        }
    }

    // Check if currently saving
    isSaving() {
        return this._saving;
    }

    // Check if there are pending saves
    hasPending() {
        return this._pending;
    }

    // Clear pending saves (use with caution)
    clearPending() {
        this._pending = false;
        this._lastTask = null;
    }
}