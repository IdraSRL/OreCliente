// Storage utilities

export function saveToStorage(key, data) {
    try {
        if (!key) return false;
        sessionStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Errore salvataggio storage:', error);
        return false;
    }
}

export function loadFromStorage(key) {
    try {
        if (!key) return null;
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Errore caricamento storage:', error);
        return null;
    }
}

export function removeFromStorage(key) {
    try {
        if (!key) return false;
        sessionStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Errore rimozione storage:', error);
        return false;
    }
}

export function clearStorage() {
    try {
        sessionStorage.clear();
        return true;
    } catch (error) {
        console.error('Errore pulizia storage:', error);
        return false;
    }
}

export function saveToLocalStorage(key, data) {
    try {
        if (!key) return false;
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Errore salvataggio localStorage:', error);
        return false;
    }
}

export function loadFromLocalStorage(key) {
    try {
        if (!key) return null;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Errore caricamento localStorage:', error);
        return null;
    }
}