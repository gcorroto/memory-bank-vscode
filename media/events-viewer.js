// JavaScript para el visor de eventos y cambios

// Obtener el objeto vscode que permite comunicación con la extensión
const vscode = acquireVsCodeApi();

// Funciones para interactuar con la extensión
function showDetails(eventId) {
    vscode.postMessage({
        command: 'showDetails',
        eventId: eventId
    });
}

function showChanges(eventId) {
    vscode.postMessage({
        command: 'showChanges',
        eventId: eventId
    });
}

function toggleTerminal() {
    vscode.postMessage({
        command: 'toggleTerminal'
    });
}

function clearEvents() {
    if (confirm('¿Estás seguro de que deseas eliminar todos los eventos?')) {
        vscode.postMessage({
            command: 'clearEvents'
        });
    }
}

function executeCommand() {
    const commandInput = document.getElementById('command-input');
    const command = commandInput.value.trim();
    
    if (!command) {
        alert('Por favor, ingresa un comando para ejecutar.');
        return;
    }
    
    vscode.postMessage({
        command: 'executeCommand',
        commandText: command
    });
    
    // Limpiar el input después de enviar
    commandInput.value = '';
}

// Configurar listeners cuando se carga el documento
document.addEventListener('DOMContentLoaded', () => {
    // Manejar tecla Enter en el input de comandos
    const commandInput = document.getElementById('command-input');
    if (commandInput) {
        commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                executeCommand();
            }
        });
    }
    
    // Hacer que los elementos de eventos sean expandibles/colapsables
    document.querySelectorAll('.event-item').forEach(item => {
        const header = item.querySelector('.event-header');
        const description = item.querySelector('.event-description');
        
        if (header && description) {
            header.addEventListener('click', (e) => {
                // No colapsar si se hizo clic en un botón
                if (e.target.closest('.action-button')) {
                    return;
                }
                
                // Alternar visibilidad
                if (description.style.display === 'none') {
                    description.style.display = 'block';
                } else {
                    description.style.display = 'none';
                }
            });
        }
    });
}); 