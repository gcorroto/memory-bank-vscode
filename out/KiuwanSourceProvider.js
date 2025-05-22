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
const KiuwanService_1 = require("./KiuwanService");
const ConfigLog4j_1 = require("./utils/ConfigLog4j");
const Utils = require("./utils/utils");
const log = ConfigLog4j_1.LogFactory.getLogger("k4d.KiuwanSourceProvider");
class KiuwanSourceProvider {
    constructor(defectsProvider) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.defectsProvider = defectsProvider;
    }
    refresh() {
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
            if (!element) {
                // Root, check license only here to avoid checking it N times in parallel because of root's children
                try {
                    yield KiuwanService_1.KiuwanService.getKiuwanLicenseApi().getLicenseLocked();
                }
                catch (error) {
                    if (error.stack) {
                        log.error(error.stack);
                    }
                    else if (error.body) {
                        log.error(error.body);
                    }
                    else {
                        log.error('Error requesting license to Kiuwan License API, dumping unknown error object:');
                        log.error(error);
                    }
                    if (error.message) {
                        vscode.window.showErrorMessage('Kiuwan license error: ' + error.message, 'OK');
                        KiuwanService_1.KiuwanService.getKiuwanLicenseApi().release().then(() => {
                            console.log('Licencia liberada exitosamente.');
                        }).catch((error) => {
                            console.error('Error al liberar la licencia:', error);
                        });
                    }
                    else if (error.body) {
                        vscode.window.showErrorMessage('Kiuwan license error: ' + error.body, 'OK');
                        KiuwanService_1.KiuwanService.getKiuwanLicenseApi().release().then(() => {
                            console.log('Licencia liberada exitosamente.');
                        }).catch((error) => {
                            console.error('Error al liberar la licencia:', error);
                        });
                    }
                    else {
                        vscode.window.showErrorMessage('Error requesting license to Kiuwan License API', 'OK');
                    }
                    return Promise.resolve([new SourceTreeItem('Cannot show analysis results, there were problems checking Kiuwan license')]);
                }
                finally {
                    // When we're done with license, for better or worse, force defects list refresh (it'll either re-populate or clear list)
                    this.defectsProvider.refresh();
                }
                // Root, populate with static first-level elements such as Application, Source, Filters, etc
                let children = [];
                // Application -> name
                let applicationItemChildren = [];
                let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
                let appLabel = remoteApplication ? remoteApplication : 'Undefined';
                applicationItemChildren.push(new SourceTreeItem(appLabel));
                let applicationItem = new SourceTreeItem('Application', vscode.TreeItemCollapsibleState.Expanded, applicationItemChildren);
                children.push(applicationItem);
                // Source -> Last baseline analysis | Action plan | Audit delivery | Delivery (· <name> | <code>)
                let sourceItemChildren = [];
                let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource', '');
                let analysisSourceLabel;
                switch (analysisSource) {
                    case 'Delivery':
                        let deliveryCode = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery').get('code', '');
                        analysisSourceLabel = analysisSource + ' • ' + deliveryCode;
                        break;
                    case 'Audit delivery':
                        let auditDeliveryCode = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('code', '');
                        analysisSourceLabel = analysisSource + ' • ' + auditDeliveryCode;
                        break;
                    case 'Action plan':
                        let actionPlanName = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceActionPlan').get('name', '');
                        analysisSourceLabel = analysisSource + ' • ' + actionPlanName;
                        break;
                    case 'Last baseline analysis':
                    default:
                        analysisSourceLabel = analysisSource;
                        break;
                }
                sourceItemChildren.push(new SourceTreeItem(analysisSourceLabel));
                let sourceItem = new SourceTreeItem('Source', vscode.TreeItemCollapsibleState.Expanded, sourceItemChildren);
                children.push(sourceItem);
                // Filters -> Priorities & Characteristics & Languages & File pattern
                let filtersItemChildren = [];
                let filtersConfig = vscode.workspace.getConfiguration('kiuwan.defectsList.filters');
                let byCharacteristic = filtersConfig.get('byCharacteristic', '');
                if (byCharacteristic) {
                    let characteristics = byCharacteristic.split(',');
                    let characteristicsItemName = 'Characteristics • ' + characteristics.join(', ');
                    filtersItemChildren.push(new SourceTreeItem(characteristicsItemName));
                }
                let byLanguage = filtersConfig.get('byLanguage', '');
                if (byLanguage) {
                    let languages = byLanguage.split(',');
                    let languagesItemName = 'Languages • ' + languages.join(', ');
                    filtersItemChildren.push(new SourceTreeItem(languagesItemName));
                }
                let byPriority = filtersConfig.get('byPriority', '');
                if (byPriority) {
                    let priorities = byPriority.split(',');
                    let prioritiesItemName = 'Priorities • ' + priorities.join(', ');
                    filtersItemChildren.push(new SourceTreeItem(prioritiesItemName));
                }
                let byFilePattern = filtersConfig.get('byFilePattern', '');
                if (byFilePattern) {
                    let filePatternItemName = 'File Pattern • ' + byFilePattern;
                    filtersItemChildren.push(new SourceTreeItem(filePatternItemName));
                }
                if (filtersItemChildren.length == 0) {
                    filtersItemChildren.push(new SourceTreeItem('None'));
                }
                let filtersItem = new SourceTreeItem('Filters', vscode.TreeItemCollapsibleState.Expanded, filtersItemChildren);
                children.push(filtersItem);
                // Order by -> (Priority | Effort) & (descendant | ascendant)
                let orderItemChildren = [];
                let orderConfig = vscode.workspace.getConfiguration('kiuwan.defectsList.order');
                let orderBy = orderConfig.get('by', '');
                let orderDirection = orderConfig.get('direction', '');
                orderItemChildren.push(new SourceTreeItem(orderBy + ' ' + orderDirection));
                let orderItem = new SourceTreeItem('Order by', vscode.TreeItemCollapsibleState.Expanded, orderItemChildren);
                children.push(orderItem);
                // Limit -> # defects
                let limitItemChildren = [];
                let limit = vscode.workspace.getConfiguration('kiuwan.defectsList').get('defectsLimit', 100);
                if (limit > 0) {
                    limitItemChildren.push(new SourceTreeItem(limit + ' defects'));
                    let limitItem = new SourceTreeItem('Limit', vscode.TreeItemCollapsibleState.Expanded, limitItemChildren);
                    children.push(limitItem);
                }
                // Defects count · <total> -> Very high · <count> & High · <count> & Normal · <count> & Low · <count> & Very low · <count>
                try {
                    let metrics;
                    switch (analysisSource) {
                        case 'Delivery':
                            let deliveryConfig = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery');
                            let deliveryCode = deliveryConfig.get('code', '');
                            let deliveryPickRange = deliveryConfig.get('pickRange', '');
                            let limit;
                            let maxdays;
                            switch (deliveryPickRange) {
                                case 'Last 10':
                                    limit = 10;
                                    break;
                                case 'Today':
                                    maxdays = 1;
                                    break;
                                case 'Last 7 days':
                                    maxdays = 7;
                                    break;
                                case 'Last 30 days':
                                    maxdays = 30;
                                    break;
                            }
                            let getDeliveryResult = yield KiuwanService_1.KiuwanService.getDeliveryApi().listDeliveries(remoteApplication, maxdays, 1, limit);
                            if (getDeliveryResult.body) {
                                getDeliveryResult.body.forEach((delivery) => {
                                    if (delivery.code == deliveryCode) {
                                        metrics = delivery.metrics;
                                    }
                                });
                            }
                            break;
                        case 'Audit delivery':
                            let auditDeliveryCode = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('code', '');
                            let getAuditResultResult = yield KiuwanService_1.KiuwanService.getAuditApi().getAuditResult(auditDeliveryCode);
                            metrics = getAuditResultResult.body.metrics;
                            break;
                        case 'Action plan':
                            let actionPlanName = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceActionPlan').get('name', '');
                            let getActionPlanResult = yield KiuwanService_1.KiuwanService.getActionPlanApi().getActionPlan(remoteApplication, actionPlanName);
                            metrics = getActionPlanResult.body.metrics;
                            break;
                        case 'Last baseline analysis':
                        default:
                            let listAnalysesResult = yield KiuwanService_1.KiuwanService.getAnalysesApi().listAnalyses(remoteApplication, true, true, 1);
                            metrics = listAnalysesResult.body[0].metrics;
                            break;
                    }
                    let countItemChildren = [];
                    let totalCount = KiuwanService_1.KiuwanService.getTotalDefectsCount(metrics);
                    let countItemName = 'Defects count • ' + totalCount;
                    let veryHighItemName = 'Very high • ' + KiuwanService_1.KiuwanService.getVeryHighDefectsCount(metrics);
                    countItemChildren.push(new SourceTreeItem(veryHighItemName));
                    let highItemName = 'High • ' + KiuwanService_1.KiuwanService.getHighDefectsCount(metrics);
                    countItemChildren.push(new SourceTreeItem(highItemName));
                    let normalItemName = 'Normal • ' + KiuwanService_1.KiuwanService.getNormalDefectsCount(metrics);
                    countItemChildren.push(new SourceTreeItem(normalItemName));
                    let lowItemName = 'Low • ' + KiuwanService_1.KiuwanService.getLowDefectsCount(metrics);
                    countItemChildren.push(new SourceTreeItem(lowItemName));
                    let veryLowItemName = 'Very low • ' + KiuwanService_1.KiuwanService.getVeryLowDefectsCount(metrics);
                    countItemChildren.push(new SourceTreeItem(veryLowItemName));
                    let countItem = new SourceTreeItem(countItemName, vscode.TreeItemCollapsibleState.Expanded, countItemChildren);
                    children.push(countItem);
                }
                catch (error) {
                    // If this fails, then something's wrong with connection, warn both in section contents and message
                    if (error.message) {
                        if (error.stack) {
                            log.error(error.stack);
                        }
                        else {
                            log.error('Error retrieving defects count: ' + error.message);
                        }
                        vscode.window.showErrorMessage('Error retrieving defects count: ' + error.message, 'OK');
                    }
                    else if (error.response && error.response.body) {
                        let response = error.response;
                        let message = Utils.stripHtml(response.body);
                        if (response.statusCode && response.statusMessage)
                            message += ` (HTTP ${response.statusCode} = ${response.statusMessage})`;
                        log.error('Error retrieving defects count: ' + message);
                        vscode.window.showErrorMessage('Error retrieving defects count: ' + message, 'OK');
                    }
                    else {
                        log.error(error);
                        vscode.window.showErrorMessage('Unknown error retrieving defects count: ' + error, 'OK');
                    }
                    return Promise.resolve([new SourceTreeItem('Cannot show analysis results, there were problems retrieving data from Kiuwan')]);
                }
                return Promise.resolve(children);
            }
            else {
                // return SourceTreeItem param element's children
                return Promise.resolve(element.children);
            }
        });
    }
}
exports.KiuwanSourceProvider = KiuwanSourceProvider;
class SourceTreeItem extends vscode.TreeItem {
    constructor(text, collapsibleState = vscode.TreeItemCollapsibleState.None, children, command) {
        super(text, collapsibleState);
        this.text = text;
        this.collapsibleState = collapsibleState;
        this.children = children;
        this.command = command;
        this.contextValue = 'source-analysis-property';
    }
    get tooltip() {
        return this.text;
    }
}
//# sourceMappingURL=KiuwanSourceProvider.js.map