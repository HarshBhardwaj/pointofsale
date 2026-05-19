// apps/api/src/routes/receipts.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateReceipt, renderTextReceipt } from "../services/receipt";
import { logger } from "../lib/logger";

export const receiptsRouter = Router();

// POST /api/receipts  — generate receipt for a paid order
receiptsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const existing = await prisma.receipt.findUnique({ where: { orderId } });
    if (existing) return res.json(existing);

    const receipt = await generateReceipt({
      orderId,
      merchantName: "Muster Food GmbH",
      merchantAddress: "Bernauer Str. 63-64, 13355 Berlin",
      merchantTaxId: "12/345/67890",
    });
    res.status(201).json(receipt);
  } catch (err: any) {
    logger.error("Receipt generation failed", { err });
    res.status(500).json({ error: err.message || "Failed to generate receipt" });
  }
});

// GET /api/receipts/:orderId  — fetch or render receipt
receiptsRouter.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const receipt = await prisma.receipt.findUnique({
      where: { orderId: req.params.orderId },
    });
    if (!receipt) return res.status(404).json({ error: "Receipt not found" });

    if (req.query.format === "text") {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        include: { items: true, fiscalTransaction: true },
      });
      return res.type("text/plain").send(renderTextReceipt(order, receipt));
    }

    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch receipt" });
  }
});
