// Cantiere service for managing construction sites and categories

import { FirestoreService } from './firestore-service.js';
import { generateId } from '../utils/utils.js';

export class CantiereService {
    constructor() {
        this.cantieri = [];
        this.categorie = [];
    }
    
    // Load cantieri from Firestore
    async loadCantieri() {
        try {
            this.cantieri = await FirestoreService.getCantieri();
            return this.cantieri;
        } catch (error) {
            console.error('Error loading cantieri:', error);
            this.cantieri = [];
            throw error;
        }
    }
    
    // Load categorie from Firestore
    async loadCategorie() {
        try {
            this.categorie = await FirestoreService.getCategorieCantieri();
            return this.categorie;
        } catch (error) {
            console.error('Error loading categorie:', error);
            this.categorie = [];
            throw error;
        }
    }
    
    // Get all cantieri
    getAllCantieri() {
        return [...this.cantieri];
    }
    
    // Get all categorie
    getAllCategorie() {
        return [...this.categorie];
    }
    
    // Get cantiere by ID
    getCantiereById(id) {
        return this.cantieri.find(cantiere => cantiere.id === id);
    }
    
    // Get categoria by ID
    getCategoriaById(id) {
        return this.categorie.find(categoria => categoria.id === id);
    }
    
    // Get active cantieri only
    getActiveCantieri() {
        return this.cantieri.filter(cantiere => cantiere.attivo !== false);
    }
    
    // Get cantieri grouped by categoria
    getCantieriByCategoria() {
        const grouped = {};
        
        // Initialize with all categories
        this.categorie.forEach(categoria => {
            grouped[categoria.id] = {
                categoria,
                cantieri: []
            };
        });
        
        // Add cantieri to their categories
        this.getActiveCantieri().forEach(cantiere => {
            const categoriaId = cantiere.categoria || 'generale';
            
            if (!grouped[categoriaId]) {
                // Create default category if not found
                grouped[categoriaId] = {
                    categoria: { id: categoriaId, name: 'Generale', color: '#6c757d', icon: 'bi-building' },
                    cantieri: []
                };
            }
            
            grouped[categoriaId].cantieri.push(cantiere);
        });
        
        return grouped;
    }
    
    // Save cantiere
    async saveCantiere(cantiereData) {
        try {
            // Generate ID if not provided
            if (!cantiereData.id) {
                cantiereData.id = generateId('cantiere');
            }
            
            // Validate required fields
            if (!cantiereData.name || !cantiereData.name.trim()) {
                throw new Error('Nome cantiere obbligatorio');
            }
            
            if (!cantiereData.minutes || cantiereData.minutes <= 0) {
                throw new Error('Minuti devono essere maggiori di zero');
            }
            
            // Ensure categoria exists
            if (cantiereData.categoria && !this.getCategoriaById(cantiereData.categoria)) {
                cantiereData.categoria = 'generale';
            }
            
            // Update or add cantiere
            const existingIndex = this.cantieri.findIndex(c => c.id === cantiereData.id);
            
            if (existingIndex >= 0) {
                this.cantieri[existingIndex] = { ...this.cantieri[existingIndex], ...cantiereData };
            } else {
                this.cantieri.push(cantiereData);
            }
            
            // Save to Firestore
            await FirestoreService.saveCantieri(this.cantieri);
            
            return cantiereData;
        } catch (error) {
            console.error('Error saving cantiere:', error);
            throw error;
        }
    }
    
    // Delete cantiere
    async deleteCantiere(cantiereId) {
        try {
            const index = this.cantieri.findIndex(c => c.id === cantiereId);
            
            if (index === -1) {
                throw new Error('Cantiere non trovato');
            }
            
            this.cantieri.splice(index, 1);
            
            // Save to Firestore
            await FirestoreService.saveCantieri(this.cantieri);
            
            return true;
        } catch (error) {
            console.error('Error deleting cantiere:', error);
            throw error;
        }
    }
    
    // Save categoria
    async saveCategoria(categoriaData) {
        try {
            // Generate ID if not provided
            if (!categoriaData.id) {
                categoriaData.id = generateId('cat');
            }
            
            // Validate required fields
            if (!categoriaData.name || !categoriaData.name.trim()) {
                throw new Error('Nome categoria obbligatorio');
            }
            
            if (!categoriaData.color || !/^#[0-9A-Fa-f]{6}$/.test(categoriaData.color)) {
                throw new Error('Colore non valido');
            }
            
            if (!categoriaData.icon) {
                categoriaData.icon = 'bi-building';
            }
            
            // Update or add categoria
            const existingIndex = this.categorie.findIndex(c => c.id === categoriaData.id);
            
            if (existingIndex >= 0) {
                this.categorie[existingIndex] = { ...this.categorie[existingIndex], ...categoriaData };
            } else {
                this.categorie.push(categoriaData);
            }
            
            // Save to Firestore
            await FirestoreService.saveCategorieCantieri(this.categorie);
            
            return categoriaData;
        } catch (error) {
            console.error('Error saving categoria:', error);
            throw error;
        }
    }
    
    // Delete categoria
    async deleteCategoria(categoriaId) {
        try {
            // Cannot delete 'generale' category
            if (categoriaId === 'generale') {
                throw new Error('Impossibile eliminare la categoria Generale');
            }
            
            const index = this.categorie.findIndex(c => c.id === categoriaId);
            
            if (index === -1) {
                throw new Error('Categoria non trovata');
            }
            
            // Move cantieri from deleted category to 'generale'
            this.cantieri.forEach(cantiere => {
                if (cantiere.categoria === categoriaId) {
                    cantiere.categoria = 'generale';
                }
            });
            
            // Remove categoria
            this.categorie.splice(index, 1);
            
            // Save both cantieri and categorie
            await Promise.all([
                FirestoreService.saveCantieri(this.cantieri),
                FirestoreService.saveCategorieCantieri(this.categorie)
            ]);
            
            return true;
        } catch (error) {
            console.error('Error deleting categoria:', error);
            throw error;
        }
    }
    
    // Get cantieri statistics
    getCantieriStats() {
        const total = this.cantieri.length;
        const active = this.getActiveCantieri().length;
        const inactive = total - active;
        
        const byCategory = {};
        this.cantieri.forEach(cantiere => {
            const cat = cantiere.categoria || 'generale';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });
        
        return {
            total,
            active,
            inactive,
            byCategory,
            categories: this.categorie.length
        };
    }
    
    // Search cantieri
    searchCantieri(query) {
        if (!query || query.trim() === '') {
            return this.getActiveCantieri();
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        return this.getActiveCantieri().filter(cantiere => 
            cantiere.name.toLowerCase().includes(searchTerm) ||
            (cantiere.descrizione && cantiere.descrizione.toLowerCase().includes(searchTerm))
        );
    }
    
    // Get cantieri by categoria
    getCantieriByCategoria(categoriaId) {
        return this.cantieri.filter(cantiere => 
            (cantiere.categoria || 'generale') === categoriaId
        );
    }
    
    // Validate cantiere data
    validateCantiere(cantiereData) {
        const errors = [];
        
        if (!cantiereData.name || cantiereData.name.trim().length < 2) {
            errors.push('Nome cantiere deve essere di almeno 2 caratteri');
        }
        
        if (!cantiereData.minutes || cantiereData.minutes <= 0 || cantiereData.minutes > 1440) {
            errors.push('Minuti devono essere tra 1 e 1440');
        }
        
        if (cantiereData.categoria && !this.getCategoriaById(cantiereData.categoria)) {
            errors.push('Categoria non valida');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Validate categoria data
    validateCategoria(categoriaData) {
        const errors = [];
        
        if (!categoriaData.name || categoriaData.name.trim().length < 2) {
            errors.push('Nome categoria deve essere di almeno 2 caratteri');
        }
        
        if (!categoriaData.color || !/^#[0-9A-Fa-f]{6}$/.test(categoriaData.color)) {
            errors.push('Colore deve essere in formato esadecimale (#RRGGBB)');
        }
        
        if (!categoriaData.icon) {
            errors.push('Icona obbligatoria');
        }
        
        // Check for duplicate names (excluding current item)
        const existingCategoria = this.categorie.find(c => 
            c.name.toLowerCase() === categoriaData.name.toLowerCase() && 
            c.id !== categoriaData.id
        );
        
        if (existingCategoria) {
            errors.push('Esiste già una categoria con questo nome');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Import cantieri from array
    async importCantieri(cantieriArray) {
        try {
            const validCantieri = [];
            const errors = [];
            
            cantieriArray.forEach((cantiere, index) => {
                const validation = this.validateCantiere(cantiere);
                
                if (validation.isValid) {
                    if (!cantiere.id) {
                        cantiere.id = generateId('cantiere');
                    }
                    validCantieri.push(cantiere);
                } else {
                    errors.push(`Riga ${index + 1}: ${validation.errors.join(', ')}`);
                }
            });
            
            if (validCantieri.length > 0) {
                this.cantieri = [...this.cantieri, ...validCantieri];
                await FirestoreService.saveCantieri(this.cantieri);
            }
            
            return {
                imported: validCantieri.length,
                errors
            };
        } catch (error) {
            console.error('Error importing cantieri:', error);
            throw error;
        }
    }
    
    // Export cantieri to array
    exportCantieri() {
        return this.cantieri.map(cantiere => ({
            name: cantiere.name,
            minutes: cantiere.minutes,
            categoria: cantiere.categoria,
            descrizione: cantiere.descrizione,
            attivo: cantiere.attivo
        }));
    }
}