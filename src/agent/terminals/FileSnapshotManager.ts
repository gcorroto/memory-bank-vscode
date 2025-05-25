/**
 * Sistema para gestionar snapshots y diff de archivos
 * Permite comparar el estado de archivos antes y después de operaciones
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface FileSnapshot {
    path: string;
    content: string;
    timestamp: Date;
    hash: string;
}

export interface FileDiff {
    filePath: string;
    beforeUri?: vscode.Uri;
    afterUri?: vscode.Uri;
    hasChanges: boolean;
    snapBefore?: FileSnapshot;
    snapAfter?: FileSnapshot;
}

export class FileSnapshotManager {
    private snapshots: Map<string, FileSnapshot[]>;
    private tempDir: string;

    constructor() {
        this.snapshots = new Map();
        this.tempDir = path.join(os.tmpdir(), 'grec0ai-snapshots');
        
        // Asegurar que el directorio temporal existe
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Crea un snapshot de uno o más archivos
     * @param filePaths - Rutas de archivos para crear snapshot
     * @param snapshotId - Identificador opcional del snapshot
     * @returns ID del snapshot creado
     */
    async createSnapshot(filePaths: string | string[], snapshotId: string = `snap-${Date.now()}`): Promise<string> {
        // Normalizar a array
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        
        // Array para almacenar los snapshots creados
        const newSnapshots: FileSnapshot[] = [];
        
        // Crear snapshot para cada archivo
        for (const filePath of paths) {
            try {
                // Verificar si el archivo existe
                if (!fs.existsSync(filePath)) {
                    console.warn(`El archivo ${filePath} no existe, omitiendo snapshot`);
                    continue;
                }
                
                // Leer el contenido del archivo
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Calcular hash del contenido
                const hash = this.calculateHash(content);
                
                // Crear el snapshot
                const snapshot: FileSnapshot = {
                    path: filePath,
                    content,
                    timestamp: new Date(),
                    hash
                };
                
                newSnapshots.push(snapshot);
            } catch (error) {
                console.error(`Error al crear snapshot para ${filePath}:`, error);
            }
        }
        
        // Guardar los snapshots bajo el ID proporcionado
        this.snapshots.set(snapshotId, newSnapshots);
        
        return snapshotId;
    }
    
    /**
     * Calcula un hash del contenido para identificar cambios rápidamente
     */
    private calculateHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }
    
    /**
     * Obtiene un snapshot por su ID
     */
    getSnapshot(snapshotId: string): FileSnapshot[] | undefined {
        return this.snapshots.get(snapshotId);
    }
    
    /**
     * Compara dos snapshots y genera información de diff
     * @param beforeId - ID del snapshot anterior
     * @param afterId - ID del snapshot posterior (o undefined para usar el estado actual de los archivos)
     * @returns Array de información de diff para cada archivo
     */
    async compareSnapshots(beforeId: string, afterId?: string): Promise<FileDiff[]> {
        const diffs: FileDiff[] = [];
        
        // Obtener el snapshot "antes"
        const beforeSnapshots = this.snapshots.get(beforeId);
        if (!beforeSnapshots) {
            throw new Error(`Snapshot no encontrado: ${beforeId}`);
        }
        
        // Para cada archivo en el snapshot "antes"
        for (const beforeSnap of beforeSnapshots) {
            let afterSnap: FileSnapshot | undefined;
            
            // Si tenemos un ID de snapshot "después", buscar el archivo correspondiente
            if (afterId) {
                const afterSnapshots = this.snapshots.get(afterId);
                if (afterSnapshots) {
                    afterSnap = afterSnapshots.find(s => s.path === beforeSnap.path);
                }
            } else {
                // Si no hay ID "después", usar el estado actual del archivo
                try {
                    if (fs.existsSync(beforeSnap.path)) {
                        const currentContent = fs.readFileSync(beforeSnap.path, 'utf8');
                        const currentHash = this.calculateHash(currentContent);
                        
                        afterSnap = {
                            path: beforeSnap.path,
                            content: currentContent,
                            timestamp: new Date(),
                            hash: currentHash
                        };
                    }
                } catch (error) {
                    console.error(`Error leyendo el estado actual de ${beforeSnap.path}:`, error);
                }
            }
            
            // Determinar si hay cambios
            const hasChanges = afterSnap ? beforeSnap.hash !== afterSnap.hash : true;
            
            // Crear los archivos temporales para el diff si hay cambios
            let beforeUri: vscode.Uri | undefined;
            let afterUri: vscode.Uri | undefined;
            
            if (hasChanges) {
                // Crear archivo temporal para el estado "antes"
                const beforeFileName = `${path.basename(beforeSnap.path)}.before-${beforeId}`;
                const beforeFilePath = path.join(this.tempDir, beforeFileName);
                fs.writeFileSync(beforeFilePath, beforeSnap.content);
                beforeUri = vscode.Uri.file(beforeFilePath);
                
                // Crear archivo temporal para el estado "después" si existe
                if (afterSnap) {
                    const afterFileName = `${path.basename(afterSnap.path)}.after-${afterId || 'current'}`;
                    const afterFilePath = path.join(this.tempDir, afterFileName);
                    fs.writeFileSync(afterFilePath, afterSnap.content);
                    afterUri = vscode.Uri.file(afterFilePath);
                }
            }
            
            // Agregar la información de diff
            diffs.push({
                filePath: beforeSnap.path,
                beforeUri,
                afterUri,
                hasChanges,
                snapBefore: beforeSnap,
                snapAfter: afterSnap
            });
        }
        
        return diffs;
    }
    
    /**
     * Muestra una vista de diff para un archivo específico
     * @param diff - Información de diff para el archivo
     * @param title - Título para la ventana de diff
     */
    showDiff(diff: FileDiff, title: string = 'Cambios en archivo'): void {
        if (!diff.hasChanges || !diff.beforeUri || !diff.afterUri) {
            vscode.window.showInformationMessage(`No hay cambios que mostrar para ${diff.filePath}`);
            return;
        }
        
        // Construir un título descriptivo
        const fileName = path.basename(diff.filePath);
        const fullTitle = `${title}: ${fileName}`;
        
        // Mostrar la vista de diff
        vscode.commands.executeCommand('vscode.diff', 
            diff.beforeUri, 
            diff.afterUri, 
            fullTitle
        );
    }
    
    /**
     * Muestra una vista de diff para todos los archivos cambiados
     * @param diffs - Array de información de diff
     * @param title - Prefijo para el título de las ventanas de diff
     */
    showAllDiffs(diffs: FileDiff[], title: string = 'Cambios'): void {
        const changedDiffs = diffs.filter(d => d.hasChanges && d.beforeUri && d.afterUri);
        
        if (changedDiffs.length === 0) {
            vscode.window.showInformationMessage('No hay cambios que mostrar');
            return;
        }
        
        // Mostrar diff para cada archivo cambiado
        changedDiffs.forEach((diff, index) => {
            // Pequeño retraso para evitar que todas las ventanas se abran simultáneamente
            setTimeout(() => {
                this.showDiff(diff, title);
            }, index * 300);
        });
    }
    
    /**
     * Crea archivos temporales con el contenido antes y después para un diff
     * @param filePath - Ruta del archivo
     * @param contentBefore - Contenido antes del cambio
     * @param contentAfter - Contenido después del cambio
     * @returns Objeto con URIs para el diff
     */
    createTempFilesForDiff(filePath: string, contentBefore: string, contentAfter: string): { beforeUri: vscode.Uri, afterUri: vscode.Uri } {
        const fileName = path.basename(filePath);
        const tempId = Date.now().toString();
        
        // Crear archivo temporal para "antes"
        const beforeFileName = `${fileName}.before-${tempId}`;
        const beforeFilePath = path.join(this.tempDir, beforeFileName);
        fs.writeFileSync(beforeFilePath, contentBefore);
        
        // Crear archivo temporal para "después"
        const afterFileName = `${fileName}.after-${tempId}`;
        const afterFilePath = path.join(this.tempDir, afterFileName);
        fs.writeFileSync(afterFilePath, contentAfter);
        
        return {
            beforeUri: vscode.Uri.file(beforeFilePath),
            afterUri: vscode.Uri.file(afterFilePath)
        };
    }
    
    /**
     * Muestra un diff directo entre dos contenidos
     * @param filePath - Ruta del archivo (para el título)
     * @param contentBefore - Contenido antes del cambio
     * @param contentAfter - Contenido después del cambio
     * @param title - Título para la ventana de diff
     */
    showContentDiff(filePath: string, contentBefore: string, contentAfter: string, title: string = 'Cambios'): void {
        const { beforeUri, afterUri } = this.createTempFilesForDiff(filePath, contentBefore, contentAfter);
        const fileName = path.basename(filePath);
        
        // Mostrar la vista de diff
        vscode.commands.executeCommand('vscode.diff', 
            beforeUri, 
            afterUri, 
            `${title}: ${fileName}`
        );
    }
    
    /**
     * Elimina todos los archivos temporales y libera recursos
     */
    dispose(): void {
        try {
            // Limpiar directorio temporal
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
            }
        } catch (error) {
            console.error('Error al limpiar archivos temporales:', error);
        }
        
        // Limpiar mapa de snapshots
        this.snapshots.clear();
    }
} 