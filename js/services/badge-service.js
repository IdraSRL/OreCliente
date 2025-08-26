// Badge service for managing employee time tracking and badge states (session-based)

import { FirestoreService } from './firestore-service.js';
import { formatTime, calculateDuration, minutesToHHMM } from '../utils/time-utils.js';
import { getTodayString } from '../utils/date-utils.js';

export class BadgeService {
  constructor(employeeId) {
    this.employeeId = employeeId;
    this._unsubscribe = null;
    this._open = null; // doc open
  }

  async startWatcher(onStatusChange) {
    const today = getTodayString();
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    this._unsubscribe = await FirestoreService.watchOpenBadgeSession(this.employeeId, today, (open) => {
      this._open = open;
      if (typeof onStatusChange === 'function') onStatusChange({ isOpen: !!open, session: open });
    });
  }

  stopWatcher() {
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = null;
    this._open = null;
  }

  isActive() { return !!this._open; }

  async clockIn() {
    if (this._open) {
      const t = this._toDate(this._open.entryTime);
      return { sessionId: this._open.id, formattedTime: formatTime(t) };
    }
    const now = new Date();
    const dateISO = getTodayString();
    const sessionId = await FirestoreService.createBadgeSession(this.employeeId, { dateISO, entryTime: now });
    return { sessionId, formattedTime: formatTime(now) };
  }

  async clockOut() {
    if (!this._open) throw new Error('Nessuna sessione aperta');
    const now = new Date();
    const start = this._toDate(this._open.entryTime);
    const minutes = calculateDuration(start, now);
    await FirestoreService.closeBadgeSession(this.employeeId, this._open.id, { exitTime: now, minutes, dateISO: getTodayString() });
    return {
      startTime: start,
      endTime: now,
      sessionMinutes: minutes,
      formattedStartTime: formatTime(start),
      formattedEndTime: formatTime(now),
      formattedDuration: minutesToHHMM(minutes),
    };
  }

  _toDate(v) {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (v && typeof v.toDate === 'function') return v.toDate();
    return new Date(v);
  }

  getFormattedTotalHours() {
    if (!this._open) return minutesToHHMM(0);
    const start = this._toDate(this._open.entryTime);
    const now = new Date();
    return minutesToHHMM(calculateDuration(start, now));
  }

  createBadgeActivity(s) {
    return {
      id: `badge-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
      nome: `Badge ${s.formattedStartTime} - ${s.formattedEndTime}`,
      minuti: s.sessionMinutes,
      persone: 1,
      minutiEffettivi: s.sessionMinutes,
      tipo: 'badge',
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
    };
  }
}
