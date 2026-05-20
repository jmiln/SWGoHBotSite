import type { NextFunction, Request, Response } from "express";
import logger from "../modules/logger.ts";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    res.on("finish", () => {
        const { statusCode } = res;
        if (statusCode >= 500) {
            logger.error(`${req.method} ${req.path} ${statusCode}`);
        } else if (statusCode >= 400) {
            logger.warn(`${req.method} ${req.path} ${statusCode}`);
        }
    });
    next();
}
