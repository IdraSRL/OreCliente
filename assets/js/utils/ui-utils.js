// UI utilities separate file to avoid conflicts

// Toast container management
let toastContainer = null;

function createToastContainer() {
    if (toastContainer) return toastContainer;
    
    try {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
        return toastContainer;
    } catch (error) {
        console.error('Errore creazione toast container:', error);
        return null;
    }
}

export function showToast(message, type = 'info') {
    try {
        if (!message) return;
        
        const container = document.getElementById('toast-container') || createToastContainer();
        if (!container) return;
        
        const toastId = 'toast-' + Date.now();
        const iconMap = {
            success: 'bi-check-circle-fill',
            error: 'bi-exclamation-triangle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };
        
        const colorMap = {
            success: 'text-success',
            error: 'text-danger',
            warning: 'text-warning',
            info: 'text-primary'
        };
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="bi ${iconMap[type] || iconMap.info} ${colorMap[type] || colorMap.info} me-2"></i>
                    <strong class="me-auto">Sistema</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message.toString().trim().replace(/[<>'"]/g, '')}
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        
        if (toastElement && typeof bootstrap !== 'undefined') {
            const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
            toast.show();
            
            toastElement.addEventListener('hidden.bs.toast', () => {
                toastElement.remove();
            });
        }
    } catch (error) {
        console.error('Errore visualizzazione toast:', error);
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

export function showLoading(element, text = 'Caricamento...') {
    try {
        if (!element) return;
        
        // Store original content
        element.dataset.originalContent = element.innerHTML;
        
        element.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ${text.toString().trim()}
        `;
        element.disabled = true;
    } catch (error) {
        console.error('Errore visualizzazione loading:', error);
    }
}

export function hideLoading(element, originalText = '') {
    try {
        if (!element) return;
        
        // Use stored original content or provided text
        const content = originalText || element.dataset.originalContent || 'Salva';
        element.innerHTML = content;
        element.disabled = false;
        
        // Clean up stored content
        if (element.dataset.originalContent) {
            delete element.dataset.originalContent;
        }
    } catch (error) {
        console.error('Errore nascondere loading:', error);
    }
}

export function showGlobalLoading(show = true) {
    try {
        let overlay = document.getElementById('global-loading');
        
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'global-loading';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="text-center">
                        <div class="spinner-border mb-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div>Caricamento in corso...</div>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        } else {
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Errore global loading:', error);
    }
}

export function showConfirm(title, message, confirmText = 'Conferma', cancelText = 'Annulla', type = 'warning') {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('customConfirmModal');
        if (existingModal) {
            existingModal.remove();
        }

        const iconMap = {
            warning: 'bi-exclamation-triangle-fill text-warning',
            danger: 'bi-exclamation-triangle-fill text-danger',
            info: 'bi-info-circle-fill text-info',
            question: 'bi-question-circle-fill text-primary'
        };

        const modalHtml = `
            <div class="modal fade" id="customConfirmModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title d-flex align-items-center">
                                <i class="bi ${iconMap[type]} me-2"></i>
                                ${title}
                            </h5>
                        </div>
                        <div class="modal-body">
                            <p class="mb-0">${message}</p>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-secondary" id="confirmCancel">${cancelText}</button>
                            <button type="button" class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirmOk">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('customConfirmModal'));
        
        document.getElementById('confirmOk').addEventListener('click', () => {
            modal.hide();
            resolve(true);
        });
        
        document.getElementById('confirmCancel').addEventListener('click', () => {
            modal.hide();
            resolve(false);
        });
        
        document.getElementById('customConfirmModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('customConfirmModal').remove();
        });
        
        modal.show();
    });
}