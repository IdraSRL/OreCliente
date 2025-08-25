// Button utilities for consistent button handling
export class ButtonUtils {
    static showLoading(element, text = 'Caricamento...') {
        if (!element) return;
        
        element.dataset.originalContent = element.innerHTML;
        element.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ${text}
        `;
        element.disabled = true;
    }

    static hideLoading(element, originalText = null) {
        if (!element) return;
        
        const content = originalText || element.dataset.originalContent || 'Salva';
        element.innerHTML = content;
        element.disabled = false;
        
        if (element.dataset.originalContent) {
            delete element.dataset.originalContent;
        }
    }

    static setButtonState(element, state, text = null) {
        if (!element) return;
        
        const states = {
            loading: () => this.showLoading(element, text || 'Caricamento...'),
            success: () => {
                element.innerHTML = `<i class="bi bi-check-circle me-2"></i>${text || 'Completato'}`;
                element.className = element.className.replace(/btn-\w+/, 'btn-success');
                setTimeout(() => this.resetButton(element), 2000);
            },
            error: () => {
                element.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${text || 'Errore'}`;
                element.className = element.className.replace(/btn-\w+/, 'btn-danger');
                setTimeout(() => this.resetButton(element), 2000);
            },
            normal: () => this.hideLoading(element, text)
        };
        
        if (states[state]) {
            states[state]();
        }
    }

    static resetButton(element) {
        if (!element) return;
        
        const originalContent = element.dataset.originalContent;
        const originalClass = element.dataset.originalClass;
        
        if (originalContent) {
            element.innerHTML = originalContent;
        }
        
        if (originalClass) {
            element.className = originalClass;
        }
        
        element.disabled = false;
    }

    static initButton(element) {
        if (!element) return;
        
        element.dataset.originalContent = element.innerHTML;
        element.dataset.originalClass = element.className;
    }
}