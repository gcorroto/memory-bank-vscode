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
// The module 'vscode' contains the VS Code extensibility API. Import the module and reference it with the alias vscode in your code below.
const vscode = require("vscode");
class KiuwanDetailsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.contents = null;
    }
    refresh(contents) {
        this.contents = contents;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            if (vscode.workspace.name == null) {
                vscode.window.showInformationMessage('No defect bean in empty workspace');
                return Promise.resolve([]);
            }
            // Don't care about element, it should always be null anyway; see if we have some contents set
            if (this.contents) {
                let children = [];
                this.contents.keys().forEach(key => {
                    let value = this.contents[key];
                    let text = key + ' • ' + value;
                    children.push(new DetailsTreeItem(text));
                });
                return Promise.resolve(children);
            }
            else {
                return Promise.resolve([]);
            }
        });
    }
}
exports.KiuwanDetailsProvider = KiuwanDetailsProvider;
class DetailsTreeItem extends vscode.TreeItem {
    constructor(text) {
        super(text, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'defect-details-property';
        this.text = text;
    }
    get tooltip() {
        return this.text;
    }
}
//# sourceMappingURL=KiuwanDetailsProvider.js.map