import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StartedMongoDBContainer } from "@testcontainers/mongodb";
import { MongoDBContainer } from "@testcontainers/mongodb";

let container: StartedMongoDBContainer | undefined;

export async function globalSetup(): Promise<void> {
    if (process.env.MONGODB_URI) {
        return;
    }

    console.log("Starting MongoDB testcontainer...");
    container = await new MongoDBContainer("mongo:7.0")
        .withExposedPorts({ container: 27017, host: 27018 })
        .start();

    const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/botSchemas");

    const connectionString = `${container.getConnectionString()}?directConnection=true`;
    process.env.MONGODB_URI = connectionString;
    process.env.MONGODB_BOT_DB = "testBotDB";
    process.env.MONGODB_SWAPI_DB = "testSwapiDB";
    process.env.BOT_SCHEMAS_PATH = fixturesDir;
    process.env.BOT_DATA_PATH = "/tmp";
    process.env.DISCORD_CLIENT_ID = "test-client-id";
    process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
    process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
    process.env.SESSION_SECRET = "test-session-secret-16ch";
    process.env.DISCORD_BOT_TOKEN = "test-bot-token";
    console.log("MongoDB testcontainer ready on port 27018");
}

export async function globalTeardown(): Promise<void> {
    if (container) {
        try {
            await container.stop();
        } catch (error) {
            console.error("Failed to stop MongoDB testcontainer:", error);
        } finally {
            container = undefined;
            delete process.env.MONGO_URL;
            console.log("MongoDB testcontainer stopped");
        }
    }
}

process.on("SIGTERM", async () => {
    await globalTeardown();
    process.exit(0);
});
process.on("SIGINT", async () => {
    await globalTeardown();
    process.exit(0);
});
