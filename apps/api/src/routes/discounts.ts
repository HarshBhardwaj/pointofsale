// apps/api/src/routes/discounts.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const discountsRouter = Router();

const MERCHANT_ID = "merchant_01";

// GET /api/discounts — active preset discounts for POS quick buttons
discountsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const discounts = await prisma.discount.findMany({
      where: { merchantId: MERCHANT_ID, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    res.json(discounts);
  } catch {
    res.status(500).json({ error: "Failed to fetch discounts" });
  }
});
