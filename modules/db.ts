import { MongoClient } from "mongodb";
import { env } from "./env.ts";

const client = new MongoClient(env.MONGODB_URI);

export async function connectDB(): Promise<void> {
    await client.connect();
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

export async function pingDB(): Promise<void> {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB ping timed out")), 2000));
    await Promise.race([client.db("admin").command({ ping: 1 }), timeout]);
}
