export class PhotoService {
    static async uploadPhoto(employeeId, file) {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('employeeId', employeeId);

        const response = await fetch('../upload_photo.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore upload foto');
        }

        return result.fileName;
    }

    static async deletePhoto(employeeId) {
        const response = await fetch('../delete_photo.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ employeeId })
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore eliminazione foto');
        }

        return true;
    }

    static validatePhotoFile(file) {
        const errors = [];

        if (!file.type.startsWith('image/')) {
            errors.push('Seleziona un file immagine valido');
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB
            errors.push('File troppo grande. Massimo 2MB');
        }

        return errors;
    }

    static previewPhoto(file, previewElement) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewElement.innerHTML = 
                    `<img src="${e.target.result}" alt="Anteprima foto" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`;
                resolve(e.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}