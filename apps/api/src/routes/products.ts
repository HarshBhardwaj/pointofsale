// apps/api/src/routes/products.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const productsRouter = Router();

const MERCHANT_ID = "merchant_01"; // In production: from Clerk auth context

const ProductSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  taxRateId: z.string(),
  priceCents: z.number().int().positive(),
  emoji: z.string().default("🍔"),
  imageUrl: z.string().url().optional().nullable(),
  stockQty: z.number().int().min(0).optional().nullable(),
  lowStockAt: z.number().int().min(0).optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// ── GET /api/products ─────────────────────────────────────────────────────
productsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { merchantId: MERCHANT_ID, ...(req.query.active && { isActive: true }) },
      include: {
        category: true,
        taxRate: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── GET /api/products/categories ─────────────────────────────────────────
productsRouter.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { merchantId: MERCHANT_ID, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ── POST /api/products ────────────────────────────────────────────────────
productsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const data = ProductSchema.parse(req.body);
    const product = await prisma.product.create({
      data: { ...data, merchantId: MERCHANT_ID },
      include: {
        category: true,
        taxRate: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Failed to create product" });
  }
});

// ── PATCH /api/products/:id ───────────────────────────────────────────────
productsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const data = ProductSchema.partial().parse(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        category: true,
        taxRate: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });
    res.json(product);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Failed to update product" });
  }
});

// ── DELETE /api/products/:id ── soft delete (deactivate) ──────────────────
productsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

