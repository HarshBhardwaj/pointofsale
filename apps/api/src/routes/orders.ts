// apps/api/src/routes/orders.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

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
  customerEmail: z.string().email().optional(),
  customerNote: z.string().optional(),
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
    const { locationId, status, limit = "50", offset = "0" } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(locationId && { locationId: String(locationId) }),
        ...(status && { status: String(status) as any }),
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

    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map((i) => i.productId) }, isActive: true },
      include: { taxRate: true },
    });

    if (products.length !== body.items.length) {
      return res.status(400).json({ error: "One or more products not found or inactive" });
    }

    const modifierIds = body.items.flatMap((i) => i.modifiers?.map((m) => m.modifierId) ?? []);
    const modifiers = modifierIds.length
      ? await prisma.modifier.findMany({
          where: { id: { in: modifierIds }, isActive: true },
        })
      : [];

    if (modifierIds.length && modifiers.length !== new Set(modifierIds).size) {
      return res.status(400).json({ error: "One or more modifiers not found or inactive" });
    }

    let subtotalCents = 0;
    let taxCents = 0;
    const itemsData = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const selectedMods = (item.modifiers ?? []).map((sel) => {
        const mod = modifiers.find((m) => m.id === sel.modifierId)!;
        return { modifierId: mod.id, name: mod.name, priceCents: mod.priceCents };
      });
      const modifierCentsPerUnit = selectedMods.reduce((s, m) => s + m.priceCents, 0);
      const unitGross = product.priceCents + modifierCentsPerUnit;
      const lineGross = unitGross * item.quantity;
      const rate = Number(product.taxRate.rate);
      const { netCents, taxCents: itemTax } = splitGross(lineGross, rate);
      subtotalCents += netCents;
      taxCents += itemTax;

      const modLabel = selectedMods.length
        ? selectedMods.map((m) => m.name).join(", ")
        : "";
      const displayName = modLabel ? `${product.name} (${modLabel})` : product.name;

      return {
        productId: product.id,
        taxRateId: product.taxRateId,
        name: displayName,
        priceCents: unitGross,
        quantity: item.quantity,
        subtotalCents: netCents,
        taxCents: itemTax,
        totalCents: lineGross,
        taxRateSnapshot: product.taxRate.rate,
        modifiers: {
          create: selectedMods.map((m) => ({
            modifierId: m.modifierId,
            name: m.name,
            priceCents: m.priceCents,
          })),
        },
      };
    });

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
        discountId,
        discountName,
        discountType,
        discountCents,
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
