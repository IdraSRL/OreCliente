// UI utilities for toast notifications, loading states, and confirmations
import { UI_CONSTANTS } from '../config/constants.js';

// Toast notification system
export function showToast(message, type = 'info', duration = UI_CONSTANTS.TOAST_DURATION) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-custom');
    existingToasts.forEach(toast => toast.remove());

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-custom position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    
    const bgClass = {
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-info';

    toast.innerHTML = `
        <div class="alert ${bgClass} text-white d-flex align-items-center mb-0 shadow-lg" style="border-radius: 8px;">
            <i class="bi ${getToastIcon(type)} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close btn-close-white ms-auto" onclick="this.closest('.toast-custom').remove()"></button>
        </div>
    `;

    document.body.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}

function getToastIcon(type) {
    const icons = {
        'success': 'bi-check-circle',
        'error': 'bi-exclamation-triangle',
        'warning': 'bi-exclamation-circle',
        'info': 'bi-info-circle'
    };
    return icons[type] || 'bi-info-circle';
}

// Global loading overlay
export function showGlobalLoading(show = true, message = 'Caricamento...') {
    const existingOverlay = document.getElementById('globalLoadingOverlay');
    
    if (show) {
        if (existingOverlay) return; // Already showing
        
        const overlay = document.createElement('div');
        overlay.id = 'globalLoadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-white">${message}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    } else {
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }
}

// Confirmation dialog
export function showConfirm(title, message, confirmText = 'Conferma', cancelText = 'Annulla', type = 'primary') {
    return new Promise((resolve) => {
        // Remove existing confirm modals
        const existingModals = document.querySelectorAll('.confirm-modal');
        existingModals.forEach(modal => modal.remove());

        const modalId = 'confirmModal_' + Date.now();
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal fade confirm-modal';
        confirmModal.id = modalId;
        confirmModal.setAttribute('tabindex', '-1');
        
        const buttonClass = {
            'primary': 'btn-primary',
            'danger': 'btn-danger',
            'warning': 'btn-warning',
            'success': 'btn-success'
        }[type] || 'btn-primary';

        confirmModal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0" style="white-space: pre-line;">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
                        <button type="button" class="btn ${buttonClass}" id="confirmBtn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        const modal = new bootstrap.Modal(confirmModal);
        
        // Handle confirm button
        confirmModal.querySelector('#confirmBtn').addEventListener('click', () => {
            modal.hide();
            resolve(true);
        });

        // Handle modal close (cancel)
        confirmModal.addEventListener('hidden.bs.modal', () => {
            confirmModal.remove();
            resolve(false);
        });

        modal.show();
    });
}

// Button loading states (legacy support)
export function showLoading(button, text = 'Caricamento...') {
    if (!button) return;
    
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
        ${text}
    `;
}

export function hideLoading(button, originalText = null) {
    if (!button) return;
    
    button.disabled = false;
    button.innerHTML = originalText || button.dataset.originalText || button.innerHTML;
    delete button.dataset.originalText;
}