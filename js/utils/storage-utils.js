// Local storage utilities with error handling and JSON serialization

// Save data to localStorage with error handling
export function saveToStorage(key, data) {
    try {
        if (!key) {
            throw new Error('Storage key is required');
        }
        
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
        return true;
    } catch (error) {
        console.error('Error saving to storage:', error);
        return false;
    }
}

// Load data from localStorage with error handling
export function loadFromStorage(key) {
    try {
        if (!key) {
            return null;
        }
        
        const serializedData = localStorage.getItem(key);
        if (serializedData === null) {
            return null;
        }
        
        return JSON.parse(serializedData);
    } catch (error) {
        console.error('Error loading from storage:', error);
        // Remove corrupted data
        try {
            localStorage.removeItem(key);
        } catch (removeError) {
            console.error('Error removing corrupted storage item:', removeError);
        }
        return null;
    }
}

// Remove item from localStorage
export function removeFromStorage(key) {
    try {
        if (!key) {
            return false;
        }
        
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from storage:', error);
        return false;
    }
}

// Clear all localStorage
export function clearStorage() {
    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('Error clearing storage:', error);
        return false;
    }
}

// Check if localStorage is available
export function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        return false;
    }
}

// Get storage usage info
export function getStorageInfo() {
    if (!isStorageAvailable()) {
        return null;
    }
    
    try {
        let totalSize = 0;
        const items = {};
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                items[key] = size;
                totalSize += size;
            }
        }
        
        return {
            totalSize,
            items,
            available: true
        };
    } catch (error) {
        console.error('Error getting storage info:', error);
        return null;
    }
}

// Save with expiration
export function saveWithExpiration(key, data, expirationMinutes = 60) {
    const expirationTime = new Date().getTime() + (expirationMinutes * 60 * 1000);
    const dataWithExpiration = {
        data,
        expiration: expirationTime
    };
    
    return saveToStorage(key, dataWithExpiration);
}

// Load with expiration check
export function loadWithExpiration(key) {
    const storedData = loadFromStorage(key);
    
    if (!storedData || !storedData.expiration) {
        return null;
    }
    
    const now = new Date().getTime();
    if (now > storedData.expiration) {
        removeFromStorage(key);
        return null;
    }
    
    return storedData.data;
}