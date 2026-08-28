import { existsSync } from "node:fs";
import type { PluginContext, PluginDefinition, PluginFactory } from "../types/plugin.ts";
import logger from "./logger.ts";

// Definitions from the most recent loadPlugins() call, kept so graceful shutdown can reach their
// close hooks. Reset on every load rather than appended to, so a reload cannot leave stale entries.
const loaded: PluginDefinition[] = [];

export async function closePlugins(): Promise<void> {
    for (const plugin of loaded) {
        if (!plugin.close) continue;
        try {
            await plugin.close();
            logger.log(`Closed plugin: ${plugin.name}`);
        } catch (err) {
            // Logged rather than rethrown: one plugin's failed teardown must not strand the rest,
            // nor stop the site's own closeDB() from running.
            logger.warn(`Plugin ${plugin.name} failed to close: ${err}`);
        }
    }
    loaded.length = 0;
}

export async function loadPlugins(ctx: PluginContext): Promise<PluginDefinition[]> {
    loaded.length = 0;

    const rawPaths = process.env.EXTRAS_PATHS;
    if (!rawPaths?.trim()) return [];

    const paths = rawPaths
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    const definitions: PluginDefinition[] = [];

    for (const pluginPath of paths) {
        if (!existsSync(pluginPath)) {
            logger.warn(`Plugin path not found, skipping: ${pluginPath}`);
            continue;
        }

        try {
            const entryPoint = `${pluginPath}/index.ts`;
            const mod = (await import(entryPoint)) as { default: PluginFactory };
            const definition = mod.default(ctx);
            definitions.push(definition);
            loaded.push(definition);
            logger.log(`Loaded plugin: ${definition.name} at ${definition.mountPath}`);
        } catch (err) {
            logger.warn(`Failed to load plugin at ${pluginPath}: ${err}`);
        }
    }

    return definitions;
}
