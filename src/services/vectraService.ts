export function createIndex(directory: string): Promise<void> {
  // En una implementación real, aquí crearíamos un índice de Vectra
  console.log(`Creating Vectra index for ${directory}`);
  return Promise.resolve();
}

export function query(query: string): Promise<string[]> {
  // En una implementación real, aquí consultaríamos el índice de Vectra
  return Promise.resolve(['Resultado simulado 1', 'Resultado simulado 2']);
} 