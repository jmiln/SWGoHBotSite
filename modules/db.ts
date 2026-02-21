import { MongoClient } from "mongodb";
import { env } from "./env.ts";

const client = new MongoClient(env.MONGODB_URI);

export async function connectDB(): Promise<void> {
    await client.connect();
}

export function getBotDB() {
    return client.db(env.MONGODB_BOT_DB);
}
