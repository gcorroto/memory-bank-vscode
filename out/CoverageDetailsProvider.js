// Define el patrón _awaiter y __generator para TypeScript
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	return new (P || (P = Promise))(function (resolve, reject) {
					function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
					function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
					function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
					step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};

// Para un entorno sin `async/await` directo
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class CoverageDetailsProvider {
	_onDidChangeTreeData = new vscode.EventEmitter();
	onDidChangeTreeData = this._onDidChangeTreeData.event;
	details = [];
	

	updateDetails(actionDescription) {
		// Divide el `actionDescription` en párrafos usando doble salto de línea como delimitador
		this.details = actionDescription.split('\n\n').map(paragraph => paragraph.trim()).filter(paragraph => paragraph);
		this._onDidChangeTreeData.fire(); // Refresca la vista
	}

	getTreeItem(element) {
		// Cada elemento es un párrafo del `actionDescription`
		const treeItem = new vscode.TreeItem(element.slice(0, 50) + "...", vscode.TreeItemCollapsibleState.None); // Vista preliminar del texto
		treeItem.description = element.slice(0, 50) + "..."; // Agregar descripción con una previa del texto
		treeItem.tooltip = element; // Tooltip con el texto completo del párrafo
		return treeItem;
	}

	getChildren() {
		// Retorna cada párrafo como un elemento independiente en el árbol
		return this.details;
	}
}

exports.CoverageDetailsProvider = CoverageDetailsProvider;