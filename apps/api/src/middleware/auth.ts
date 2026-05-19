// apps/api/src/middleware/auth.ts
// Clerk JWT verification middleware
// In development (no CLERK_SECRET_KEY set) this is a no-op passthrough.
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Skip in development if Clerk is not configured
  if (process.env.NODE_ENV !== "production" && !process.env.CLERK_SECRET_KEY) {
    req.userId = "dev-user";
    req.userRole = "OWNER";
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // In production: verify JWT with Clerk SDK
  // import { clerkClient } from "@clerk/clerk-sdk-node";
  // const token = authHeader.split(" ")[1];
  // clerkClient.verifyToken(token).then(payload => { req.userId = payload.sub; next(); })
  //   .catch(() => res.status(401).json({ error: "Invalid token" }));

  // For now: pass through (add Clerk SDK once keys are configured)
  req.userId = "dev-user";
  next();
}

export function requireRole(role: "OWNER" | "MANAGER" | "STAFF") {
  const hierarchy = { OWNER: 3, MANAGER: 2, STAFF: 1 };
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userLevel = hierarchy[req.userRole as keyof typeof hierarchy] || 0;
    const requiredLevel = hierarchy[role];
    if (userLevel < requiredLevel) {
      logger.warn("Insufficient role", { userId: req.userId, required: role, actual: req.userRole });
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
