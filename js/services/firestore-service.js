import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';

import { db } from '../config/firebase-config.js';
import { DB_STRUCTURE } from '../config/client-config.js';

export class FirestoreService {
  // Retry helper
  static async _retry(fn, tries = 3) {
    let last;
    for (let i = 0; i <= tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i < tries) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000); // Exponential backoff
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw new Error(`Operazione fallita dopo ${tries + 1} tentativi: ${last.message}`);
  }

  // === TEST CONNESSIONE ===
  static async testConnection() {
    try {
      const testDoc = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, 'test');
      await getDoc(testDoc);
      return true;
    } catch (error) {
      console.error('Errore connessione Firebase:', error);
      throw new Error('Impossibile connettersi al database. Verifica la connessione internet.');
    }
  }

  // === MASTER PASSWORD ===
  static async getMasterPassword() {
    try {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const password = docSnap.data().password;
        return password || 'admin';
      } else {
        await this.updateMasterPassword('admin');
        return 'admin';
      }
    } catch (error) {
      console.error('Errore caricamento master password:', error);
      return 'admin';
    }
  }

  static async updateMasterPassword(newPassword) {
    try {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.MASTER_PASSWORD);
      await setDoc(docRef, { password: newPassword });
      return true;
    } catch (error) {
      console.error('Errore aggiornamento master password:', error);
      throw error;
    }
  }

  // === DIPENDENTI ===
  static async getEmployees() {
    try {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const employees = docSnap.data().list || [];
        return employees.map(emp => ({
          ...emp,
          password: emp.password || 'dipendente123'
        }));
      }
      return [];
    } catch (error) {
      console.error('Errore caricamento dipendenti:', error);
      return [];
    }
  }

  static async saveEmployees(employees) {
    try {
      const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.EMPLOYEES);
      await setDoc(docRef, { list: employees });
      return true;
    } catch (error) {
      console.error('Errore salvataggio dipendenti:', error);
      throw error;
    }
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
    return await this._retry(async () => {
      try {
        if (!employeeId || !date) throw new Error('EmployeeId e date sono obbligatori');
        const employees = await this.getEmployees();
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) {
          console.warn(`Dipendente non trovato: ${employeeId}`);
          return { data: date, stato: 'Normale', attivita: [] };
        }
        const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
        const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, employeeName, date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data();
        return { data: date, stato: 'Normale', attivita: [] };
      } catch (error) {
        console.error('Errore caricamento ore lavorative:', error);
        return { data: date, stato: 'Normale', attivita: [] };
      }
    });
  }

  static async saveOreLavorative(employeeId, date, data) {
    return await this._retry(async () => {
      try {
        if (!employeeId || !date || !data) throw new Error('Parametri obbligatori mancanti');
        const employees = await this.getEmployees();
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) throw new Error(`Dipendente non trovato: ${employeeId}`);
        const employeeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9_]/g, '_') : employeeId;
        const docRef = doc(db, DB_STRUCTURE.CLIENT_COLLECTION, DB_STRUCTURE.SUBCOLLECTIONS.DIPENDENTI, employeeName, date);
        const payload = {
          data: data.data || date,
          stato: data.stato || 'Normale',
          attivita: Array.isArray(data.attivita) ? data.attivita : []
        };
        await setDoc(docRef, payload);
        return true;
      } catch (error) {
        console.error('Errore salvataggio ore lavorative:', error);
        throw error;
      }
    });
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