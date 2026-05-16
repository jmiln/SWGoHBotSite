import assert from "node:assert";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";

process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";
process.env.DISCORD_CLIENT_ID = "test";
process.env.DISCORD_CLIENT_SECRET = "test";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test";
process.env.MONGODB_BOT_DB = "test";
process.env.SESSION_SECRET = "test-session-secret-16ch";
process.env.DISCORD_BOT_TOKEN = "test";
process.env.MONGODB_SWAPI_DB = "test";
process.env.ADMIN_DISCORD_ID = "111111111111111111";

const { saveLimiter } = await import("../middleware/rateLimit.ts");

type FakeSession = { flash?: { type: string; message: string } };

describe("saveLimiter handler", () => {
    let server: Server;
    let baseUrl: string;

    before(async () => {
        const app = express();

        // Minimal session stub so the handler can set req.session.flash
        app.use((req, _res, next) => {
            (req as unknown as { session: FakeSession }).session = {};
            next();
        });

        // Mount saveLimiter on a route that mirrors the production pattern
        app.post("/guild/:id/edit", saveLimiter, (_req, res) => {
            res.json({ ok: true });
        });

        // Redirect landing target so fetch can follow the redirect to a 200
        app.get("/guild/:id/edit", (req, res) => {
            res.json({ redirected: true, guildId: req.params.id });
        });

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => resolve());
        });
        const addr = server.address() as { address: string; port: number };
        baseUrl = `http://localhost:${addr.port}`;
    });

    after(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    });

    it("allows requests within the limit and redirects once it is exceeded", async () => {
        const url = `${baseUrl}/guild/123/edit`;

        // All 10 requests within the limit must succeed
        for (let i = 0; i < 10; i++) {
            const r = await fetch(url, { method: "POST" });
            const b = (await r.json()) as { ok: boolean };
            assert.strictEqual(b.ok, true, `Request ${i + 1} should have succeeded`);
        }

        // 11th request exceeds the limit: handler redirects POST→GET /guild/123/edit
        const res = await fetch(url, { method: "POST" });
        const body = (await res.json()) as { redirected: boolean; guildId: string };
        assert.strictEqual(body.redirected, true, "Rate-limited request should have been redirected");
        assert.strictEqual(body.guildId, "123", "guildId param should be threaded through the redirect URL");
    });
});
