import { existsSync } from "node:fs";
import type { PluginContext, PluginDefinition, PluginFactory } from "../types/plugin.ts";
import logger from "./logger.ts";

export async function loadPlugins(ctx: PluginContext): Promise<PluginDefinition[]> {
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
            logger.log(`Loaded plugin: ${definition.name} at ${definition.mountPath}`);
        } catch (err) {
            logger.warn(`Failed to load plugin at ${pluginPath}: ${err}`);
        }
    }

    return definitions;
}
