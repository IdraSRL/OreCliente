import { FirestoreService } from '../firestore/firestore-service.js';
import { 
    generateId
} from '../utils/utils.js';
import { sanitizeString, validateMinutes } from '../utils/validation-utils.js';

export class CantiereService {
    constructor() {
        this.cantieri = [];
        this.categorie = [];
    }

    async loadCantieri() {
        try {
            this.cantieri = await FirestoreService.getCantieri();
            // Carica anche le categorie se esistono
            this.categorie = await FirestoreService.getCategorieCantieri();
            return this.cantieri;
        } catch (error) {
            console.error('Errore caricamento cantieri:', error);
            throw error;
        }
    }

    async loadCategorie() {
        try {
            this.categorie = await FirestoreService.getCategorieCantieri();
            return this.categorie;
        } catch (error) {
            console.error('Errore caricamento categorie:', error);
            throw error;
        }
    }

    async saveCategoria(categoriaData) {
        try {
            const categoria = {
                id: categoriaData.id || generateId('cat'),
                name: sanitizeString(categoriaData.name),
                color: categoriaData.color || '#4285f4',
                icon: categoriaData.icon || 'bi-building'
            };

            if (categoriaData.id) {
                // Modifica esistente
                const index = this.categorie.findIndex(c => c.id === categoriaData.id);
                if (index !== -1) {
                    this.categorie[index] = categoria;
                }
            } else {
                // Nuova categoria
                this.categorie.push(categoria);
            }

            await FirestoreService.saveCategorieCantieri(this.categorie);
            return categoria;
        } catch (error) {
            console.error('Errore salvataggio categoria:', error);
            throw error;
        }
    }

    async deleteCategoria(categoriaId) {
        try {
            this.categorie = this.categorie.filter(c => c.id !== categoriaId);
            await FirestoreService.saveCategorieCantieri(this.categorie);
            return true;
        } catch (error) {
            console.error('Errore eliminazione categoria:', error);
            throw error;
        }
    }

    async saveCantiere(cantiereData) {
        try {
            const cantiere = {
                id: cantiereData.id || generateId('cantiere'),
                name: sanitizeString(cantiereData.name),
                minutes: parseInt(cantiereData.minutes),
                categoria: cantiereData.categoria || 'generale',
                descrizione: sanitizeString(cantiereData.descrizione || ''),
                attivo: cantiereData.attivo !== false
            };

            if (cantiereData.id) {
                // Modifica esistente
                const index = this.cantieri.findIndex(c => c.id === cantiereData.id);
                if (index !== -1) {
                    this.cantieri[index] = cantiere;
                }
            } else {
                // Nuovo cantiere
                this.cantieri.push(cantiere);
            }

            await FirestoreService.saveCantieri(this.cantieri);
            return cantiere;
        } catch (error) {
            console.error('Errore salvataggio cantiere:', error);
            throw error;
        }
    }

    async deleteCantiere(cantiereId) {
        try {
            this.cantieri = this.cantieri.filter(c => c.id !== cantiereId);
            await FirestoreService.saveCantieri(this.cantieri);
            return true;
        } catch (error) {
            console.error('Errore eliminazione cantiere:', error);
            throw error;
        }
    }

    getCantiereById(cantiereId) {
        return this.cantieri.find(c => c.id === cantiereId);
    }

    getAllCantieri() {
        return [...this.cantieri];
    }

    getCantieriByCategoria() {
        const grouped = {};
        
        // Inizializza con categorie esistenti
        this.categorie.forEach(cat => {
            grouped[cat.id] = {
                categoria: cat,
                cantieri: []
            };
        });
        
        // Aggiungi categoria "Generale" se non esiste
        if (!grouped['generale']) {
            grouped['generale'] = {
                categoria: { id: 'generale', name: 'Generale', color: '#6c757d', icon: 'bi-building' },
                cantieri: []
            };
        }
        
        // Raggruppa cantieri per categoria
        this.cantieri.forEach(cantiere => {
            const catId = cantiere.categoria || 'generale';
            if (!grouped[catId]) {
                grouped[catId] = {
                    categoria: { id: catId, name: catId, color: '#6c757d', icon: 'bi-building' },
                    cantieri: []
                };
            }
            if (cantiere.attivo !== false) {
                grouped[catId].cantieri.push(cantiere);
            }
        });
        
        return grouped;
    }

    getAllCategorie() {
        return [...this.categorie];
    }

    getCategoriaById(categoriaId) {
        return this.categorie.find(c => c.id === categoriaId);
    }

    validateCantiereData(data) {
        const errors = [];

        if (!data.name || !sanitizeString(data.name)) {
            errors.push('Nome cantiere obbligatorio');
        }

        if (!validateMinutes(data.minutes)) {
            errors.push('Minuti non validi');
        }

        return errors;
    }

    validateCategoriaData(data) {
        const errors = [];

        if (!data.name || !sanitizeString(data.name)) {
            errors.push('Nome categoria obbligatorio');
        }

        return errors;
    }
}