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
const path = require("path");
// Imports from our sources
const KiuwanService_1 = require("./KiuwanService");
const Dictionary_1 = require("./utils/Dictionary");
const ConfigLog4j_1 = require("./utils/ConfigLog4j");
const Utils = require("./utils/utils");
const log = ConfigLog4j_1.LogFactory.getLogger("k4d.KiuwanDefectsProvider");
class KiuwanDefectsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.ruleTreeItems = new Dictionary_1.Dictionary();
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
                        log.error('Error requesting license to Kiuwan License API');
                    }
                    return Promise.resolve([]);
                }
                //  Root, clear previous tree and load defects ONLY HERE FOR THE FIRST TIME; otherwise each 'expand node user action' will retrieve them again
                this.ruleTreeItems = new Dictionary_1.Dictionary();
                let application = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
                if (!application)
                    return null;
                // Ensure that language labels are available for later
                try {
                    KiuwanService_1.KiuwanService.getLanguages();
                }
                catch (error) {
                    vscode.window.showErrorMessage('Some information might not be properly displayed: ' + error.message, 'OK');
                }
                let filtersConfig = vscode.workspace.getConfiguration('kiuwan.defectsList.filters');
                let characteristics = this.removeExtraSpaces(filtersConfig.get('byCharacteristic'));
                let languages = this.removeExtraSpaces(filtersConfig.get('byLanguage'));
                let priorities = this.removeExtraSpaces(filtersConfig.get('byPriority'));
                let fileContains = filtersConfig.get('byFilePattern');
                let orderConfig = vscode.workspace.getConfiguration('kiuwan.defectsList.order');
                let orderBy = orderConfig.get('by');
                let orderDirection = orderConfig.get('direction', '');
                let asc = 'Ascending' === orderDirection;
                let limit = vscode.workspace.getConfiguration('kiuwan.defectsList').get('defectsLimit', 100);
                if (limit != null && limit <= 0) {
                    limit = null;
                }
                let defects;
                // If filtered by language with label, transform them to language keys
                if (languages) {
                    let languagesChecked = languages.toLowerCase().split(',');
                    let languagesKeys = [];
                    let languagesMap = yield KiuwanService_1.KiuwanService.getLanguages();
                    for (let key in languagesMap) {
                        let value = languagesMap[key];
                        if (languagesChecked.indexOf(value.toLowerCase()) != -1) {
                            languagesKeys.push(key);
                        }
                    }
                    if (languagesKeys.length > 0) {
                        languages = languagesKeys.join(',');
                    }
                }
                try {
                    let analysisSource = vscode.workspace.getConfiguration('kiuwan.defectsList').get('analysisSource');
                    switch (analysisSource) {
                        case 'Delivery':
                            let deliveryCode = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceDelivery').get('code');
                            defects = yield KiuwanService_1.KiuwanService.getDeliveryDefects(deliveryCode, characteristics, languages, priorities, fileContains, orderBy, asc, limit);
                            break;
                        case 'Audit delivery':
                            let auditDeliveryCode = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceAuditDelivery').get('code');
                            defects = yield KiuwanService_1.KiuwanService.getAuditDefects(auditDeliveryCode, characteristics, languages, priorities, fileContains, orderBy, asc, limit);
                            break;
                        case 'Action plan':
                            let actionPlanName = vscode.workspace.getConfiguration('kiuwan.defectsList.analysisSourceActionPlan').get('name');
                            defects = yield KiuwanService_1.KiuwanService.getActionPlanDefects(application, actionPlanName, characteristics, languages, priorities, fileContains, orderBy, asc, limit);
                            break;
                        case 'Last baseline analysis':
                        default:
                            defects = yield KiuwanService_1.KiuwanService.getLastAnalysisDefects(application, characteristics, languages, priorities, fileContains, orderBy, asc, limit);
                            break;
                    }
                }
                catch (error) {
                    if (error.message) {
                        if (error.stack) {
                            log.error(error.stack);
                        }
                        else {
                            log.error('Error retrieving defects: ' + error.message);
                        }
                        vscode.window.showErrorMessage('Error retrieving defects: ' + error.message, 'OK');
                    }
                    else if (error.response && error.response.body) {
                        let response = error.response;
                        let message = Utils.stripHtml(response.body);
                        if (response.statusCode && response.statusMessage)
                            message += ` (HTTP ${response.statusCode} = ${response.statusMessage})`;
                        log.error('Error retrieving defects: ' + message);
                        vscode.window.showErrorMessage('Error retrieving defects: ' + message, 'OK');
                    }
                    else {
                        log.error(error);
                        vscode.window.showErrorMessage('Unknown error retrieving defects: ' + error, 'OK');
                    }
                    return null;
                }
                if (!defects || defects.length == 0) {
                    vscode.window.showInformationMessage('No defects found for the source and filters selected.');
                    return null;
                }
                // Now, populate first level with violated rules ('<priority_flag> <rulename>')
                defects.forEach((defect) => {
                    let item;
                    if (this.ruleTreeItems.containsKey(defect.ruleCode)) {
                        item = this.ruleTreeItems[defect.ruleCode];
                    }
                    else {
                        let text = DefectTreeItem.textForRule(defect);
                        let iconPath = DefectTreeItem.iconForRule(defect);
                        let details = DefectTreeItem.detailsForRule(defect);
                        item = new DefectTreeItem(DefectTreeItem.TREEITEM_TYPE_RULE, text, iconPath, details, vscode.TreeItemCollapsibleState.Collapsed);
                        item.docUrl = KiuwanService_1.KiuwanService.getRuleDocumentationURL(defect.modelId, defect.ruleCode);
                        DefectTreeItem.setRefreshDetailsCommand(item, details);
                        this.ruleTreeItems.put(defect.ruleCode, item);
                    }
                    DefectTreeItem.createDefectChild(item, defect);
                });
                let items = this.ruleTreeItems.values();
                // First level sorted by priority descending + name ascending
                items.sort((leftSide, rightSide) => {
                    let leftSidePriority = KiuwanService_1.KiuwanService.priorityFromString(leftSide.details[DefectTreeItem.DETAILS_PRIORITY]);
                    let rightSidePriority = KiuwanService_1.KiuwanService.priorityFromString(rightSide.details[DefectTreeItem.DETAILS_PRIORITY]);
                    if (leftSidePriority < rightSidePriority)
                        return -1;
                    if (leftSidePriority > rightSidePriority)
                        return 1;
                    if (leftSide.text < rightSide.text)
                        return -1;
                    if (leftSide.text > rightSide.text)
                        return 1;
                    return 0;
                });
                return Promise.resolve(items);
            }
            else {
                // Second ('<filename> · <defect_line>') or third level ('(SOURCE|PROPAGATION|SINK) · <filename> · <frame_line>'), return children from map
                let items = element.getChildren();
                if (items && items.length > 0) {
                    if (DefectTreeItem.TREEITEM_TYPE_DEFECT == items[0].contextValue) {
                        // Second level sorted by file name ascending + line ascending
                        items.sort((leftSide, rightSide) => {
                            let leftSideFile = leftSide.details[DefectTreeItem.DETAILS_FILE];
                            let rightSideFile = rightSide.details[DefectTreeItem.DETAILS_FILE];
                            if (leftSideFile < rightSideFile)
                                return -1;
                            if (leftSideFile > rightSideFile)
                                return 1;
                            let leftSideLine = leftSide.details[DefectTreeItem.DETAILS_LINE];
                            let rightSideLine = rightSide.details[DefectTreeItem.DETAILS_LINE];
                            if (leftSideLine < rightSideLine)
                                return -1;
                            if (leftSideLine > rightSideLine)
                                return 1;
                            return 0;
                        });
                    }
                    return Promise.resolve(items);
                }
                else {
                    return null;
                }
            }
        });
    }
    removeExtraSpaces(filterString) {
        if (filterString) {
            return filterString.split(',').map(chunk => chunk.trim()).join(',');
        }
        else {
            return filterString;
        }
    }
}
exports.KiuwanDefectsProvider = KiuwanDefectsProvider;
class DefectTreeItem extends vscode.TreeItem {
    constructor(contextValue, text, iconPath, details, collapsibleState) {
        super(text, collapsibleState);
        this.contextValue = contextValue;
        this.text = text;
        this.iconPath = iconPath;
        this.details = details;
    }
    static textForRule(defect) {
        return defect.rule;
    }
    static textForDefect(defect) {
        return defect.file + ' • ' + defect.line;
    }
    static textForFrame(frame, isSource, isSink) {
        let text = isSource ? 'SOURCE' : isSink ? 'SINK' : 'PROPAGATION';
        return text + ' • ' + frame.file + ' • ' + frame.lineNumber;
    }
    static iconForRule(defect) {
        let priority = KiuwanService_1.KiuwanService.priorityFromString(defect.priority.toString());
        let icon = 'priority_' + priority + '_flag.png';
        return {
            light: path.join(__filename, '..', '..', 'resources', 'icons', icon),
            dark: path.join(__filename, '..', '..', 'resources', 'icons', icon)
        };
    }
    static iconForDefect() {
        return vscode.ThemeIcon.File;
    }
    static iconForFrame(isSource, isSink) {
        let frameType = isSource ? 'source' : isSink ? 'sink' : 'propagation';
        return {
            light: path.join(__filename, '..', '..', 'resources', 'icons', 'light', 'frame_' + frameType + '.png'),
            dark: path.join(__filename, '..', '..', 'resources', 'icons', 'dark', 'frame_' + frameType + '.png')
        };
    }
    static detailsForRule(defect) {
        let details = new Dictionary_1.Dictionary();
        // Add all properties as they are in defect bean (this way they'll be shown in the same order)
        details.put(DefectTreeItem.DETAILS_RULE, defect.rule);
        details.put(DefectTreeItem.DETAILS_LANGUAGE, defect.language);
        details.put(DefectTreeItem.DETAILS_CHARACTERISTIC, defect.characteristic);
        details.put(DefectTreeItem.DETAILS_PRIORITY, defect.priority);
        details.put(DefectTreeItem.DETAILS_EFFORT, KiuwanService_1.KiuwanService.effortAsLabel(defect.effort));
        if (defect.vulnerabilityType) {
            details.put(DefectTreeItem.DETAILS_VULNERABILITY_TYPE, defect.vulnerabilityType);
        }
        // Then, try to overwrite language with label translated by KiuwanService
        KiuwanService_1.KiuwanService.getLanguages().then(languages => {
            if (languages[defect.language]) {
                details.put(DefectTreeItem.DETAILS_LANGUAGE, languages[defect.language]);
            }
        });
        return details;
    }
    static detailsForDefect(defect) {
        let details = new Dictionary_1.Dictionary();
        details.put(DefectTreeItem.DETAILS_DEFECT_ID, defect.defectId);
        details.put(DefectTreeItem.DETAILS_FILE, defect.file);
        details.put(DefectTreeItem.DETAILS_LINE, defect.line);
        details.put(DefectTreeItem.DETAILS_CODE, defect.code);
        if (defect.securityDetail && defect.securityDetail.cweId) {
            details.put(DefectTreeItem.DETAILS_CWE, defect.securityDetail.cweId);
        }
        details.put(DefectTreeItem.DETAILS_MUTED, defect.muted);
        details.put(DefectTreeItem.DETAILS_STATUS, defect.status);
        if (defect.explanation) {
            details.put(DefectTreeItem.DETAILS_EXPLANATION, defect.explanation);
        }
        return details;
    }
				static detailsForRuleAndDefect(defect) {
						let details = new Dictionary_1.Dictionary();
						// Add all properties as they are in defect bean (this way they'll be shown in the same order)
						details.put(DefectTreeItem.DETAILS_RULE, defect.rule);
						details.put(DefectTreeItem.DETAILS_LANGUAGE, defect.language);
						details.put(DefectTreeItem.DETAILS_CHARACTERISTIC, defect.characteristic);
						// details.put(DefectTreeItem.DETAILS_VIOLATION, defect.violationCode);
						// details.put(DefectTreeItem.DETAILS_FIX, defect.fixedCode);
						details.put(DefectTreeItem.DETAILS_PRIORITY, defect.priority);
						details.put(DefectTreeItem.DETAILS_RULE_CODE, defect.ruleCode);
						details.put(DefectTreeItem.DETAILS_EFFORT, KiuwanService_1.KiuwanService.effortAsLabel(defect.effort));
						details.put(DefectTreeItem.DETAILS_URL, KiuwanService_1.KiuwanService.getRuleDocumentationURL(defect.modelId, defect.ruleCode));
						if (defect.vulnerabilityType) {
										details.put(DefectTreeItem.DETAILS_VULNERABILITY_TYPE, defect.vulnerabilityType);
						}
						// Then, try to overwrite language with label translated by KiuwanService
						KiuwanService_1.KiuwanService.getLanguages().then(languages => {
										if (languages[defect.language]) {
														details.put(DefectTreeItem.DETAILS_LANGUAGE, languages[defect.language]);
										}
						});
						let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');

						KiuwanService_1.KiuwanService.getDocumentationApi().getRuleDoc(defect.modelId, defect.ruleCode, remoteApplication).then(result => {
										if (result && result.response && result.response.statusCode === 200) {
														let message = `rule doc loaded`;
														vscode.window.showInformationMessage(message);
														details.put(DefectTreeItem.DETAILS_VIOLATION, result.body.violationCode);
														details.put(DefectTreeItem.DETAILS_FIX, result.body.fixedCode);
														log.info('Load doc for : ' + defect.ruleCode + ' result is: ' + result.body);
										}
										else {
														let message = `rule doc failed with HTTP status ${result.response.statusCode} and message ${result.response.statusMessage}`;
														vscode.window.showErrorMessage(message, 'OK');
														log.info('Check connection KO, result is: ' + message);
										}
						}).catch(error => {
										if (error.message) {
														let message = `Connection to rule doc failed, cause: ${error.message}`;
														vscode.window.showErrorMessage(message, 'OK');
														log.error(message);
														if (error.stack)
																		log.error(error.stack);
										}
										else if (error.response) {
														let message = `Connection to rule doc failed with HTTP status ${error.response.statusCode} and message ${error.response.statusMessage}`;
														vscode.window.showErrorMessage(message, 'OK');
														log.error('Check connection error, result is: ' + message);
										}
						});

						details.put(DefectTreeItem.DETAILS_DEFECT_ID, defect.defectId);
						details.put(DefectTreeItem.DETAILS_FILE, defect.file);
						details.put(DefectTreeItem.DETAILS_LINE, defect.line);
						details.put(DefectTreeItem.DETAILS_CODE, defect.code);
						if (defect.securityDetail && defect.securityDetail.cweId) {
										details.put(DefectTreeItem.DETAILS_CWE, defect.securityDetail.cweId);
						}
						details.put(DefectTreeItem.DETAILS_MUTED, defect.muted);
						details.put(DefectTreeItem.DETAILS_STATUS, defect.status);
						if (defect.explanation) {
										details.put(DefectTreeItem.DETAILS_EXPLANATION, defect.explanation);
						}
						return details;
				}
    static detailsForFrame(frame) {
        let details = new Dictionary_1.Dictionary();
        details.put(DefectTreeItem.DETAILS_FILE, frame.file);
        details.put(DefectTreeItem.DETAILS_LINE, frame.lineNumber);
        details.put(DefectTreeItem.DETAILS_CODE, frame.lineText);
        if (frame.category) {
            details.put(DefectTreeItem.DETAILS_CATEGORY, frame.category);
        }
        if (frame.resource) {
            details.put(DefectTreeItem.DETAILS_RESOURCE, frame.resource);
        }
        if (frame.container) {
            details.put(DefectTreeItem.DETAILS_CONTAINER, frame.container);
        }
        if (frame.injectionPoint) {
            details.put(DefectTreeItem.DETAILS_INJECTION_POINT, frame.injectionPoint);
        }
        if (frame.variableDeclaration) {
            details.put(DefectTreeItem.DETAILS_VARIABLE_DECLARATION, frame.variableDeclaration);
        }
        return details;
    }
    static setRefreshDetailsCommand(item, details) {
        item.command = {
            command: 'k4d.refreshDetails',
            title: '',
            arguments: [details]
        };
    }
    static setBrowseToFileCommand(item, details) {
        let fileName = details[DefectTreeItem.DETAILS_FILE];
        let line = details[DefectTreeItem.DETAILS_LINE];
        item.command = {
            command: 'k4d.browseToFile',
            title: '',
            arguments: [details, fileName, line]
        };
    }
    static createDefectChild(parentItem, defect) {
        let text = DefectTreeItem.textForDefect(defect);
        let iconPath = DefectTreeItem.iconForDefect();
        let details = DefectTreeItem.detailsForRuleAndDefect(defect);
        let collapsibleState = (defect.securityDetail && defect.securityDetail.frames) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        let childItem = new DefectTreeItem(DefectTreeItem.TREEITEM_TYPE_DEFECT, text, iconPath, details, collapsibleState);
								// let childItem = new DefectTreeItem(DefectTreeItem.TREEITEM_TYPE_DEFECT_AND_RULE, text, iconPath, details, collapsibleState);
        DefectTreeItem.setBrowseToFileCommand(childItem, details);
        parentItem.addChild(childItem);
        DefectTreeItem.createFrameChildren(childItem, defect);
    }
			// 	static createDefectChild(parentItem, defect) {
			// 		let text = DefectTreeItem.textForDefect(defect);
			// 		let iconPath = DefectTreeItem.iconForDefect();
			// 		let details = DefectTreeItem.detailsForDefect(defect);
			// 		let collapsibleState = (defect.securityDetail && defect.securityDetail.frames) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
			// 		let childItem = new DefectTreeItem(DefectTreeItem.TREEITEM_TYPE_DEFECT, text, iconPath, details, collapsibleState);
	
			// 		// Aquí pasamos tanto el defecto como la regla (parentItem sería la regla en este contexto)
			// 		childItem.command = {
			// 						command: 'k4d.fixGrec0Ai',
			// 						title: '',
			// 						arguments: [childItem, parentItem] // childItem es el `defect`, parentItem es el `rule`
			// 		};
	
			// 		parentItem.addChild(childItem);
			// 		DefectTreeItem.createFrameChildren(childItem, defect);
			// }
    static createFrameChildren(parentItem, defect) {
        if (defect.securityDetail && defect.securityDetail.frames) {
            let framesCount = defect.securityDetail.frames.length;
            defect.securityDetail.frames.forEach((frame, frameIndex) => {
                let isSource = (frameIndex == 0);
                let isSink = (frameIndex == (framesCount - 1));
                let text = DefectTreeItem.textForFrame(frame, isSource, isSink);
                let iconPath = DefectTreeItem.iconForFrame(isSource, isSink);
                let details = DefectTreeItem.detailsForFrame(frame);
                let childItem = new DefectTreeItem(DefectTreeItem.TREEITEM_TYPE_FRAME, text, iconPath, details);
                DefectTreeItem.setBrowseToFileCommand(childItem, details);
                parentItem.addChild(childItem);
            });
        }
    }
    get tooltip() {
        return this.text;
    }
    addChild(child) {
        if (!this.children) {
            this.children = [];
        }
        this.children.push(child);
    }
    getChildren() {
        return this.children;
    }
}
DefectTreeItem.DETAILS_RULE = 'Rule';
DefectTreeItem.DETAILS_LANGUAGE = 'Language';
DefectTreeItem.DETAILS_CHARACTERISTIC = 'Characteristic';
DefectTreeItem.DETAILS_PRIORITY = 'Priority';
DefectTreeItem.DETAILS_RULE_CODE = 'ruleCode';
DefectTreeItem.DETAILS_VIOLATION = 'violationCode';
DefectTreeItem.DETAILS_FIX = 'fixedCode';
DefectTreeItem.DETAILS_EFFORT = 'Effort';
DefectTreeItem.DETAILS_URL = 'URL';
DefectTreeItem.DETAILS_VULNERABILITY_TYPE = 'Vulnerability Type';
DefectTreeItem.DETAILS_DEFECT_ID = 'Defect ID';
DefectTreeItem.DETAILS_FILE = 'File';
DefectTreeItem.DETAILS_LINE = 'Line';
DefectTreeItem.DETAILS_CODE = 'Code';
DefectTreeItem.DETAILS_CWE = 'CWE';
DefectTreeItem.DETAILS_MUTED = 'Muted';
DefectTreeItem.DETAILS_STATUS = 'Status';
DefectTreeItem.DETAILS_EXPLANATION = 'Explanation';
DefectTreeItem.DETAILS_CATEGORY = 'Category';
DefectTreeItem.DETAILS_RESOURCE = 'Resource';
DefectTreeItem.DETAILS_CONTAINER = 'Container';
DefectTreeItem.DETAILS_INJECTION_POINT = 'Injection Point';
DefectTreeItem.DETAILS_VARIABLE_DECLARATION = 'Variable Declaration';
DefectTreeItem.TREEITEM_TYPE_RULE = 'k4d-item-rule';
DefectTreeItem.TREEITEM_TYPE_DEFECT = 'k4d-item-defect';
DefectTreeItem.TREEITEM_TYPE_DEFECT_AND_RULE = 'k4d-item-defect-with-rule';
DefectTreeItem.TREEITEM_TYPE_FRAME = 'k4d-item-frame';
function browseToDocumentation(item) {
    log.info(`Browsing to documentation of '${item.text}'`);
    if (item && item.docUrl) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(item.docUrl));
    }
}
exports.browseToDocumentation = browseToDocumentation;
function muteDefect(item) {
    // Check if action applied to defect item, not rule nor frame
    log.info(`Mute defect at '${item.text}'`);
    if (item.contextValue == DefectTreeItem.TREEITEM_TYPE_DEFECT) {
        // Query if current user has authorization for mute defects action applied to configured remote application
        let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
        let action = 'MUTE_DEFECTS';
        KiuwanService_1.KiuwanService.getSecurityApi().getAuthorizationForAction(action, remoteApplication).then(onresolved => {
            let response = onresolved.body;
            log.info(`Authorization for mute defects on ${remoteApplication} resolved to ${response.granted}`);
            if (response.granted) {
                // Mute action granted: ask for mute reason, comments (optional), and request action to server
                let muteReasons = [];
                muteReasons.push({ label: 'None (default)', code: 'NONE' });
                muteReasons.push({ label: 'False positive', code: 'FALSE_POSITIVE' });
                muteReasons.push({ label: 'Too many defects', code: 'TOO_MANY_DEFECTS' });
                muteReasons.push({ label: 'Generated code', code: 'GENERATED_CODE' });
                muteReasons.push({ label: 'Too complex code', code: 'TOO_COMPLEX_CODE' });
                muteReasons.push({ label: 'Other', code: 'OTHER' });
                vscode.window.showQuickPick(muteReasons, {
                    placeHolder: 'Please select the reason to mute this defect.'
                }).then(function onfulfilled(selectedValue) {
                    if (!selectedValue) {
                        log.debug(`User aborted mute defect action by not choosing mute reason`);
                        return;
                    }
                    let reasonCode = selectedValue.code;
                    vscode.window.showInputBox({
                        placeHolder: 'Please type any comments you may have associated with this change (optional, press Enter for blank).'
                    }).then(function onfulfilled(inputValue) {
                        if (inputValue == null) {
                            log.debug(`User aborted mute defect action by not pressing Enter in mute defect comments input box`);
                            return;
                        }
                        let defectId = item.details[DefectTreeItem.DETAILS_DEFECT_ID];
                        KiuwanService_1.KiuwanService.getDefectApi().muteDefect(defectId, reasonCode, inputValue).then(onfulfilled => {
                            // SUCCESS: Mute action successful (HTTP status code is already checked by api.ts)
                            let defectMutedMsg = `Defect of application ${remoteApplication} successfully muted in Kiuwan`;
                            log.info(defectMutedMsg + ` (response message '${onfulfilled.response.statusMessage}')`);
                            item.details.put(DefectTreeItem.DETAILS_MUTED, true);
                            vscode.commands.executeCommand('k4d.refreshDetails', item.details);
                            vscode.window.showInformationMessage(defectMutedMsg, 'OK');
                        }, onrejected => {
                            // FAIL: Mute action failed at server side
                            let errorMsg = null;
                            if (onrejected.body && onrejected.body.errors && onrejected.body.errors[0]) {
                                errorMsg = onrejected.body.errors[0].message;
                            }
                            else if (onrejected.response && onrejected.response.statusMessage) {
                                errorMsg = onrejected.response.statusMessage;
                            }
                            else {
                                errorMsg = onrejected.toString();
                            }
                            errorMsg = 'Mute action failed, error: ' + errorMsg;
                            vscode.window.showErrorMessage(errorMsg, 'OK');
                            log.error(errorMsg);
                        });
                    }, function onrejected(reason) {
                        log.error(`Input box for comments failed for unknown reason: ${reason}`);
                    });
                }, function onrejected(reason) {
                    log.error(`Quick pick for mute reason failed for unknown reason: ${reason}`);
                });
            }
            else {
                // Mute action not granted for current user at requested remote application
                let notAllowedMsg = `Mute defect action not allowed for current user and application ${remoteApplication}`;
                log.warn(notAllowedMsg);
                vscode.window.showWarningMessage(notAllowedMsg, 'OK');
            }
        }, onrejected => {
            let errorMsg = `Failed to ask for authorization for muting defects of application ${remoteApplication}`;
            if (onrejected.body && onrejected.body.errors && onrejected.body.errors[0])
                errorMsg += ` (${onrejected.body.errors})`;
            vscode.window.showErrorMessage(errorMsg, 'OK');
            log.error(errorMsg);
        });
    }
    else {
        // Action applied to wrong kind of tree item, silently warn
        log.warn(`Item of type '${item.contextValue}' shouldn't have mute defect action enabled`);
    }
}
exports.muteDefect = muteDefect;
function changeDefectStatus(item) {
    log.info(`Change status of defect at '${item.text}'`);
    if (item.contextValue == DefectTreeItem.TREEITEM_TYPE_DEFECT) {
        // Query if current user has authorization for change defect status action applied to configured remote application
        let remoteApplication = vscode.workspace.getConfiguration('kiuwan.connectionSettings.remoteApplication').get('name');
        let action = 'CHANGE_DEFECT_STATUS';
        KiuwanService_1.KiuwanService.getSecurityApi().getAuthorizationForAction(action, remoteApplication).then(onresolved => {
            let response = onresolved.body;
            log.info(`Authorization for change defect status on ${remoteApplication} resolved to ${response.granted}`);
            if (response.granted) {
                // Change Status action granted: ask for new status, a note (optional), and request action to server
                let statuses = [];
                statuses.push({ label: 'None', code: 'NONE' });
                statuses.push({ label: 'To review', code: 'TO_REVIEW' });
                statuses.push({ label: 'Reviewed', code: 'REVIEWED' });
                vscode.window.showQuickPick(statuses, {
                    placeHolder: 'Please select the new life cycle status for this defect.'
                }).then(function onfulfilled(selectedValue) {
                    if (!selectedValue) {
                        log.debug(`User aborted change status action by not choosing new status`);
                        return;
                    }
                    let newStatusCode = selectedValue.code;
                    let newStatusLabel = selectedValue.label;
                    vscode.window.showInputBox({
                        placeHolder: 'Please add a note associated with this status change (optional, press Enter for blank).'
                    }).then(function onfulfilled(inputValue) {
                        if (inputValue == null) {
                            log.debug(`User aborted change status action by not pressing Enter in change status note input box`);
                            return;
                        }
                        let defectId = item.details[DefectTreeItem.DETAILS_DEFECT_ID];
                        KiuwanService_1.KiuwanService.getDefectApi().updateStatus(defectId, newStatusCode, inputValue).then(onfulfilled => {
                            // SUCCESS: Change Status action successful (HTTP status code is already checked by api.ts)
                            let statusChangedMsg = `Defect of application ${remoteApplication} successfully changed its status to ${newStatusLabel}`;
                            log.info(statusChangedMsg + ` (response message '${onfulfilled.response.statusMessage}')`);
                            item.details.put(DefectTreeItem.DETAILS_STATUS, newStatusLabel);
                            vscode.commands.executeCommand('k4d.refreshDetails', item.details);
                            vscode.window.showInformationMessage(statusChangedMsg, 'OK');
                        }, onrejected => {
                            // FAIL: Change Status action failed at server side
                            let errorMsg = null;
                            if (onrejected.body && onrejected.body.errors && onrejected.body.errors[0]) {
                                errorMsg = onrejected.body.errors[0].message;
                            }
                            else if (onrejected.response && onrejected.response.statusMessage) {
                                errorMsg = onrejected.response.statusMessage;
                            }
                            else {
                                errorMsg = onrejected.toString();
                            }
                            errorMsg = 'Change Status action failed, error: ' + errorMsg;
                            vscode.window.showErrorMessage(errorMsg, 'OK');
                            log.error(errorMsg);
                        });
                    }, function onrejected(reason) {
                        log.error(`Input box for change status note failed for unknown reason: ${reason}`);
                    });
                }, function onrejected(reason) {
                    log.error(`Quick pick for new defect status failed for unknown reason: ${reason}`);
                });
            }
            else {
                // Change Status action not granted for current user at requested remote application
                let notAllowedMsg = `Change Status action not allowed for current user and application ${remoteApplication}`;
                log.warn(notAllowedMsg);
                vscode.window.showWarningMessage(notAllowedMsg, 'OK');
            }
        }, onrejected => {
            let errorMsg = `Failed to ask for authorization for change defect status of application ${remoteApplication}`;
            if (onrejected.body && onrejected.body.errors && onrejected.body.errors[0])
                errorMsg += ` (${onrejected.body.errors})`;
            vscode.window.showErrorMessage(errorMsg, 'OK');
            log.error(errorMsg);
        });
    }
    else {
        // Action applied to wrong kind of tree item, silently warn
        log.warn(`Item of type '${item.contextValue}' shouldn't have change defect status action enabled`);
    }
}
exports.changeDefectStatus = changeDefectStatus;

function fixGrec0Ai(item) {

	vscode.window.showInformationMessage(
		`Grec0AI: se inicia la correción por IA del defecto '${item.text}'`
);


	log.info(item);
	log.info(`the ruled code is: ${item.details.ruleCode}`);
	log.info(`Grec0AI resolve defect file  '${item.text}'`);
	let relativeFilePath  = item.details[DefectTreeItem.DETAILS_FILE];
	let lineNumber = item.details[DefectTreeItem.DETAILS_LINE] - 1; // Convertir a 0-based

	const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No se pudo encontrar la carpeta de trabajo.');
        return;
    }


	let url = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('URL');
	let jwt = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('JWT');
	let folderProject = vscode.workspace.getConfiguration('kiuwan.connectionSettings.baseGrecoApiUrl').get('PROJECT_FOLDER');

	const absoluteFilePath = path.join(workspaceFolder, folderProject, relativeFilePath); // Combinar la raíz con la ruta relativa
 
	
	vscode.workspace.openTextDocument(absoluteFilePath).then(document => {
		const lines = document.getText().split('\n'); // Dividimos el archivo en líneas
		const totalLines = lines.length;

		// Obtener las 10 líneas antes y 10 después del defecto (si existen)
		const startLine = Math.max(0, lineNumber - 10);
		const endLine = Math.min(totalLines - 1, lineNumber + 10);

		const codeContext = lines.slice(startLine, endLine + 1).join('\n'); // Contexto del código

		let bodyToIa = {
						"rule": {
										"name": item.text,
										"code": item.details.ruleCode
						},
						"violation": {
										"description": "undefined",
										"code": item.details.violationCode
						},
						"fix": {
										"code": item.details.fixedCode,
										"description": "undefined"
						},
						"context": {
										"filePath": item.details[DefectTreeItem.DETAILS_FILE],
										"lineNumber": item.details[DefectTreeItem.DETAILS_LINE],
										"currentCode": codeContext // Enviar el contexto a la IA
						}
		};

		let body = JSON.stringify(bodyToIa);

		log.info(`URL: ${url}, JWT: ${jwt}`);
		log.info(`Body: ${body}`);

		fetch(`${url}/api/v1/kiuwan/fix`, {
						method: 'POST',
						headers: {
										'Content-Type': 'application/json',
										'Authorization': `Bearer ${jwt}`
						},
						body: body
		}).then(response => {
						if (response.ok) {
										return response.json(); // Convertir la respuesta a JSON
						} else {
										throw new Error(`Error fixing defect: ${response.statusText}`);
						}
		}).then(data => {
						log.info(`Response: ${JSON.stringify(data)}`);

						let correctedCode = data.response.correctedCode; // Código corregido que devuelve la IA

						// Reemplazamos la línea afectada en el contenido del archivo
						// lines[lineNumber] = correctedCode;
						// Reemplazamos el bloque de código afectado en el contenido del archivo
							lines.splice(startLine, (endLine - startLine) + 1, ...correctedCode.split('\n'));

							vscode.window.showInformationMessage(
							`Descripción: ${data.response.defectDescription}\n`
					);
					vscode.window.showInformationMessage(
						`Justificacion: ${data.response.justification}`
				);


						// Crear un archivo temporal con todo el contenido del archivo original pero con la línea corregida
						const correctedUri = vscode.Uri.parse('untitled:' + absoluteFilePath + '-corregido');

						// Insertar todo el contenido (con la línea corregida) en el archivo temporal
						vscode.workspace.openTextDocument(correctedUri).then(tempDoc => {
										const edit = new vscode.WorkspaceEdit();
										const fullCorrectedText = lines.join('\n'); // Reensamblar el texto corregido
										edit.insert(correctedUri, new vscode.Position(0, 0), fullCorrectedText);
										vscode.workspace.applyEdit(edit).then(() => {

														// Mostrar la comparación entre el archivo original y el archivo temporal corregido
														vscode.commands.executeCommand('vscode.diff', document.uri, correctedUri, `Comparación de archivo con línea corregida`).then(() => {

																		// Después de mostrar la comparación, ofrecer la opción de aceptar o rechazar el cambio
																		vscode.window.showInformationMessage('¿Deseas aceptar el cambio sugerido?', 'Aceptar', 'Cancelar').then(selection => {
																						if (selection === 'Aceptar') {
																										// Si el usuario acepta, aplicar el cambio en el archivo original
																										const range = document.lineAt(lineNumber).range;
																										const edit = new vscode.WorkspaceEdit();
																										edit.replace(document.uri, range, correctedCode);

																										vscode.workspace.applyEdit(edit).then(success => {
																														if (success) {
																																		vscode.window.showInformationMessage(`Defecto corregido en el archivo: ${absoluteFilePath}, línea: ${lineNumber + 1}`);
																														} else {
																																		vscode.window.showErrorMessage('No se pudo aplicar el cambio en el archivo.');
																														}
																										});
																						} else {
																										vscode.window.showInformationMessage('El cambio fue cancelado.');
																						}
																		});
														});
										});
						});
		}).catch(error => {
						vscode.window.showErrorMessage(error.message);
		});
});


}
exports.fixGrec0Ai = fixGrec0Ai;

//# sourceMappingURL=KiuwanDefectsProvider.js.map