import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "./env.ts";

if (!path.isAbsolute(env.BOT_SCHEMAS_PATH) || !existsSync(env.BOT_SCHEMAS_PATH)) {
    console.error(`BOT_SCHEMAS_PATH is not a valid directory: ${env.BOT_SCHEMAS_PATH}`);
    process.exit(1);
}

const schemas = await import(`${env.BOT_SCHEMAS_PATH}/index.ts`);

export const formatValidationError = schemas.formatValidationError;
export const defaultGuildSettings: Record<string, unknown> = schemas.defaultGuildSettings;
