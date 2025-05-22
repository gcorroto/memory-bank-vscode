'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

/**
 * Provider for displaying details about the current action or analysis
 */
class CoverageDetailsProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    details = [];
    
    constructor() {
        // Initialize with empty details
    }
    
    /**
     * Update the details to be displayed in the view
     * @param {string} actionDescription Description of the action
     */
    updateDetails(actionDescription) {
        // Split the `actionDescription` into paragraphs by double newlines
        this.details = actionDescription.split('\n\n')
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph);
        this._onDidChangeTreeData.fire(); // Refresh the view
    }
    
    getTreeItem(element) {
        // Each element is a paragraph from the `actionDescription`
        const treeItem = new vscode.TreeItem(
            element.slice(0, 50) + "...", 
            vscode.TreeItemCollapsibleState.None
        ); 
        treeItem.description = element.slice(0, 50) + "..."; // Add description with text preview
        treeItem.tooltip = element; // Tooltip with full paragraph text
        return treeItem;
    }
    
    getChildren() {
        // Return each paragraph as an independent element in the tree
        return this.details;
    }
    
    /**
     * Refresh the view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

exports.CoverageDetailsProvider = CoverageDetailsProvider;