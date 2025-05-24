export function initialize() {
  // Inicializar el servicio de OpenAI
  console.log('OpenAI service initialized');
}

export function callOpenAI(prompt: string): Promise<string> {
  // En una implementación real, aquí llamaríamos a la API de OpenAI
  return Promise.resolve('Respuesta simulada de OpenAI');
} 