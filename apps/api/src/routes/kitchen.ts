import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const kitchenRouter = Router();

const MERCHANT_ID = "merchant_01";

// GET /api/kitchen/orders — active tickets for kitchen display
kitchenRouter.get("/orders", async (req: Request, res: Response) => {
  try {
    const locationId = String(req.query.locationId || "loc_01");
    const since = new Date(Date.now() - 8 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        merchantId: MERCHANT_ID,
        locationId,
        status: "PAID",
        kitchenCompletedAt: null,
        createdAt: { gte: since },
      },
      include: {
        items: { include: { modifiers: true } },
        location: true,
      },
      orderBy: { kitchenQueuedAt: "asc" },
    });

    res.json({ orders });
  } catch {
    res.status(500).json({ error: "Failed to fetch kitchen orders" });
  }
});

// PATCH /api/kitchen/orders/:id/start — mark preparing
kitchenRouter.patch("/orders/:id/start", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { kitchenStartedAt: new Date() },
      include: { items: { include: { modifiers: true } } },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order" });
  }
});

// PATCH /api/kitchen/orders/:id/complete — bump off kitchen screen
kitchenRouter.patch("/orders/:id/complete", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { kitchenCompletedAt: new Date() },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to complete kitchen ticket" });
  }
});

// PATCH /api/kitchen/orders/:id/recall — put back on screen
kitchenRouter.patch("/orders/:id/recall", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { kitchenCompletedAt: null },
      include: { items: { include: { modifiers: true } } },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to recall order" });
  }
});
