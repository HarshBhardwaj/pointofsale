// apps/api/src/routes/qr.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const qrRouter = Router();

// GET /api/payments/qr/:token  — resolve a QR token to order details
qrRouter.get("/:token", async (req: Request, res: Response) => {
  try {
    const link = await prisma.qrPaymentLink.findUnique({
      where: { token: req.params.token },
      include: {
        order: {
          include: {
            items: true,
            payments: { where: { provider: "PAYPAL" } },
          },
        },
      },
    });

    if (!link) return res.status(404).json({ error: "Payment link not found" });
    if (link.status === "EXPIRED" || new Date() > link.expiresAt) {
      await prisma.qrPaymentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
      return res.status(410).json({ error: "Payment link has expired" });
    }
    if (link.status === "COMPLETED") {
      return res.status(409).json({ error: "This order has already been paid" });
    }

    // Mark as scanned
    await prisma.qrPaymentLink.update({ where: { id: link.id }, data: { status: "SCANNED", scannedAt: new Date() } });

    const paypalPayment = link.order.payments[0];
    const approvalUrl = paypalPayment?.metadata
      ? (paypalPayment.metadata as any).approvalUrl
      : null;

    res.json({
      orderNumber: link.order.orderNumber,
      totalCents: link.order.totalCents,
      items: link.order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        totalCents: i.totalCents,
      })),
      approvalUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load payment link" });
  }
});
