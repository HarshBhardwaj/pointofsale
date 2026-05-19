// apps/api/src/services/receipt.ts
// Generates German-compliant receipts (Belegpflicht / §146a AO)
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

interface ReceiptInput {
  orderId: string;
  merchantName: string;
  merchantAddress: string;
  merchantTaxId: string;
}

export async function generateReceipt(input: ReceiptInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: { include: { taxRate: true } },
      payments: { where: { status: "SUCCEEDED" } },
      fiscalTransaction: true,
    },
  });

  if (!order) throw new Error("Order not found");

  // Build VAT breakdown — required by German UStG §14
  const vatMap: Record<string, { rate: number; netCents: number; vatCents: number; grossCents: number }> = {};
  for (const item of order.items) {
    const rate = Number(item.taxRateSnapshot);
    const key = String(rate);
    if (!vatMap[key]) vatMap[key] = { rate, netCents: 0, vatCents: 0, grossCents: 0 };
    vatMap[key].netCents += item.subtotalCents;
    vatMap[key].vatCents += item.taxCents;
    vatMap[key].grossCents += item.totalCents;
  }
  const vatBreakdown = Object.values(vatMap);

  // Sequential receipt number (GoBD — must never be skipped or reused)
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.receipt.count();
  const receiptNumber = `REC-${dateStr}-${String(count + 1).padStart(5, "0")}`;

  const receipt = await prisma.receipt.create({
    data: {
      orderId: input.orderId,
      receiptNumber,
      merchantName: input.merchantName,
      merchantAddress: input.merchantAddress,
      merchantTaxId: input.merchantTaxId,
      vatBreakdown,
      issuedAt: date,
    },
  });

  logger.info("Receipt generated", { receiptNumber, orderId: input.orderId });
  return receipt;
}

// Render a plain-text receipt (for thermal printers)
export function renderTextReceipt(order: any, receipt: any): string {
  const fmt = (c: number) => `EUR ${(c / 100).toFixed(2)}`;
  const lines: string[] = [];
  const hr = "─".repeat(32);

  lines.push("".padStart(8) + receipt.merchantName);
  lines.push(receipt.merchantAddress);
  lines.push(`St.-Nr.: ${receipt.merchantTaxId}`);
  lines.push(hr);
  lines.push(`Beleg-Nr.: ${receipt.receiptNumber}`);
  lines.push(`Datum: ${new Date(receipt.issuedAt).toLocaleString("de-DE")}`);
  lines.push(hr);

  for (const item of order.items) {
    const name = item.name.slice(0, 20).padEnd(20);
    const total = fmt(item.totalCents).padStart(11);
    lines.push(`${name}${total}`);
    if (item.quantity > 1) {
      lines.push(`  ${item.quantity} x ${fmt(item.priceCents)}`);
    }
  }

  lines.push(hr);
  lines.push(`${"GESAMT".padEnd(20)}${fmt(order.totalCents).padStart(12)}`);
  lines.push(hr);

  // VAT breakdown — legally required
  lines.push("MwSt.-Aufschlüsselung:");
  for (const v of (receipt.vatBreakdown as any[])) {
    const pct = `${(v.rate * 100).toFixed(0)}%`;
    lines.push(`  MwSt. ${pct}: Netto ${fmt(v.netCents)} + ${fmt(v.vatCents)} = ${fmt(v.grossCents)}`);
  }

  lines.push(hr);

  // TSE signature block — required by KassenSichV
  if (order.fiscalTransaction?.signature) {
    lines.push("TSE-Signatur:");
    lines.push(order.fiscalTransaction.signature.slice(0, 40) + "...");
    lines.push(`TSE-Zähler: ${order.fiscalTransaction.signatureCounter}`);
    lines.push(hr);
  }

  lines.push("Vielen Dank für Ihren Einkauf!");
  lines.push("Bitte heben Sie diesen Beleg auf.");

  return lines.join("\n");
}
