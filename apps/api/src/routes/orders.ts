// apps/api/src/routes/orders.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export const ordersRouter = Router();

const CreateOrderSchema = z.object({
  locationId: z.string(),
  deviceId: z.string().optional(),
  clientOrderId: z.string().optional(),
  channel: z.enum(["POS", "QR", "KIOSK"]).default("POS"),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
  customerEmail: z.string().email().optional(),
  customerNote: z.string().optional(),
});

// ── GET /api/orders ── list orders for a location ───────────────────────
ordersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { locationId, status, limit = "50", offset = "0" } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(locationId && { locationId: String(locationId) }),
        ...(status && { status: String(status) as any }),
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        receipt: true,
        location: true,
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });
    res.json({ orders, total: orders.length });
  } catch (err) {
    logger.error("Failed to list orders", { err });
    res.status(500).json({ error: "Failed to list orders" });
  }
});

// ── GET /api/orders/:id ── single order ──────────────────────────────────
ordersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true, taxRate: true } },
        payments: true,
        refunds: true,
        receipt: true,
        fiscalTransaction: true,
        location: true,
        device: true,
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to get order" });
  }
});

// ── POST /api/orders ── create order ─────────────────────────────────────
ordersRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateOrderSchema.parse(req.body);

    if (body.clientOrderId) {
      const existing = await prisma.order.findUnique({
        where: { clientOrderId: body.clientOrderId },
        include: { items: { include: { product: true } } },
      });
      if (existing) return res.status(200).json(existing);
    }

    // Fetch products with tax rates
    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map((i) => i.productId) }, isActive: true },
      include: { taxRate: true },
    });

    if (products.length !== body.items.length) {
      return res.status(400).json({ error: "One or more products not found or inactive" });
    }

    // Calculate totals
    let subtotalCents = 0, taxCents = 0;
    const itemsData = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const lineCents = product.priceCents * item.quantity;
      const rate = Number(product.taxRate.rate);
      const netCents = Math.round(lineCents / (1 + rate));
      const itemTax = lineCents - netCents;
      subtotalCents += netCents;
      taxCents += itemTax;
      return {
        productId: product.id,
        taxRateId: product.taxRateId,
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
        subtotalCents: netCents,
        taxCents: itemTax,
        totalCents: lineCents,
        taxRateSnapshot: product.taxRate.rate,
      };
    });

    const totalCents = subtotalCents + taxCents;
    const orderNumber = `ORD-${Date.now()}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        clientOrderId: body.clientOrderId,
        merchantId: "merchant_01", // In production: from auth context
        locationId: body.locationId,
        deviceId: body.deviceId,
        channel: body.channel,
        subtotalCents,
        taxCents,
        totalCents,
        customerEmail: body.customerEmail,
        customerNote: body.customerNote,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true } } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        merchantId: "merchant_01",
        action: "order.created",
        entityType: "Order",
        entityId: order.id,
        after: order as any,
      },
    });

    logger.info("Order created", { orderId: order.id, total: totalCents });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error("Failed to create order", { err });
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ── PATCH /api/orders/:id/cancel ──────────────────────────────────────────
ordersRouter.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
});
