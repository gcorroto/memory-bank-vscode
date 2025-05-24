/**
 * DatabaseManager
 * Manages storage and retrieval of agent events, history and logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Agent } from './Agent';

interface Event {
    id?: string;
    type: string;
    timestamp: Date;
    success?: boolean;
    [key: string]: any;
}

interface EventFilter {
    type?: string;
    success?: boolean;
    from?: string | Date;
    to?: string | Date;
}

export class DatabaseManager {
    private agent: Agent;
    private logger: vscode.OutputChannel;
    private dbPath: string;
    private events: Event[];
    private initialized: boolean;

    /**
     * Initialize the Database Manager
     * @param agent - The parent agent instance
     */
    constructor(agent: Agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.dbPath = '';
        this.events = [];
        this.initialized = false;
    }

    /**
     * Initialize the database manager
     * @returns True if initialization was successful
     */
    async initialize(): Promise<boolean> {
        try {
            this.logger.appendLine("Initializing Database Manager");
            
            // Get workspace path to store database files
            const workspacePath = this.agent.workspaceManager.getWorkspacePath();
            this.dbPath = path.join(workspacePath, 'database');
            
            // Ensure directory exists
            if (!fs.existsSync(this.dbPath)) {
                fs.mkdirSync(this.dbPath, { recursive: true });
            }
            
            // Create necessary database files
            await this.initializeEventLog();
            
            this.initialized = true;
            this.logger.appendLine(`Database Manager initialized at: ${this.dbPath}`);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error initializing Database Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize the event log
     */
    private async initializeEventLog(): Promise<void> {
        try {
            const eventsPath = path.join(this.dbPath, 'events.json');
            
            // If the file doesn't exist, create it with empty array
            if (!fs.existsSync(eventsPath)) {
                fs.writeFileSync(eventsPath, JSON.stringify([], null, 2));
            } else {
                // Load existing events
                const eventsData = fs.readFileSync(eventsPath, 'utf8');
                this.events = JSON.parse(eventsData);
            }
        } catch (error: any) {
            this.logger.appendLine(`Error initializing event log: ${error.message}`);
            // Initialize with empty array if there's an error
            this.events = [];
        }
    }

    /**
     * Save an event to the database
     * @param event - Event data to save
     * @returns True if save was successful
     */
    async saveEvent(event: Event): Promise<boolean> {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return false;
            }
            
            // Add event ID and ensure timestamp
            const eventToSave = {
                ...event,
                id: `event_${Date.now()}_${this.events.length}`,
                timestamp: event.timestamp || new Date(),
            };
            
            // Add to memory cache
            this.events.push(eventToSave);
            
            // Write to file (async to avoid blocking)
            const eventsPath = path.join(this.dbPath, 'events.json');
            fs.writeFile(eventsPath, JSON.stringify(this.events, null, 2), (err) => {
                if (err) {
                    this.logger.appendLine(`Error writing events to disk: ${err.message}`);
                }
            });
            
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error saving event: ${error.message}`);
            return false;
        }
    }

    /**
     * Get events from the database
     * @param filter - Filter criteria
     * @param limit - Maximum number of events to return
     * @returns Matching events
     */
    getEvents(filter: EventFilter = {}, limit: number = 100): Event[] {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return [];
            }
            
            // Filter events
            let filteredEvents = this.events;
            
            // Apply filters
            if (filter.type) {
                filteredEvents = filteredEvents.filter(event => event.type === filter.type);
            }
            
            if (filter.success !== undefined) {
                filteredEvents = filteredEvents.filter(event => event.success === filter.success);
            }
            
            if (filter.from) {
                const fromDate = new Date(filter.from);
                filteredEvents = filteredEvents.filter(event => 
                    new Date(event.timestamp) >= fromDate
                );
            }
            
            if (filter.to) {
                const toDate = new Date(filter.to);
                filteredEvents = filteredEvents.filter(event => 
                    new Date(event.timestamp) <= toDate
                );
            }
            
            // Sort by timestamp (most recent first)
            filteredEvents.sort((a, b) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            
            // Apply limit
            return filteredEvents.slice(0, limit);
        } catch (error: any) {
            this.logger.appendLine(`Error retrieving events: ${error.message}`);
            return [];
        }
    }

    /**
     * Save conversation message history
     * @param messages - Message history
     * @returns True if save was successful
     */
    async saveConversationHistory(messages: any[]): Promise<boolean> {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return false;
            }
            
            const historyPath = path.join(this.dbPath, 'conversation_history.json');
            fs.writeFileSync(historyPath, JSON.stringify(messages, null, 2));
            
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error saving conversation history: ${error.message}`);
            return false;
        }
    }

    /**
     * Get conversation message history
     * @returns Message history
     */
    getConversationHistory(): any[] {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return [];
            }
            
            const historyPath = path.join(this.dbPath, 'conversation_history.json');
            
            if (!fs.existsSync(historyPath)) {
                return [];
            }
            
            const historyData = fs.readFileSync(historyPath, 'utf8');
            return JSON.parse(historyData);
        } catch (error: any) {
            this.logger.appendLine(`Error retrieving conversation history: ${error.message}`);
            return [];
        }
    }

    /**
     * Save agent state
     * @param state - State data to save
     * @returns True if save was successful
     */
    async saveAgentState(state: Record<string, any>): Promise<boolean> {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return false;
            }
            
            const statePath = path.join(this.dbPath, 'agent_state.json');
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
            
            return true;
        } catch (error: any) {
            this.logger.appendLine(`Error saving agent state: ${error.message}`);
            return false;
        }
    }

    /**
     * Get agent state
     * @returns Saved agent state
     */
    getAgentState(): Record<string, any> {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return {};
            }
            
            const statePath = path.join(this.dbPath, 'agent_state.json');
            
            if (!fs.existsSync(statePath)) {
                return {};
            }
            
            const stateData = fs.readFileSync(statePath, 'utf8');
            return JSON.parse(stateData);
        } catch (error: any) {
            this.logger.appendLine(`Error retrieving agent state: ${error.message}`);
            return {};
        }
    }

    /**
     * Create a backup of the database
     * @returns Path to the backup file
     */
    async backup(): Promise<string> {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return '';
            }
            
            // Create backup directory
            const backupDir = path.join(this.dbPath, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // Create backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `backup_${timestamp}.json`;
            const backupPath = path.join(backupDir, backupFilename);
            
            // Create backup data
            const backupData = {
                events: this.events,
                timestamp: new Date(),
                version: '1.0'
            };
            
            // Write backup file
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            
            this.logger.appendLine(`Database backup created: ${backupPath}`);
            return backupPath;
        } catch (error: any) {
            this.logger.appendLine(`Error creating database backup: ${error.message}`);
            return '';
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources if needed
        this.events = [];
    }
} 