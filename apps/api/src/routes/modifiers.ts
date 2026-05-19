// apps/api/src/routes/modifiers.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const modifiersRouter = Router();

const MERCHANT_ID = "merchant_01";

// GET /api/modifiers — all modifier groups with modifiers
modifiersRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.modifierGroup.findMany({
      where: { merchantId: MERCHANT_ID },
      include: {
        modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });
    res.json(groups);
  } catch {
    res.status(500).json({ error: "Failed to fetch modifiers" });
  }
});
