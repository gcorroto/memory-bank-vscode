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

class CoverageSummaryProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    fileDetails = [];
    logger;
    fileTreeService;
    selectedFilePath = '';
    
    constructor(fileTreeProvider, logger) {
        this.fileTreeProvider = fileTreeProvider;
        this.logger = logger;
        this.fileTreeService = new FileTreeService(logger);
        
        // Listen for file selection events from the file tree provider
        fileTreeProvider.onFileSelected(file => {
            vscode.window.showInformationMessage(`File selected: ${file.label}`);
            this.loadFileDetails(file.path, file.label);
        });
    }
    
    async loadFileDetails(path, label) {
        try {
            // Clear previous details
            this.fileDetails = [];
            this.selectedFilePath = path;
            
            // Try to find corresponding test file
            const testPath = this.getTestFilePath(path);
            const hasTest = await this.fileExists(testPath);
            
            // Get stats about the file (lines of code, etc.)
            const stats = await this.getFileStats(path);
            
            // Get coverage data by running any tests or analyzing test file
            const coverageData = await this.getFileCoverage(path, testPath, hasTest);
            
            // Generate "uncovered" lines for visualization
            this.fileDetails = this.generateCoverageDetails(path, stats, coverageData);
            
            // Notify view to update
            this._onDidChangeTreeData.fire();
        } catch (error) {
            this.logger.appendLine(`Error loading file details: ${error.message}`);
            vscode.window.showErrorMessage(`Error loading file details: ${error.message}`);
        }
    }
    
    async loadFileDetailsReturned(path) {
        try {
            const label = path ? path.split('/').pop() : '';
            await this.loadFileDetails(path, label);
            return this.fileDetails;
        } catch (error) {
            this.logger.appendLine(`Error in loadFileDetailsReturned: ${error.message}`);
            return [];
        }
    }
    
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(`Line ${element.line} - ${element.coverage}`);
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        
        // Set command to open file at specific line
        treeItem.command = {
            command: 'grec0ai.filesystem.openFileAtLine',
            title: 'Open File at Line',
            arguments: [element]
        };
        
        element = treeItem;
        return element;
    }
    
    getChildren() {
        // Return lines with coverage details
        return this.fileDetails.map(detail => ({
            path: detail.path,
            line: detail.line,
            coverage: detail.coverage
        }));
    }
    
    /**
     * Check if a file exists
     */
    async fileExists(filePath) {
        try {
            const stats = await fs.promises.stat(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get path to corresponding test file
     */
    getTestFilePath(filePath) {
        // Handle TypeScript files - change .ts to .spec.ts
        if (filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts')) {
            return filePath.replace('.ts', '.spec.ts');
        }
        
        // Handle JavaScript files - change .js to .spec.js
        if (filePath.endsWith('.js') && !filePath.endsWith('.spec.js')) {
            return filePath.replace('.js', '.spec.js');
        }
        
        return filePath;
    }
    
    /**
     * Get basic stats about the file
     */
    async getFileStats(filePath) {
        try {
            if (!await this.fileExists(filePath)) {
                return {
                    lineCount: 0,
                    functionCount: 0,
                    branchCount: 0
                };
            }
            
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Simple function count (not very accurate but a starting point)
            const functionMatches = content.match(/function\s+\w+\s*\(|=>|class\s+\w+/g) || [];
            const branchMatches = content.match(/if\s*\(|else|switch|case|for\s*\(|while\s*\(|try|catch/g) || [];
            
            return {
                lineCount: lines.length,
                functionCount: functionMatches.length,
                branchCount: branchMatches.length
            };
        } catch (error) {
            this.logger.appendLine(`Error getting file stats: ${error.message}`);
            return {
                lineCount: 0,
                functionCount: 0, 
                branchCount: 0
            };
        }
    }
    
    /**
     * Get coverage data for a file
     */
    async getFileCoverage(filePath, testPath, hasTest) {
        // This is a placeholder. In a real implementation, 
        // you would run tests or parse coverage reports
        const stats = await this.getFileStats(filePath);
        
        // If test file exists, read it to estimate coverage
        let testStats = { lineCount: 0, functionCount: 0, branchCount: 0 };
        if (hasTest) {
            testStats = await this.getFileStats(testPath);
        }
        
        // Calculate simplistic coverage based on test file size relative to source file
        // This is just an approximation for visualization
        const coverageRatio = hasTest ? Math.min(0.7, testStats.lineCount / Math.max(1, stats.lineCount)) : 0;
        
        // Covered counts - just an approximation
        const coveredLines = Math.floor(stats.lineCount * coverageRatio);
        const coveredFunctions = Math.floor(stats.functionCount * coverageRatio);
        const coveredBranches = Math.floor(stats.branchCount * coverageRatio);
        
        return {
            totalStatements: stats.lineCount,
            coveredStatements: coveredLines,
            uncoveredStatements: stats.lineCount - coveredLines,
            
            totalFunctions: stats.functionCount,
            coveredFunctions: coveredFunctions,
            uncoveredFunctions: stats.functionCount - coveredFunctions,
            
            totalBranches: stats.branchCount,
            coveredBranches: coveredBranches,
            uncoveredBranches: stats.branchCount - coveredBranches,
            
            coverage: `${Math.round(coverageRatio * 100)}%`,
            
            // Generate simulated uncovered lines for visualization
            uncoveredLines: this.simulateUncoveredLines(stats.lineCount, coverageRatio)
        };
    }
    
    /**
     * Generate simulated line coverage details
     */
    simulateUncoveredLines(lineCount, coverageRatio) {
        // For demo purposes, generate some "uncovered" lines
        const uncoveredCount = Math.floor(lineCount * (1 - coverageRatio));
        const uncoveredLines = [];
        
        // Generate random line numbers that would be "uncovered"
        for (let i = 0; i < uncoveredCount; i++) {
            const line = Math.floor(Math.random() * lineCount) + 1;
            if (!uncoveredLines.includes(line)) {
                uncoveredLines.push(line);
            }
        }
        
        return uncoveredLines.sort((a, b) => a - b);
    }
    
    /**
     * Generate coverage details for the view
     */
    generateCoverageDetails(filePath, stats, coverageData) {
        const details = [];
        
        // Add summary item
        details.push({
            path: filePath,
            line: 0,
            coverage: `Summary: ${coverageData.coverage} covered (${coverageData.coveredStatements}/${coverageData.totalStatements} lines)`
        });
        
        // Add function coverage summary
        if (stats.functionCount > 0) {
            details.push({
                path: filePath,
                line: 0,
                coverage: `Functions: ${Math.round((coverageData.coveredFunctions / Math.max(1, stats.functionCount)) * 100)}% (${coverageData.coveredFunctions}/${stats.functionCount})`
            });
        }
        
        // Add items for each uncovered line
        for (const line of coverageData.uncoveredLines) {
            details.push({
                path: filePath,
                line: line,
                coverage: 'Not covered'
            });
        }
        
        return details;
    }
}

exports.CoverageSummaryProvider = CoverageSummaryProvider;