/**
 * DatabaseManager
 * Manages storage and retrieval of agent events, history and logs
 */

const fs = require('fs');
const path = require('path');

class DatabaseManager {
    /**
     * Initialize the Database Manager
     * @param {Object} agent - The parent agent instance
     */
    constructor(agent) {
        this.agent = agent;
        this.logger = agent.getLogger();
        this.dbPath = '';
        this.events = [];
        this.initialized = false;
    }

    /**
     * Initialize the database manager
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initialize() {
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
        } catch (error) {
            this.logger.appendLine(`Error initializing Database Manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize the event log
     * @returns {Promise<void>}
     */
    async initializeEventLog() {
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
        } catch (error) {
            this.logger.appendLine(`Error initializing event log: ${error.message}`);
            // Initialize with empty array if there's an error
            this.events = [];
        }
    }

    /**
     * Save an event to the database
     * @param {Object} event - Event data to save
     * @returns {Promise<boolean>} - True if save was successful
     */
    async saveEvent(event) {
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
        } catch (error) {
            this.logger.appendLine(`Error saving event: ${error.message}`);
            return false;
        }
    }

    /**
     * Get events from the database
     * @param {Object} filter - Filter criteria
     * @param {number} limit - Maximum number of events to return
     * @returns {Array<Object>} - Matching events
     */
    getEvents(filter = {}, limit = 100) {
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
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            // Apply limit
            return filteredEvents.slice(0, limit);
        } catch (error) {
            this.logger.appendLine(`Error retrieving events: ${error.message}`);
            return [];
        }
    }

    /**
     * Save conversation message history
     * @param {Array<Object>} messages - Message history
     * @returns {Promise<boolean>} - True if save was successful
     */
    async saveConversationHistory(messages) {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return false;
            }
            
            const historyPath = path.join(this.dbPath, 'conversation_history.json');
            fs.writeFileSync(historyPath, JSON.stringify(messages, null, 2));
            
            return true;
        } catch (error) {
            this.logger.appendLine(`Error saving conversation history: ${error.message}`);
            return false;
        }
    }

    /**
     * Get conversation message history
     * @returns {Array<Object>} - Message history
     */
    getConversationHistory() {
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
        } catch (error) {
            this.logger.appendLine(`Error retrieving conversation history: ${error.message}`);
            return [];
        }
    }

    /**
     * Save agent state
     * @param {Object} state - State data to save
     * @returns {Promise<boolean>} - True if save was successful
     */
    async saveAgentState(state) {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return false;
            }
            
            const statePath = path.join(this.dbPath, 'agent_state.json');
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
            
            return true;
        } catch (error) {
            this.logger.appendLine(`Error saving agent state: ${error.message}`);
            return false;
        }
    }

    /**
     * Get agent state
     * @returns {Object} - Saved agent state
     */
    getAgentState() {
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
        } catch (error) {
            this.logger.appendLine(`Error retrieving agent state: ${error.message}`);
            return {};
        }
    }

    /**
     * Backup current database
     * @returns {Promise<string>} - Path to backup file
     */
    async backup() {
        try {
            if (!this.initialized) {
                this.logger.appendLine("Database Manager not initialized");
                return '';
            }
            
            const backupDir = path.join(this.dbPath, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const backupPath = path.join(backupDir, `backup_${timestamp}.json`);
            
            // Collect all data
            const backup = {
                events: this.events,
                conversation: this.getConversationHistory(),
                state: this.getAgentState(),
                timestamp: new Date()
            };
            
            // Save to backup file
            fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
            
            this.logger.appendLine(`Database backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.appendLine(`Error backing up database: ${error.message}`);
            return '';
        }
    }
}

module.exports = DatabaseManager;