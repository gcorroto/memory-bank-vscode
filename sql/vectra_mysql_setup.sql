-- Script de configuración para utilizar MySQL como Vector Store
-- Este script crea las tablas necesarias para almacenar embeddings vectoriales
-- y proporcionar capacidades de búsqueda semántica.

-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS grec0ai_vectra;

-- Usar la base de datos
USE grec0ai_vectra;

-- Crear tabla para almacenar los vectores de documentos
CREATE TABLE IF NOT EXISTS document_vectors (
    id VARCHAR(36) PRIMARY KEY,
    vector LONGBLOB NOT NULL,  -- Para almacenar embeddings como BLOB binario
    vector_dim INT NOT NULL,   -- Dimensión del vector (por ejemplo, 1536 para OpenAI embeddings)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índice para búsqueda rápida
    INDEX(created_at)
);

-- Crear tabla para almacenar metadatos de documentos
CREATE TABLE IF NOT EXISTS document_metadata (
    id VARCHAR(36) PRIMARY KEY,
    vector_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_extension VARCHAR(20),
    chunk_index INT DEFAULT 0,
    total_chunks INT DEFAULT 1,
    chunk_size INT,
    content LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices para búsquedas rápidas
    INDEX(file_path(255)),
    INDEX(file_name, file_extension),
    
    -- Clave foránea para relacionar con vectores
    FOREIGN KEY (vector_id) REFERENCES document_vectors(id) ON DELETE CASCADE
);

-- Tabla para cachear resultados de consultas recientes
CREATE TABLE IF NOT EXISTS query_cache (
    id VARCHAR(36) PRIMARY KEY,
    query_text TEXT NOT NULL,
    results_json LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índice para consultas frecuentes
    INDEX(created_at)
);

-- Crear una tabla para almacenar registros de indexación
CREATE TABLE IF NOT EXISTS indexing_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation VARCHAR(50) NOT NULL,
    file_path VARCHAR(1024),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índice para búsquedas de diagnóstico
    INDEX(operation, status),
    INDEX(created_at)
);

-- Crear una vista para fácil consulta de documentos con metadatos
CREATE OR REPLACE VIEW document_view AS
SELECT 
    dv.id AS vector_id,
    dv.vector_dim,
    dm.file_path,
    dm.file_name,
    dm.file_extension,
    dm.chunk_index,
    dm.total_chunks,
    dm.content,
    dm.created_at
FROM 
    document_vectors dv
JOIN 
    document_metadata dm ON dv.id = dm.vector_id;

-- Crear procedimiento almacenado para buscar vectores por similitud del coseno
-- Nota: Este es un procedimiento simplificado. Para producción se recomienda 
-- usar extensiones específicas para búsqueda vectorial como MySQL 8's JSON_TABLE 
-- o extensiones de terceros.
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS cosine_similarity_search(
    IN query_vector LONGBLOB,
    IN vector_dimension INT,
    IN max_results INT
)
BEGIN
    -- Esta es una implementación básica para demostración
    -- En producción, se recomienda usar extensiones específicas para búsqueda vectorial
    SELECT 
        dv.id, 
        dm.file_path,
        dm.file_name,
        dm.content,
        0.5 + (RAND() * 0.5) AS similarity -- Simulación de similaridad (0.5-1.0)
    FROM 
        document_vectors dv
    JOIN 
        document_metadata dm ON dv.id = dm.vector_id
    WHERE 
        dv.vector_dim = vector_dimension
    ORDER BY 
        similarity DESC -- En implementación real, calcularíamos similitud de coseno
    LIMIT max_results;
END //
DELIMITER ;

-- Crear procedimiento para insertar un nuevo documento con su vector
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS insert_document(
    IN p_id VARCHAR(36),
    IN p_vector LONGBLOB,
    IN p_vector_dim INT,
    IN p_file_path VARCHAR(1024),
    IN p_file_name VARCHAR(255),
    IN p_file_extension VARCHAR(20),
    IN p_chunk_index INT,
    IN p_total_chunks INT,
    IN p_chunk_size INT,
    IN p_content LONGTEXT
)
BEGIN
    -- Insertar el vector
    INSERT INTO document_vectors (id, vector, vector_dim)
    VALUES (p_id, p_vector, p_vector_dim);
    
    -- Insertar los metadatos
    INSERT INTO document_metadata (
        id, 
        vector_id, 
        file_path, 
        file_name, 
        file_extension, 
        chunk_index, 
        total_chunks, 
        chunk_size, 
        content
    )
    VALUES (
        UUID(), 
        p_id, 
        p_file_path, 
        p_file_name, 
        p_file_extension, 
        p_chunk_index, 
        p_total_chunks, 
        p_chunk_size, 
        p_content
    );
    
    -- Registrar la operación
    INSERT INTO indexing_log (operation, file_path, status, message)
    VALUES ('insert', p_file_path, 'success', CONCAT('Indexed document: ', p_file_name));
END //
DELIMITER ;

-- Crear procedimiento para eliminar documentos de un archivo
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS delete_documents_by_path(
    IN p_file_path VARCHAR(1024)
)
BEGIN
    -- Encontrar todos los vectores asociados con este archivo
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id VARCHAR(36);
    DECLARE cur CURSOR FOR 
        SELECT DISTINCT vector_id 
        FROM document_metadata 
        WHERE file_path = p_file_path;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Eliminar metadatos y vectores (CASCADE eliminará metadatos)
        DELETE FROM document_vectors WHERE id = v_id;
    END LOOP;
    
    CLOSE cur;
    
    -- Registrar la operación
    INSERT INTO indexing_log (operation, file_path, status, message)
    VALUES ('delete', p_file_path, 'success', CONCAT('Removed document: ', p_file_path));
END //
DELIMITER ;

-- Crear usuario con privilegios limitados para la aplicación
CREATE USER IF NOT EXISTS 'grec0ai_app'@'localhost' IDENTIFIED BY 'changeThisPassword!';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON grec0ai_vectra.* TO 'grec0ai_app'@'localhost';

-- Mensaje de finalización
SELECT 'Configuración de base de datos vectorial completada' AS 'Status'; 