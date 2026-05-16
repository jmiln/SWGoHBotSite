import assert from "node:assert";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import { closeDB, connectDB } from "../modules/db.ts";
import healthRoutes from "../routes/health.ts";

describe("GET /health", () => {
    let server: Server;
    let baseUrl: string;

    before(async () => {
        await connectDB();
        const app = express();
        app.use("/", healthRoutes);
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
        await closeDB();
    });

    it("returns 503 when the database is unreachable", async () => {
        await closeDB();
        try {
            const res = await fetch(`${baseUrl}/health`);
            assert.strictEqual(res.status, 503);
            const body = (await res.json()) as { status: string; db: string };
            assert.strictEqual(body.status, "degraded");
            assert.strictEqual(body.db, "error");
        } finally {
            await connectDB();
        }
    });

    it("returns 200 with ok status when DB is healthy", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assert.strictEqual(res.status, 200);
        const body = (await res.json()) as { status: string; db: string; uptime: number };
        assert.strictEqual(body.status, "ok");
        assert.strictEqual(body.db, "ok");
        assert.ok(typeof body.uptime === "number");
    });
});
