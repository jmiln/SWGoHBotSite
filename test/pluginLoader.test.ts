import assert from "node:assert";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

// Set required env vars before any import that touches env.ts
process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";
process.env.DISCORD_CLIENT_ID = "test";
process.env.DISCORD_CLIENT_SECRET = "test";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test";
process.env.MONGODB_BOT_DB = "test";
process.env.SESSION_SECRET = "test-session-secret-16chars";
process.env.DISCORD_BOT_TOKEN = "test";
process.env.MONGODB_SWAPI_DB = "test";
process.env.ADMIN_DISCORD_ID = "111111111111111111";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_PLUGIN_PATH = join(__dirname, "fixtures/testPlugin");
const BROKEN_PLUGIN_PATH = join(__dirname, "fixtures/brokenPlugin");

const mockCtx = {
    env: process.env,
    logger: { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    generateCsrfToken: () => "token",
    verifyCsrfToken: () => true,
    partialsPath: "/fake/partials",
};

describe("loadPlugins", () => {
    test("returns empty array when EXTRAS_PATHS not set", async () => {
        delete process.env.EXTRAS_PATHS;
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 0);
    });

    test("returns empty array when EXTRAS_PATHS is empty string", async () => {
        process.env.EXTRAS_PATHS = "";
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 0);
    });

    test("loads a valid plugin and returns its definition", async () => {
        process.env.EXTRAS_PATHS = FIXTURE_PLUGIN_PATH;
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, "test-plugin");
        assert.strictEqual(result[0].mountPath, "/test-plugin");
        assert.ok(result[0].router);
    });

    test("skips nonexistent path and logs warning without throwing", async () => {
        process.env.EXTRAS_PATHS = "/nonexistent/path/plugin";
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 0);
    });

    test("logs warning and skips plugin that exists but throws during import", async () => {
        process.env.EXTRAS_PATHS = BROKEN_PLUGIN_PATH;
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 0);
    });

    test("loads multiple plugins from comma-separated paths", async () => {
        process.env.EXTRAS_PATHS = `${FIXTURE_PLUGIN_PATH},${FIXTURE_PLUGIN_PATH}`;
        const { loadPlugins } = await import("../modules/pluginLoader.ts");
        const result = await loadPlugins(mockCtx as never);
        assert.strictEqual(result.length, 2);
    });
});
