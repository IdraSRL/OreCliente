import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';

import { db } from '../config/firebase-config.js';
import { VERSION } from '../config/version.js';
import { DB_STRUCTURE } from '../config/client-config.js';

export class FirestoreService {
  // Retry helper
  static async _retry(fn, tries = 3, context = 'unknown') {
    let last;
    for (let i = 0; i <= tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        console.warn(`Retry ${i + 1}/${tries + 1} failed for ${context}:`, e.message);
        if (i < tries) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000); // Exponential backoff
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw new Error(`Operazione ${context} fallita dopo ${tries + 1} tentativi: ${last?.message || 'Errore sconosciuto'}`);
  }

  // === TEST CONNESSIONE ===
  static async testConnection() {
    return await this._retry(async () => {
      const testDoc = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'test');
      console.log(`Testing connection (v${VERSION.APP})...`);
      await getDoc(testDoc);
      return true;
    }, 2, 'test connessione');
  }

  // === MASTER PASSWORD ===
  static async getMasterPassword() {
    return await this._retry(async () => {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data || typeof data.password !== 'string') {
          throw new Error('Dati password corrotti');
        }
        return data.password || 'admin';
      } else {
        await this.updateMasterPassword('admin');
        return 'admin';
      }
    }, 3, 'caricamento master password');
  }

  static async updateMasterPassword(newPassword) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 3) {
      throw new Error('Password non valida');
    }
    
    return await this._retry(async () => {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
      await setDoc(docRef, { password: newPassword });
      return true;
    }, 3, 'aggiornamento master password');
  }

  // === DIPENDENTI ===
  static async getEmployees() {
    return await this._retry(async () => {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data || !Array.isArray(data.list)) {
          console.warn('Dati dipendenti corrotti, inizializzazione array vuoto');
          return [];
        }
        const employees = data.list;
        return employees.map(emp => ({
          ...emp,
          password: emp.password || 'dipendente123',
          id: emp.id || `emp_${Date.now()}`,
          name: emp.name || `${emp.nome || 'Nome'} ${emp.cognome || 'Cognome'}`
        }));
      }
      return [];
    }, 3, 'caricamento dipendenti');
  }

  static async saveEmployees(employees) {
    if (!Array.isArray(employees)) {
      throw new Error('Employees deve essere un array');
    }
    
    // Validazione base dei dipendenti
    const validatedEmployees = employees.map(emp => {
      if (!emp || typeof emp !== 'object') {
        throw new Error('Dipendente non valido');
      }
      if (!emp.id || !emp.name) {
        throw new Error('Dipendente mancante di dati obbligatori');
      }
      return {
        ...emp,
        password: emp.password || 'dipendente123'
      };
    });
    
    return await this._retry(async () => {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
      await setDoc(docRef, { list: validatedEmployees });
      return true;
    }, 3, 'salvataggio dipendenti');
  }

  // === CANTIERI ===
  static async getCantieri() {
    try {
      console.log('Debug - getCantieri chiamato');
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.CANTIERI);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cantieri = docSnap.data().list || [];
        console.log('Debug - Cantieri caricati da Firestore:', cantieri);
        return cantieri;
      }
      console.log('Debug - Nessun documento cantieri trovato');
      return [];
    } catch (error) {
      console.error('Errore caricamento cantieri:', error);
      return [];
    }
  }

  static async saveCantieri(cantieri) {
    try {
      console.log('Debug - Salvataggio cantieri:', cantieri);
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.CANTIERI);
      await setDoc(docRef, { list: cantieri });
      return true;
    } catch (error) {
      console.error('Errore salvataggio cantieri:', error);
      throw error;
    }
  }

  // === CATEGORIE CANTIERI ===
  static async getCategorieCantieri() {
    try {
      console.log('Debug - getCategorieCantieri chiamato');
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'categorie');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const categorie = docSnap.data().list || [];
        console.log('Debug - Categorie caricate da Firestore:', categorie);
        return categorie;
      } else {
        console.log('Debug - Nessun documento categorie trovato, creando categoria default');
        // Crea categoria di default se non esiste
        const defaultCategorie = [{
          id: 'generale',
          name: 'Generale',
          color: '#6c757d',
          icon: 'bi-building'
        }];
        await this.saveCategorieCantieri(defaultCategorie);
        return defaultCategorie;
      }
    } catch (error) {
      console.error('Errore caricamento categorie cantieri:', error);
      return [];
    }
  }

  static async saveCategorieCantieri(categorie) {
    try {
      console.log('Debug - Salvataggio categorie:', categorie);
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'categorie');
      await setDoc(docRef, { list: categorie });
      return true;
    } catch (error) {
      console.error('Errore salvataggio categorie cantieri:', error);
      throw error;
    }
  }

  // === ORE LAVORATIVE ===
  static async getOreLavorative(employeeId, date) {
    if (!employeeId || !date) {
      throw new Error('EmployeeId e date sono obbligatori');
    }
    
    // Validazione formato data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Formato data non valido (richiesto YYYY-MM-DD)');
    }
    
    return await this._retry(async () => {
      const employees = await this.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        console.warn(`Dipendente non trovato: ${employeeId}`);
        return { data: date, stato: 'Normale', attivita: [] };
      }
      
      const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, employeeName, date);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data || typeof data !== 'object') {
          throw new Error('Dati ore lavorative corrotti');
        }
        
        // Validazione e sanitizzazione dati
        const attivita = Array.isArray(data.attivita) ? data.attivita.filter(a => 
          a && typeof a === 'object' && a.id && a.nome
        ) : [];
        
        return {
          data: data.data || date,
          stato: ['Normale', 'Riposo', 'Ferie', 'Malattia'].includes(data.stato) ? data.stato : 'Normale',
          attivita
        };
      }
      
      return { data: date, stato: 'Normale', attivita: [] };
    }, 3, `caricamento ore lavorative ${employeeId}/${date}`);
    }
  }

  static async saveOreLavorative(employeeId, date, data) {
    if (!employeeId || !date || !data) {
      throw new Error('Parametri obbligatori mancanti');
    }
    
    // Validazione formato data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Formato data non valido (richiesto YYYY-MM-DD)');
    }
    
    return await this._retry(async () => {
      const employees = await this.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        throw new Error(`Dipendente non trovato: ${employeeId}`);
      }
      
      const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, employeeName, date);
      
      // Validazione e sanitizzazione payload
      const payload = {
        data: data.data || date,
        stato: ['Normale', 'Riposo', 'Ferie', 'Malattia'].includes(data.stato) ? data.stato : 'Normale',
        attivita: Array.isArray(data.attivita) ? data.attivita.filter(a => {
          if (!a || typeof a !== 'object') return false;
          if (!a.id || !a.nome) return false;
          if (typeof a.minuti !== 'number' || a.minuti < 0 || a.minuti > 1440) return false;
          return true;
        }) : []
      };
      
      await setDoc(docRef, payload);
      return true;
    }, 3, `salvataggio ore lavorative ${employeeId}/${date}`);
    }
  }

  static async getOrePeriodo(employeeId, start, end) {
    return await this._retry(async () => {
      try {
        if (!employeeId || !start || !end) throw new Error('Parametri obbligatori mancanti');
        const employees = await this.getEmployees();
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) return [];
        const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
        const collRef = collection(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, employeeName);
        const qy = query(
          collRef,
          where('data', '>=', start),
          where('data', '<=', end),
          orderBy('data', 'desc')
        );
        const querySnapshot = await getDocs(qy);
        const ore = [];
        querySnapshot.forEach(d => ore.push({ id: d.id, ...d.data() }));
        return ore;
      } catch (error) {
        console.error('Errore caricamento ore periodo:', error);
        return [];
      }
    });
  }

  static async getRiepilogoCompleto(startDate, endDate) {
    try {
      const employees = await this.getEmployees();
      const riepilogo = [];
      for (const employee of employees) {
        try {
          const ore = await this.getOrePeriodo(employee.id, startDate, endDate);
          riepilogo.push({ dipendente: employee, ore });
        } catch (employeeError) {
          console.error(`Errore caricamento ore per dipendente ${employee.id}:`, employeeError);
          riepilogo.push({ dipendente: employee, ore: [] });
        }
      }
      return riepilogo;
    } catch (error) {
      console.error('Errore caricamento riepilogo completo:', error);
      return [];
    }
  }

  // === BADGE SESSIONS ===
  static async _employeeNameFromId(employeeId) {
    const employees = await this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    return emp && emp.name ? emp.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
  }

  static async _dayBasePath(employeeId, dateISO) {
    const employeeName = await this._employeeNameFromId(employeeId);
    return `${DB_STRUCTURE.CLIENT_COLLECTION}/${DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI}/${employeeName}/${dateISO}`;
  }

  static async _badgeSessionsColl(employeeId, dateISO) {
    const base = await this._dayBasePath(employeeId, dateISO);
    return collection(db, `${base}/badgeSessions`);
  }

  static async _badgeOpenDoc(employeeId, dateISO) {
    const base = await this._dayBasePath(employeeId, dateISO);
    return doc(db, `${base}/meta`, 'badgeOpen');
  }

  static async createBadgeSession(employeeId, { dateISO, entryTime }) {
    const openRef = await this._badgeOpenDoc(employeeId, dateISO);
    const sessionsColl = await this._badgeSessionsColl(employeeId, dateISO);
    const sessionId = `badge-${Math.random().toString(36).slice(2, 10)}`;
    const sessionRef = doc(sessionsColl, sessionId);
    
    await setDoc(openRef, {
      id: sessionId,
      isOpen: true,
      date: dateISO,
      entryTime,
      exitTime: null,
      minutes: 0,
      updatedAt: serverTimestamp(),
    });
    
    await setDoc(sessionRef, {
      id: sessionId,
      date: dateISO,
      entryTime,
      exitTime: null,
      minutes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return sessionId;
  }

  static async getOpenBadgeSession(employeeId, dateISO) {
    const openRef = await this._badgeOpenDoc(employeeId, dateISO);
    const snap = await getDoc(openRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data && data.isOpen ? data : null;
  }

  static async watchOpenBadgeSession(employeeId, dateISO, onChange) {
    const openRef = await this._badgeOpenDoc(employeeId, dateISO);
    return onSnapshot(openRef, (snap) => {
      if (!snap.exists()) { 
        onChange(null); 
        return; 
      }
      const data = snap.data();
      onChange(data && data.isOpen ? data : null);
    });
  }

  static async closeBadgeSession(employeeId, sessionId, { exitTime, minutes, dateISO }) {
    const openRef = await this._badgeOpenDoc(employeeId, dateISO);
    const sessionsColl = await this._badgeSessionsColl(employeeId, dateISO);
    const sessionRef = doc(sessionsColl, sessionId);
    
    await updateDoc(openRef, {
      isOpen: false,
      exitTime,
      minutes: Math.max(0, Math.round(minutes || 0)),
      updatedAt: serverTimestamp(),
    });
    
    await updateDoc(sessionRef, {
      exitTime,
      minutes: Math.max(0, Math.round(minutes || 0)),
      updatedAt: serverTimestamp(),
    });
  }

  // === VARIE ===
  static async deleteEmployeeData(employeeId) {
    try {
      const employees = await this.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      const employeeName = employee ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
      console.log(`Richiesta eliminazione dati per dipendente: ${employeeName} (ID: ${employeeId})`);
      // TODO: implementare eliminazione completa dei documenti delle subcollection
      return true;
    } catch (error) {
      console.error('Errore eliminazione dati dipendente:', error);
      throw error;
    }
  }

  static async getStatistiche() {
    try {
      const employees = await this.getEmployees();
      const cantieri = await this.getCantieri();
      return {
        totaleDipendenti: employees.length,
        totaleCantieri: cantieri.length,
        ultimoAggiornamento: new Date().toISOString()
      };
    } catch (error) {
      console.error('Errore caricamento statistiche:', error);
      throw error;
    }
  }
}