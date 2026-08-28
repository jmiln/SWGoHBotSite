import assert from "node:assert";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type { Request, Response } from "express";
import express from "express";

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
process.env.NODE_ENV = "production";

const { applySecurity } = await import("../middleware/security.ts");

describe("HTTPS redirect in production", () => {
    let server: Server;
    let baseUrl: string;

    before(async () => {
        const app = express();
        applySecurity(app);
        app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));
        app.get("/anything", (_req: Request, res: Response) => res.send("page"));

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => resolve());
        });
        const addr = server.address() as { address: string; port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    after(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    });

    it("redirects a plain-HTTP page request to https", async () => {
        const res = await fetch(`${baseUrl}/anything`, { redirect: "manual" });
        assert.strictEqual(res.status, 301);
        assert.ok(res.headers.get("location")?.startsWith("https://"));
    });

    it("serves a page normally when the proxy reports https", async () => {
        const res = await fetch(`${baseUrl}/anything`, { headers: { "x-forwarded-proto": "https" } });
        assert.strictEqual(res.status, 200);
    });

    // Docker's HEALTHCHECK and uptime-kuma both reach /health over plain HTTP inside the container
    // network, where there is no proxy to set x-forwarded-proto. Redirecting them makes the
    // container permanently unhealthy, so /health is exempt.
    it("serves /health over plain HTTP without redirecting", async () => {
        const res = await fetch(`${baseUrl}/health`, { redirect: "manual" });
        assert.strictEqual(res.status, 200);
    });
});
