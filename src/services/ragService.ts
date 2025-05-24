export function query(question: string): Promise<string> {
  // En una implementación real, aquí usaríamos RAG para responder a la pregunta
  console.log(`RAG query for: ${question}`);
  return Promise.resolve('Respuesta RAG simulada');
} 