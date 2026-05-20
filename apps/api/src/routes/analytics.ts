// apps/api/src/routes/analytics.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
export const analyticsRouter = Router();

function defaultTodayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Paid orders in range by completion time (falls back to createdAt if never set). */
function paidOrdersInRangeWhere(
  fromDate: Date,
  toDate: Date,
  locationId?: string
) {
  return {
    merchantId: "merchant_01",
    status: "PAID" as const,
    ...(locationId && { locationId }),
    OR: [
      { completedAt: { gte: fromDate, lte: toDate } },
      {
        AND: [
          { completedAt: null },
          { createdAt: { gte: fromDate, lte: toDate } },
        ],
      },
    ],
  };
}

// ── GET /api/analytics/summary?locationId=&from=&to= ────────────────────
analyticsRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const { locationId, from, to } = req.query;
    const defaults = defaultTodayRange();
    const fromDate = from ? new Date(String(from)) : defaults.from;
    const toDate = to ? new Date(String(to)) : defaults.to;
    const loc = locationId ? String(locationId) : undefined;

    const orders = await prisma.order.findMany({
      where: paidOrdersInRangeWhere(fromDate, toDate, loc),
      include: { payments: { where: { status: "SUCCEEDED" } } },
    });

    const totalRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
    const byMethod: Record<string, number> = {};
    for (const order of orders) {
      for (const p of order.payments) {
        byMethod[p.provider] = (byMethod[p.provider] || 0) + p.amountCents;
      }
    }

    const failedPayments = await prisma.payment.count({
      where: {
        status: "FAILED",
        createdAt: { gte: fromDate, lte: toDate },
        order: {
          merchantId: "merchant_01",
          ...(loc && { locationId: loc }),
        },
      },
    });

    res.json({
      totalRevenueCents: totalRevenue,
      orderCount: orders.length,
      avgOrderCents: orders.length ? Math.round(totalRevenue / orders.length) : 0,
      failedPaymentCount: failedPayments,
      byMethod,
      from: fromDate,
      to: toDate,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
