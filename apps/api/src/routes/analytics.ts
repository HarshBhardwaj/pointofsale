// apps/api/src/routes/analytics.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
export const analyticsRouter = Router();

// ── GET /api/analytics/summary?locationId=&from=&to= ────────────────────
analyticsRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const { locationId, from, to } = req.query;
    const fromDate = from ? new Date(String(from)) : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = to ? new Date(String(to)) : new Date();

    const where = {
      merchantId: "merchant_01",
      status: "PAID" as const,
      ...(locationId && { locationId: String(locationId) }),
      createdAt: { gte: fromDate, lte: toDate },
    };

    const [orders, payments] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { payments: { where: { status: "SUCCEEDED" } } },
      }),
      prisma.payment.findMany({
        where: {
          status: "SUCCEEDED",
          order: where,
        },
      }),
    ]);

    const totalRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
    const byMethod = payments.reduce((acc, p) => {
      acc[p.provider] = (acc[p.provider] || 0) + p.amountCents;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalRevenueCents: totalRevenue,
      orderCount: orders.length,
      avgOrderCents: orders.length ? Math.round(totalRevenue / orders.length) : 0,
      byMethod,
      from: fromDate,
      to: toDate,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
