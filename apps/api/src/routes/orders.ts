// apps/api/src/routes/orders.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { buildOrderItemsData } from "../lib/orderItems";

export const ordersRouter = Router();

const ModifierSelectionSchema = z.object({
  modifierId: z.string(),
});

const CreateOrderSchema = z.object({
  locationId: z.string(),
  deviceId: z.string().optional(),
  clientOrderId: z.string().optional(),
  channel: z.enum(["POS", "QR", "KIOSK"]).default("POS"),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    modifiers: z.array(ModifierSelectionSchema).optional(),
  })),
  discountId: z.string().optional(),
  openTab: z.boolean().optional(),
  tabName: z.string().optional(),
  tipCents: z.number().int().min(0).optional(),
  customerEmail: z.string().email().optional(),
  customerNote: z.string().optional(),
});

const UpdateOpenOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    modifiers: z.array(ModifierSelectionSchema).optional(),
  })),
  discountId: z.string().optional().nullable(),
  tabName: z.string().optional(),
  tipCents: z.number().int().min(0).optional(),
});

function splitGross(lineGrossCents: number, rate: number) {
  const netCents = Math.round(lineGrossCents / (1 + rate));
  const taxCents = lineGrossCents - netCents;
  return { netCents, taxCents };
}

function applyDiscount(
  grossTotal: number,
  netTotal: number,
  taxTotal: number,
  discount: { type: "PERCENT" | "FIXED"; value: number }
) {
  let discountCents =
    discount.type === "PERCENT"
      ? Math.round(grossTotal * (discount.value / 10000))
      : discount.value;
  discountCents = Math.min(discountCents, grossTotal);
  if (discountCents <= 0) return { discountCents: 0, subtotalCents: netTotal, taxCents: taxTotal, totalCents: grossTotal };

  const totalCents = grossTotal - discountCents;
  const ratio = totalCents / grossTotal;
  const subtotalCents = Math.round(netTotal * ratio);
  const taxCents = totalCents - subtotalCents;
  return { discountCents, subtotalCents, taxCents, totalCents };
}

// ── GET /api/orders ── list orders for a location ───────────────────────
ordersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { locationId, status, limit = "50", offset = "0", from, to } = req.query;
    const fromDate = from ? new Date(String(from)) : undefined;
    const toDate = to ? new Date(String(to)) : undefined;

    const dateFilter =
      fromDate && toDate
        ? {
            OR: [
              { completedAt: { gte: fromDate, lte: toDate } },
              {
                AND: [
                  { completedAt: null },
                  { createdAt: { gte: fromDate, lte: toDate } },
                ],
              },
            ],
          }
        : {};

    const orders = await prisma.order.findMany({
      where: {
        merchantId: "merchant_01",
        ...(locationId && { locationId: String(locationId) }),
        ...(status && { status: String(status) as any }),
        ...dateFilter,
      },
      include: {
        items: { include: { product: true, modifiers: true } },
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

// ── GET /api/orders/:id/balance ── paid vs due ─────────────────────────
ordersRouter.get("/:id/balance", async (req: Request, res: Response) => {
  try {
    const { getOrderBalance } = await import("../lib/orderBalance");
    const balance = await getOrderBalance(req.params.id);
    if (!balance) return res.status(404).json({ error: "Order not found" });
    res.json(balance);
  } catch {
    res.status(500).json({ error: "Failed to get balance" });
  }
});

// ── GET /api/orders/:id ── single order ──────────────────────────────────
ordersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true, taxRate: true, modifiers: true } },
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
        include: { items: { include: { product: true, modifiers: true } } },
      });
      if (existing) return res.status(200).json(existing);
    }

    let subtotalCents: number;
    let taxCents: number;
    let itemsData: Awaited<ReturnType<typeof buildOrderItemsData>>["itemsData"];
    try {
      const built = await buildOrderItemsData(body.items);
      subtotalCents = built.subtotalCents;
      taxCents = built.taxCents;
      itemsData = built.itemsData;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "PRODUCT_NOT_FOUND") return res.status(400).json({ error: "One or more products not found or inactive" });
      if (msg === "MODIFIER_NOT_FOUND") return res.status(400).json({ error: "One or more modifiers not found or inactive" });
      throw e;
    }

    const grossTotal = subtotalCents + taxCents;
    let finalSubtotal = subtotalCents;
    let finalTax = taxCents;
    let finalTotal = grossTotal;
    let discountCents = 0;
    let discountId: string | undefined;
    let discountName: string | undefined;
    let discountType: "PERCENT" | "FIXED" | undefined;

    if (body.discountId) {
      const discount = await prisma.discount.findFirst({
        where: { id: body.discountId, merchantId: "merchant_01", isActive: true },
      });
      if (!discount) return res.status(400).json({ error: "Discount not found or inactive" });

      const applied = applyDiscount(grossTotal, subtotalCents, taxCents, {
        type: discount.type,
        value: discount.value,
      });
      discountCents = applied.discountCents;
      finalSubtotal = applied.subtotalCents;
      finalTax = applied.taxCents;
      finalTotal = applied.totalCents;
      discountId = discount.id;
      discountName = discount.name;
      discountType = discount.type;
    }

    const tipCents = body.tipCents ?? 0;
    finalTotal += tipCents;

    const orderNumber = `ORD-${Date.now()}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        clientOrderId: body.clientOrderId,
        merchantId: "merchant_01", // In production: from auth context
        locationId: body.locationId,
        deviceId: body.deviceId,
        channel: body.channel,
        subtotalCents: finalSubtotal,
        taxCents: finalTax,
        totalCents: finalTotal,
        tipCents,
        discountId,
        discountName,
        discountType,
        discountCents,
        status: body.openTab ? "OPEN" : "PENDING",
        tabName: body.tabName,
        customerEmail: body.customerEmail,
        customerNote: body.customerNote,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true, modifiers: true } }, discount: true },
    });

    await prisma.auditLog.create({
      data: {
        merchantId: "merchant_01",
        action: "order.created",
        entityType: "Order",
        entityId: order.id,
        after: order as any,
      },
    });

    logger.info("Order created", { orderId: order.id, total: finalTotal, discountCents });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error("Failed to create order", { err });
    res.status(500).json({ error: "Failed to create order" });
  }
});

const UPDATABLE_ORDER_STATUSES = ["OPEN", "PENDING", "AWAITING_PAYMENT"] as const;

// ── PATCH /api/orders/:id ── update open tab or in-checkout order ────────
ordersRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const body = UpdateOpenOrderSchema.parse(req.body);
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (!UPDATABLE_ORDER_STATUSES.includes(existing.status as (typeof UPDATABLE_ORDER_STATUSES)[number])) {
      return res.status(400).json({ error: "Order cannot be updated" });
    }

    const isCheckoutOrder = existing.status === "PENDING" || existing.status === "AWAITING_PAYMENT";
    if (isCheckoutOrder) {
      await prisma.payment.updateMany({
        where: {
          orderId: req.params.id,
          status: { in: ["PENDING", "PROCESSING", "REQUIRES_ACTION"] },
        },
        data: { status: "CANCELLED" },
      });
      await prisma.qrPaymentLink.updateMany({
        where: { orderId: req.params.id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
    }

    const built = await buildOrderItemsData(body.items);
    const grossTotal = built.subtotalCents + built.taxCents;
    let finalSubtotal = built.subtotalCents;
    let finalTax = built.taxCents;
    let finalTotal = grossTotal;
    let discountCents = 0;
    let discountId: string | null = body.discountId ?? existing.discountId;
    let discountName = existing.discountName;
    let discountType = existing.discountType;

    if (discountId) {
      const discount = await prisma.discount.findFirst({
        where: { id: discountId, merchantId: "merchant_01", isActive: true },
      });
      if (!discount) return res.status(400).json({ error: "Discount not found" });
      const applied = applyDiscount(grossTotal, built.subtotalCents, built.taxCents, {
        type: discount.type,
        value: discount.value,
      });
      discountCents = applied.discountCents;
      finalSubtotal = applied.subtotalCents;
      finalTax = applied.taxCents;
      finalTotal = applied.totalCents;
      discountName = discount.name;
      discountType = discount.type;
    } else {
      discountId = null;
      discountName = null;
      discountType = null;
    }

    const tipCents = body.tipCents ?? existing.tipCents;
    finalTotal += tipCents;

    await prisma.orderItem.deleteMany({ where: { orderId: req.params.id } });
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        subtotalCents: finalSubtotal,
        taxCents: finalTax,
        totalCents: finalTotal,
        tipCents,
        discountId,
        discountName,
        discountType,
        discountCents,
        status: isCheckoutOrder ? "PENDING" : existing.status,
        tabName: body.tabName ?? existing.tabName,
        items: { create: built.itemsData },
      },
      include: { items: { include: { product: true, modifiers: true } }, discount: true },
    });
    res.json(order);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Failed to update order" });
  }
});

// ── PATCH /api/orders/:id/cancel ── abandon unpaid checkout ───────────────
ordersRouter.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (!["PENDING", "AWAITING_PAYMENT"].includes(existing.status)) {
      return res.status(400).json({ error: "Only unpaid checkout orders can be cancelled" });
    }

    await prisma.payment.updateMany({
      where: {
        orderId: req.params.id,
        status: { in: ["PENDING", "PROCESSING", "REQUIRES_ACTION"] },
      },
      data: { status: "CANCELLED" },
    });
    await prisma.qrPaymentLink.updateMany({
      where: { orderId: req.params.id, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
});
