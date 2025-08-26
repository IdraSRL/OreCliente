// Button utilities for managing loading states and interactions

export class ButtonUtils {
    // Show loading state on button
    static showLoading(button, text = 'Caricamento...') {
        if (!button) return;
        
        // Store original state
        button.dataset.originalText = button.innerHTML;
        button.dataset.originalDisabled = button.disabled;
        
        // Set loading state
        button.disabled = true;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ${text}
        `;
        
        // Add loading class for styling
        button.classList.add('btn-loading');
    }
    
    // Hide loading state and restore button
    static hideLoading(button, originalText = null) {
        if (!button) return;
        
        // Restore original state
        button.disabled = button.dataset.originalDisabled === 'true';
        button.innerHTML = originalText || button.dataset.originalText || button.innerHTML;
        
        // Remove loading class
        button.classList.remove('btn-loading');
        
        // Clean up data attributes
        delete button.dataset.originalText;
        delete button.dataset.originalDisabled;
    }
    
    // Initialize button with hover effects and accessibility
    static initButton(button) {
        if (!button) return;
        
        // Add ripple effect on click
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
        
        // Add keyboard accessibility
        button.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    }
    
    // Create confirmation button with custom styling
    static createConfirmButton(text, onClick, variant = 'primary') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-${variant}`;
        button.innerHTML = text;
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        this.initButton(button);
        return button;
    }
    
    // Create icon button
    static createIconButton(icon, text = '', onClick = null, variant = 'outline-primary') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-${variant}`;
        
        const iconElement = `<i class="bi ${icon}${text ? ' me-2' : ''}"></i>`;
        button.innerHTML = iconElement + text;
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        this.initButton(button);
        return button;
    }
    
    // Toggle button state (active/inactive)
    static toggleButton(button, active = null) {
        if (!button) return;
        
        const isActive = active !== null ? active : !button.classList.contains('active');
        
        if (isActive) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
        }
        
        return isActive;
    }
    
    // Disable button with optional message
    static disableButton(button, message = null) {
        if (!button) return;
        
        button.disabled = true;
        button.classList.add('disabled');
        
        if (message) {
            button.title = message;
            button.setAttribute('data-bs-toggle', 'tooltip');
            button.setAttribute('data-bs-placement', 'top');
        }
    }
    
    // Enable button
    static enableButton(button) {
        if (!button) return;
        
        button.disabled = false;
        button.classList.remove('disabled');
        button.removeAttribute('title');
        button.removeAttribute('data-bs-toggle');
        button.removeAttribute('data-bs-placement');
    }
    
    // Add pulse animation to button
    static pulseButton(button, duration = 1000) {
        if (!button) return;
        
        button.classList.add('btn-pulse');
        
        setTimeout(() => {
            button.classList.remove('btn-pulse');
        }, duration);
    }
    
    // Create button group
    static createButtonGroup(buttons, vertical = false) {
        const group = document.createElement('div');
        group.className = `btn-group${vertical ? '-vertical' : ''}`;
        group.setAttribute('role', 'group');
        
        buttons.forEach(buttonConfig => {
            const button = this.createIconButton(
                buttonConfig.icon,
                buttonConfig.text,
                buttonConfig.onClick,
                buttonConfig.variant
            );
            
            if (buttonConfig.active) {
                button.classList.add('active');
            }
            
            group.appendChild(button);
        });
        
        return group;
    }
    
    // Add loading spinner to existing button content
    static addSpinner(button) {
        if (!button) return;
        
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-2';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        
        button.insertBefore(spinner, button.firstChild);
        button.disabled = true;
        
        return spinner;
    }
    
    // Remove spinner from button
    static removeSpinner(button) {
        if (!button) return;
        
        const spinner = button.querySelector('.spinner-border');
        if (spinner) {
            spinner.remove();
        }
        
        button.disabled = false;
    }
}

// Add CSS for ripple effect and pulse animation
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .btn-pulse {
        animation: pulse-animation 1s ease-in-out;
    }
    
    @keyframes pulse-animation {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .btn-loading {
        position: relative;
    }
    
    .btn-loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.1);
        border-radius: inherit;
    }
`;

document.head.appendChild(style);