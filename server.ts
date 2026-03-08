import { createApp } from "./app.ts";
import { closeDB } from "./modules/db.ts";
import { env } from "./modules/env.ts";

const app = await createApp();
const port = Number.parseInt(env.PORT, 10);
const server = app.listen(port, () => {
    console.log(`Site listening on port ${port}!`);
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down gracefully`);

    setTimeout(() => {
        console.error("Shutdown timed out — forcing exit");
        process.exit(1);
    }, 10_000).unref();

    server.close(async () => {
        await closeDB();
        process.exit(0);
    });

    server.closeAllConnections();
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
