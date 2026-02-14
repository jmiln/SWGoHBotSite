const fs = require("node:fs");
const config = require("../config.js");

/**
 * Command Service Module
 *
 * Handles loading and caching of bot command data from help.json.
 * Provides error handling and automatic cache invalidation.
 */

// Cache object to store command data with expiration
const cache = {
    data: null,
    expiresAt: null,

    /**
     * Check if cached data is still valid
     * @returns {boolean} True if cache exists and hasn't expired
     */
    isValid() {
        return this.data !== null && this.expiresAt !== null && Date.now() < this.expiresAt;
    },

    /**
     * Set cache data with TTL
     * @param {Object} data - The data to cache
     * @param {number} ttlHours - Time to live in hours
     */
    set(data, ttlHours = 24) {
        this.data = data;
        this.expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    },

    /**
     * Clear the cache
     */
    clear() {
        this.data = null;
        this.expiresAt = null;
    },
};

/**
 * Load command data from help.json file
 * @returns {Object|null} Command data object or null if loading fails
 */
function loadCommandData() {
    try {
        const dataPath = config.bot.dataPath;

        // Check if file exists
        if (!fs.existsSync(dataPath)) {
            console.warn(`[CommandService] Warning: help.json not found at ${dataPath}`);
            return null;
        }

        // Read and parse the file
        const fileContent = fs.readFileSync(dataPath, "utf8");
        const data = JSON.parse(fileContent);

        // Validate structure
        if (!data.metadata || typeof data.metadata.totalCommands !== "number" || typeof data.metadata.categories !== "number") {
            console.error("[CommandService] Error: Invalid help.json structure - missing or invalid metadata");
            return null;
        }

        // Success - log summary
        console.log(
            `[CommandService] Command data loaded: ${data.metadata.totalCommands} commands in ${data.metadata.categories} categories`,
        );

        return data;
    } catch (error) {
        // Handle specific error types
        if (error.code === "ENOENT") {
            console.error(`[CommandService] Error: File not found at ${config.bot.dataPath}`);
        } else if (error.code === "EACCES") {
            console.error(`[CommandService] Error: Permission denied reading ${config.bot.dataPath}`);
        } else if (error instanceof SyntaxError) {
            console.error(`[CommandService] Error: Invalid JSON in ${config.bot.dataPath}`);
        } else {
            console.error(`[CommandService] Error loading command data: ${error.message}`);
        }

        return null;
    }
}

/**
 * Get command data (from cache or fresh load)
 * @returns {Object} Command data or error object
 */
function getCommands() {
    // Return cached data if still valid
    if (cache.isValid()) {
        return cache.data;
    }

    // Load fresh data
    const data = loadCommandData();

    if (data) {
        // Cache successful load
        cache.set(data, 24); // 24 hour TTL
        return data;
    }

    // Return error object if load failed
    return {
        error: "Failed to load command data",
        metadata: {
            totalCommands: 0,
            categories: 0,
        },
    };
}

/**
 * Initialize the service by loading initial cache
 */
function initialize() {
    console.log("[CommandService] Initializing command service...");
    getCommands();
}

// Export public API
module.exports = {
    getCommands,
    initialize,
    clearCache: () => cache.clear(),
};
