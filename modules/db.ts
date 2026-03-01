import { MongoClient } from "mongodb";
import { env } from "./env.ts";

const client = new MongoClient(env.MONGODB_URI);

export async function connectDB(): Promise<void> {
    await client.connect();

    const shutdown = async () => {
        await client.close();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
}

export function getBotDB() {
    return client.db(env.MONGODB_BOT_DB);
}

export function getSwapiDB() {
    return client.db(env.MONGODB_SWAPI_DB);
}

export async function closeDB(): Promise<void> {
    await client.close();
}
