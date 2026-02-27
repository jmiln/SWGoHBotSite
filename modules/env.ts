import { z } from "zod";

const envSchema = z.object({
    PORT: z.string().default("3300"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    BOT_DATA_PATH: z.string(),
    BOT_SCHEMAS_PATH: z.string(),
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string(),
    DISCORD_REDIRECT_URI: z.url(),
    MONGODB_URI: z.string(),
    MONGODB_BOT_DB: z.string(),
    SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
    DISCORD_BOT_TOKEN: z.string(),
    MONGODB_SWAPI_DB: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`Invalid environment variables:\n${errors}`);
    process.exit(1);
}

export const env = parsed.data;
