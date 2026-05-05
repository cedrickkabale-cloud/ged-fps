/**
 * Script de migration de base de données
 * Exécute le schéma SQL et crée toutes les tables
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import pool from './index';

export const runMigrations = async () => {
  try {
    console.log('🔄 Démarrage des migrations de base de données...');
    
    // Essayer plusieurs chemins possibles pour trouver schema.sql
    const possiblePaths = [
      join(__dirname, '../../..', 'database/schema.sql'),  // Depuis backend/src/db
      join(__dirname, '../../database/schema.sql'),         // Depuis backend/src
      join(__dirname, '../../../database/schema.sql'),      // Depuis backend
      '/app/database/schema.sql',                           // Chemin Railway absolu
      resolve('database/schema.sql'),                       // Chemin relatif depuis racine
    ];
    
    let schema: string | null = null;
    let foundPath: string | null = null;
    
    for (const path of possiblePaths) {
      try {
        schema = readFileSync(path, 'utf-8');
        foundPath = path;
        break;
      } catch (e) {
        // Essayer le prochain chemin
      }
    }
    
    if (!schema) {
      console.warn('⚠️ Fichier schema.sql non trouvé aux chemins attendus');
      console.warn('Chemins cherchés:', possiblePaths);
      console.warn('Les tables doivent être créées manuellement.');
      return false;
    }
    
    console.log(`✅ Fichier schema trouvé à: ${foundPath}`);
    
    // Exécuter le schéma complet
    await pool.query(schema);
    console.log('✅ Migrations réussies - Base de données prête!');
    return true;
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === '42P07' || error.code === '42710') {
      console.log('ℹ️ Tables existantes - Pas de migration nécessaire');
      return true;
    }
    console.error('❌ Erreur lors des migrations:', error);
    return false;
  }
};

// Export pour appel manuel
export default runMigrations;
