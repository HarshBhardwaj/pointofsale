// apps/api/src/middleware/idempotency.ts
// Prevents duplicate payment requests if the client retries
import { Request, Response, NextFunction } from "express";

const cache = new Map<string, { status: number; body: any; ts: number }>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function idempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["idempotency-key"] as string;
  if (!key || req.method !== "POST") return next();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return res.status(cached.status).json(cached.body);
  }

  const origJson = res.json.bind(res);
  res.json = (body: any) => {
    cache.set(key, { status: res.statusCode, body, ts: Date.now() });
    return origJson(body);
  };

  next();
}
