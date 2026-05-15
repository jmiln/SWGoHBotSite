import type { Request, Response } from "express";
import { Router } from "express";
import { pingDB } from "../modules/db.ts";
import { healthLimiter } from "../middleware/rateLimit.ts";
import logger from "../modules/logger.ts";

const router = Router();

router.get("/health", healthLimiter, async (_req: Request, res: Response) => {
    try {
        await pingDB();
        logger.debug("Health check: ok");
        res.json({ status: "ok", db: "ok", uptime: Math.floor(process.uptime()) });
    } catch (err) {
        logger.debug(`Health check: degraded — ${err instanceof Error ? err.message : String(err)}`);
        res.status(503).json({ status: "degraded", db: "error" });
    }
});

export default router;
