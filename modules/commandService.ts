import { existsSync, readFileSync } from "node:fs";

/**
 * Command Service Module
 *
 * Handles loading and caching of bot command data from help.json.
 * Provides error handling and automatic cache invalidation.
 */

interface CommandMetadata {
    totalCommands: number;
    categories: number;
}

interface CommandData {
    metadata: CommandMetadata;
    error?: string;
    [key: string]: unknown;
}

interface CacheData {
    data: CommandData | null;
    expiresAt: number | null;
}

// Cache object to store command data with expiration
const cache: CacheData & {
    isValid(): boolean;
    set(data: CommandData, ttlHours?: number): void;
    clear(): void;
} = {
    data: null,
    expiresAt: null,

    /**
     * Check if cached data is still valid
     * @returns {boolean} True if cache exists and hasn't expired
     */
    isValid(): boolean {
        return this.data !== null && this.expiresAt !== null && Date.now() < this.expiresAt;
    },

    /**
     * Set cache data with TTL
     * @param {CommandData} data - The data to cache
     * @param {number} ttlHours - Time to live in hours
     */
    set(data: CommandData, ttlHours = 24): void {
        this.data = data;
        this.expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    },

    /**
     * Clear the cache
     */
    clear(): void {
        this.data = null;
        this.expiresAt = null;
    },
};

/**
 * Load command data from help.json file
 * @returns {CommandData | null} Command data object or null if loading fails
 */
function loadCommandData(): CommandData | null {
    try {
        const dataPath = process.env.BOT_DATA_PATH || "/home/j_milner359/testBot/data/help.json";

        // Check if file exists
        if (!existsSync(dataPath)) {
            console.warn(`[CommandService] Warning: help.json not found at ${dataPath}`);
            return null;
        }

        // Read and parse the file
        const fileContent = readFileSync(dataPath, "utf8");
        const data = JSON.parse(fileContent) as CommandData;

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
        const err = error as NodeJS.ErrnoException;
        // Handle specific error types
        if (err.code === "ENOENT") {
            console.error(`[CommandService] Error: File not found at ${process.env.BOT_DATA_PATH}`);
        } else if (err.code === "EACCES") {
            console.error(`[CommandService] Error: Permission denied reading ${process.env.BOT_DATA_PATH}`);
        } else if (error instanceof SyntaxError) {
            console.error(`[CommandService] Error: Invalid JSON in ${process.env.BOT_DATA_PATH}`);
        } else {
            console.error(`[CommandService] Error loading command data: ${err.message}`);
        }

        return null;
    }
}

/**
 * Get command data (from cache or fresh load)
 * @returns {CommandData} Command data or error object
 */
function getCommands(): CommandData {
    // Return cached data if still valid
    if (cache.isValid()) {
        return cache.data as CommandData;
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
function initialize(): void {
    console.log("[CommandService] Initializing command service...");
    getCommands();
}

/**
 * Clear the cache
 */
function clearCache(): void {
    cache.clear();
}

// Export public API
export { getCommands, initialize, clearCache };
