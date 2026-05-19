// apps/api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error("Unhandled error", { err: err.message, stack: err.stack, path: req.path });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
