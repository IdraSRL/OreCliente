// Photo service for handling employee photo uploads and management

import { UI_CONSTANTS } from '../config/constants.js';

export class PhotoService {
    // Upload photo to server
    static async uploadPhoto(employeeId, file) {
        if (!employeeId || !file) {
            throw new Error('Employee ID and file are required');
        }
        
        // Validate file before upload
        const errors = this.validatePhotoFile(file);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('employeeId', employeeId);
        
        try {
            const response = await fetch('../upload_photo.php', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Upload failed');
            }
            
            return result.fileName;
        } catch (error) {
            console.error('Error uploading photo:', error);
            throw new Error('Errore durante il caricamento della foto: ' + error.message);
        }
    }
    
    // Delete photo from server
    static async deletePhoto(employeeId) {
        if (!employeeId) {
            throw new Error('Employee ID is required');
        }
        
        try {
            const response = await fetch('../delete_photo.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ employeeId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Delete failed');
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting photo:', error);
            throw new Error('Errore durante l\'eliminazione della foto: ' + error.message);
        }
    }
    
    // Validate photo file
    static validatePhotoFile(file) {
        const errors = [];
        
        if (!file) {
            errors.push('Nessun file selezionato');
            return errors;
        }
        
        // Check file size
        if (file.size > UI_CONSTANTS.MAX_FILE_SIZE) {
            errors.push(`File troppo grande. Massimo ${this.formatFileSize(UI_CONSTANTS.MAX_FILE_SIZE)} consentiti`);
        }
        
        // Check file type
        if (!UI_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            errors.push('Tipo file non supportato. Usa JPG, PNG o GIF');
        }
        
        return errors;
    }
    
    // Preview photo before upload
    static async previewPhoto(file, previewElement) {
        if (!file || !previewElement) {
            throw new Error('File and preview element are required');
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                previewElement.innerHTML = `
                    <img src="${e.target.result}" alt="Anteprima foto" 
                         style="width: 100%; height: 100%; object-fit: cover;">
                `;
                resolve(e.target.result);
            };
            
            reader.onerror = function() {
                reject(new Error('Errore lettura file'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // Get photo URL for display
    static getPhotoUrl(fileName) {
        if (!fileName) return null;
        
        // Adjust path based on current location
        const currentPath = window.location.pathname;
        const basePath = currentPath.includes('/pages/') ? '../' : '';
        
        return `${basePath}uploads/employees/${fileName}`;
    }
    
    // Format file size for display
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Create photo placeholder with initials
    static createPhotoPlaceholder(name, size = 60) {
        const initials = this.getInitials(name);
        
        return `
            <div style="
                width: ${size}px; 
                height: ${size}px; 
                border-radius: 8px; 
                background: linear-gradient(135deg, var(--custom-accent), var(--custom-success)); 
                display: flex; 
                align-items: center; 
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${Math.floor(size * 0.4)}px;
            ">
                ${initials}
            </div>
        `;
    }
    
    // Get initials from name
    static getInitials(name) {
        if (!name) return 'ND';
        
        const names = name.trim().split(' ');
        if (names.length === 1) {
            return names[0].substring(0, 2).toUpperCase();
        }
        
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    
    // Compress image before upload (client-side)
    static async compressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = function() {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    // Handle photo input change event
    static handlePhotoInput(input, previewElement, onSuccess = null, onError = null) {
        if (!input || !previewElement) return;
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            
            if (!file) {
                previewElement.innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
                return;
            }
            
            try {
                // Validate file
                const errors = this.validatePhotoFile(file);
                if (errors.length > 0) {
                    throw new Error(errors.join(', '));
                }
                
                // Show preview
                await this.previewPhoto(file, previewElement);
                
                if (onSuccess) {
                    onSuccess(file);
                }
            } catch (error) {
                console.error('Error handling photo input:', error);
                previewElement.innerHTML = '<i class="bi bi-person-fill text-muted" style="font-size: 32px;"></i>';
                
                if (onError) {
                    onError(error);
                }
            }
        });
    }
}