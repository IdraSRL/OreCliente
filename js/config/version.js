// Version management system
export const VERSION = {
    APP: '1.4.2',
    CSS: '1.4.2',
    JS: '1.4.2',
    BUILD: Date.now()
};

// Get versioned URL for assets
export function getVersionedUrl(url, type = 'js') {
    const version = type === 'css' ? VERSION.CSS : VERSION.JS;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${version}`;
}

// Check if version has changed (for cache busting)
export function checkVersion() {
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion !== VERSION.APP) {
        localStorage.setItem('app_version', VERSION.APP);
        return storedVersion !== null; // Return true if version changed
    }
    return false;
}

// Clear cache if version changed
export function handleVersionChange() {
    if (checkVersion()) {
        console.log('Nuova versione rilevata, pulizia cache...');
        // Clear relevant caches
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
        // Force reload stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.href;
            link.href = getVersionedUrl(href, 'css');
        });
    }
}