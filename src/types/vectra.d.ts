/**
 * Definiciones de tipos para la biblioteca Vectra
 * Este archivo proporciona definiciones de tipo para facilitar el uso de la biblioteca Vectra
 * dentro de un proyecto TypeScript.
 */

/**
 * Tipo para los metadatos en resultados de búsqueda
 */
export interface VectraMetadata {
    filePath?: string;
    fileName?: string;
    extension?: string;
    code?: string;
    chunkIndex?: number;
    totalChunks?: number;
    [key: string]: any;
}

/**
 * Interfaz para elementos que se insertan en el índice
 */
export interface VectraItem {
    vector: number[];
    metadata: VectraMetadata;
    id?: string;
}

/**
 * Interfaz para resultados de búsqueda
 */
export interface VectraSearchResult {
    id: string;
    score: number;
    metadata: VectraMetadata;
}

/**
 * Opciones para la creación de índices
 */
export interface VectraIndexOptions {
    dimensions?: number;
    similarity?: 'cosine' | 'dot' | 'euclidean';
    centralizing?: boolean;
}

/**
 * Opciones para consultas
 */
export interface VectraQueryOptions {
    topK?: number;
    filter?: (metadata: VectraMetadata) => boolean;
}

/**
 * Clase principal para índices locales
 */
export class VectraLocalIndex {
    /**
     * Constructor para un índice local
     * @param path Ruta donde se almacenará el índice
     * @param options Opciones para la creación del índice
     */
    constructor(path: string, options?: VectraIndexOptions);

    /**
     * Crea un nuevo índice
     */
    createIndex(): Promise<void>;

    /**
     * Verifica si el índice ya ha sido creado
     */
    isIndexCreated(): Promise<boolean>;

    /**
     * Elimina el índice existente
     */
    deleteIndex(): Promise<void>;

    /**
     * Inserta un elemento en el índice
     * @param item Elemento a insertar
     */
    insertItem(item: VectraItem): Promise<string>;

    /**
     * Inserta múltiples elementos en el índice
     * @param items Elementos a insertar
     */
    insertItems(items: VectraItem[]): Promise<string[]>;

    /**
     * Realiza una búsqueda de similitud
     * @param vector Vector de consulta
     * @param options Opciones de consulta
     */
    similaritySearch(vector: number[], options?: VectraQueryOptions): Promise<VectraSearchResult[]>;

    /**
     * Obtiene un elemento por su ID
     * @param id ID del elemento
     */
    getItem(id: string): Promise<VectraItem | null>;

    /**
     * Elimina un elemento por su ID
     * @param id ID del elemento a eliminar
     */
    deleteItem(id: string): Promise<void>;

    /**
     * Actualiza un elemento existente
     * @param id ID del elemento a actualizar
     * @param item Nuevos datos del elemento
     */
    updateItem(id: string, item: Partial<VectraItem>): Promise<void>;
}

/**
 * Clase para índices en memoria (sin persistencia)
 */
export class VectraMemoryIndex {
    constructor(options?: VectraIndexOptions);
    
    // Mismos métodos que VectraLocalIndex excepto los relacionados con persistencia
    insertItem(item: VectraItem): Promise<string>;
    insertItems(items: VectraItem[]): Promise<string[]>;
    similaritySearch(vector: number[], options?: VectraQueryOptions): Promise<VectraSearchResult[]>;
    getItem(id: string): Promise<VectraItem | null>;
    deleteItem(id: string): Promise<void>;
    updateItem(id: string, item: Partial<VectraItem>): Promise<void>;
}

/**
 * Función para generar un índice local
 * @param path Ruta donde se almacenará el índice
 * @param options Opciones para la creación del índice
 */
export function createLocalIndex(path: string, options?: VectraIndexOptions): VectraLocalIndex;

/**
 * Función para generar un índice en memoria
 * @param options Opciones para la creación del índice
 */
export function createMemoryIndex(options?: VectraIndexOptions): VectraMemoryIndex; 