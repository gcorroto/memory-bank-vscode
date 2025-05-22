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

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { FileTreeService } = require('./utils/FileTreeService');

/**
 * Provider for the file tree view that shows project structure
 * This is the renamed and refactored version of the original CoverageDefectsProvider
 * that now works with the local file system instead of Kiuwan/Jenkins
 */
class CoverageDefectsProvider {
	_onDidChangeTreeData = new vscode.EventEmitter();
	_onFileSelected = new vscode.EventEmitter();
	onFileSelected = this._onFileSelected.event;
	onDidChangeTreeData = this._onDidChangeTreeData.event;
	logger;
	fileTreeService;

	constructor(logger) {
		this.logger = logger;
		this.fileTreeService = new FileTreeService(logger);
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		const treeItem = new vscode.TreeItem(element.label);
		if (element.isFile) {
			treeItem.command = {
				command: 'grec0ai.filesystem.showFileDetails', 
				title: 'Show File Details ' + element.label,
				arguments: [element] 
			};
			element = treeItem;
		}
		return element;
	}

	getChildren(element) {
		return __awaiter(this, void 0, void 0, function* () {
			if (!element) {
				vscode.window.showInformationMessage('Loading project file tree...');
				try {
					const rootPath = this.getProjectFolder();
					const fileTree = yield this.fileTreeService.getFileTree(rootPath);
					return this.buildCoverageTree(fileTree);
				} catch (error) {
					vscode.window.showErrorMessage(`Error loading file tree: ${error.message}`);
					this.logger.appendLine(`Error: ${error.message}`);
					return [];
				}
			} else {
				if (element.isFile) {
					// When a file is selected, emit an event
					this._onFileSelected.fire({
						path: element.path,
						label: element.label
					});
					return [];
				} else {
					// For directories, return children
					if (element.children && Array.isArray(element.children)) {
						return element.children;
					}
					return [];
				}
			}
		});
	}

	/**
	 * Get project folder from configuration or use root
	 */
	getProjectFolder() {
		const folderApp = vscode.workspace.getConfiguration('grec0ai.filesystem').get('projectFolder') || '';
		return folderApp;
	}

	/**
	 * Build tree items from file system tree
	 */
	async buildCoverageTree(fileNodes) {
		const rootItems = [];
		
		if (Array.isArray(fileNodes)) {
			for (const node of fileNodes) {
				const treeItem = new CoverageDefectTreeItem(
					node.label,
					node.isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
					node.path,
					node.isFile
				);

				// Recursively process children
				if (node.children && node.children.length > 0) {
					treeItem.children = await this.buildCoverageTree(node.children);
				}

				rootItems.push(treeItem);
			}
		} else {
			this.logger.appendLine('File nodes is not an array:', fileNodes);
		}

		return rootItems;
	}

	/**
	 * Find all coverage files recursively in the tree
	 * This replaces the Jenkins API call that was previously used
	 */
	async getAllCoverageFiles() {
		try {
			const rootPath = this.getProjectFolder();
			const fileTree = await this.fileTreeService.getFileTree(rootPath);
			const files = [];
			
			// Helper function to extract all files recursively
			const extractFiles = (nodes) => {
				for (const node of nodes) {
					if (node.isFile) {
						files.push(node);
					} else if (node.children && node.children.length > 0) {
						extractFiles(node.children);
					}
				}
			};
			
			extractFiles(fileTree);
			return files;
		} catch (error) {
			this.logger.appendLine(`Error getting coverage files: ${error.message}`);
			vscode.window.showErrorMessage(`Error getting coverage files: ${error.message}`);
			return [];
		}
	}
}

/**
 * Tree item for the coverage tree view
 */
class CoverageDefectTreeItem extends vscode.TreeItem {
	children = [];
	
	constructor(
		label,
		collapsibleState,
		path,
		isFile,
		toolTip,
		description
	) {
		super(label, collapsibleState);
		this.setIcon();
		this.path = path;
		this.isFile = isFile;
		this.tooltip = toolTip || path;
		this.description = description;
	}

	setIcon() {
		if (this.isFile) {
			this.iconPath = new vscode.ThemeIcon('file');
		} else {
			this.iconPath = new vscode.ThemeIcon('folder');
		}
	}
}

exports.CoverageDefectsProvider = CoverageDefectsProvider;
