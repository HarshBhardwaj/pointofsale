import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const kitchenRouter = Router();

const MERCHANT_ID = "merchant_01";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/kitchen/orders — tickets for kitchen swim lanes
kitchenRouter.get("/orders", async (req: Request, res: Response) => {
  try {
    const locationId = String(req.query.locationId || "loc_01");
    const dayStart = startOfToday();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        merchantId: MERCHANT_ID,
        locationId,
        status: "PAID",
        createdAt: { gte: since },
        OR: [
          { kitchenCompletedAt: null },
          { kitchenCompletedAt: { gte: dayStart } },
        ],
      },
      include: {
        items: { include: { modifiers: true } },
        location: true,
      },
      orderBy: [{ kitchenQueuedAt: "asc" }, { createdAt: "asc" }],
    });

    res.json({ orders, dayStart });
  } catch {
    res.status(500).json({ error: "Failed to fetch kitchen orders" });
  }
});

// PATCH /api/kitchen/orders/:id/start — move to Start lane
kitchenRouter.patch("/orders/:id/start", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        kitchenStartedAt: new Date(),
        kitchenPendingAt: null,
      },
      include: { items: { include: { modifiers: true } } },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order" });
  }
});

// PATCH /api/kitchen/orders/:id/pending — move to Pending lane
kitchenRouter.patch("/orders/:id/pending", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        kitchenPendingAt: new Date(),
        kitchenStartedAt: existing.kitchenStartedAt ?? new Date(),
      },
      include: { items: { include: { modifiers: true } } },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order" });
  }
});

// PATCH /api/kitchen/orders/:id/complete — move to Completed lane
kitchenRouter.patch("/orders/:id/complete", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        kitchenCompletedAt: new Date(),
        kitchenPendingAt: null,
      },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to complete kitchen ticket" });
  }
});

// PATCH /api/kitchen/orders/:id/recall — put back on screen from completed
kitchenRouter.patch("/orders/:id/recall", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        kitchenCompletedAt: null,
        kitchenPendingAt: null,
        kitchenStartedAt: new Date(),
      },
      include: { items: { include: { modifiers: true } } },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to recall order" });
  }
});
