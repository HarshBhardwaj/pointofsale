// apps/api/src/services/fiskaly.ts
// German KassenSichV fiscalization — every transaction must be TSE-signed
import axios from "axios";
import { logger } from "../lib/logger";

const BASE = process.env.FISKALY_BASE_URL || "https://kassensichv-middleware.fiskaly.com/api/v2";

async function getHeaders() {
  // fiskaly uses API key + secret for auth
  const credentials = Buffer.from(
    `${process.env.FISKALY_API_KEY}:${process.env.FISKALY_API_SECRET}`
  ).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

// ── Start a transaction (before payment) ────────────────────────────────
export async function startFiskalyTransaction({
  tssId,
  clientId,
  txId,
}: {
  tssId: string;
  clientId: string;
  txId: string; // your internal transaction UUID
}) {
  const headers = await getHeaders();
  const { data } = await axios.put(
    `${BASE}/tss/${tssId}/tx/${txId}?req_guessed_tx_state=ACTIVE`,
    {
      type: "RECEIPT",
      state: "ACTIVE",
      client_id: clientId,
    },
    { headers }
  );
  logger.info("fiskaly transaction started", { txId, tssId });
  return data;
}

// ── Finish a transaction with receipt data ───────────────────────────────
export async function finishFiskalyTransaction({
  tssId,
  clientId,
  txId,
  amountCents,
  vatBreakdown,
  paymentMethod,
}: {
  tssId: string;
  clientId: string;
  txId: string;
  amountCents: number;
  vatBreakdown: Array<{ rate: number; netCents: number; vatCents: number; grossCents: number }>;
  paymentMethod: string;
}) {
  const headers = await getHeaders();

  // DSFinV-K process data format
  const amounts = vatBreakdown.map((v) => ({
    vat_rate: `${(v.rate * 100).toFixed(0)}_PERCENT`,
    incl_vat: (v.grossCents / 100).toFixed(2),
    excl_vat: (v.netCents / 100).toFixed(2),
    vat: (v.vatCents / 100).toFixed(2),
  }));

  const processData = {
    cash_amounts_by_currency: [
      { currency_code: "EUR", amount: (amountCents / 100).toFixed(2) },
    ],
    payment_types: [{ type: paymentMethod, amount: (amountCents / 100).toFixed(2) }],
    amounts_per_vat_rate: amounts,
  };

  const { data } = await axios.put(
    `${BASE}/tss/${tssId}/tx/${txId}?req_guessed_tx_state=ACTIVE`,
    {
      type: "RECEIPT",
      state: "FINISHED",
      client_id: clientId,
      schema: { standard_v1: { receipt: processData } },
    },
    { headers }
  );

  logger.info("fiskaly transaction finished", {
    txId,
    signature: data.signature?.value?.substring(0, 20) + "...",
  });
  return data;
}

// ── Cancel a transaction (for refunds/voids) ─────────────────────────────
export async function cancelFiskalyTransaction({
  tssId,
  clientId,
  txId,
}: {
  tssId: string;
  clientId: string;
  txId: string;
}) {
  const headers = await getHeaders();
  const { data } = await axios.put(
    `${BASE}/tss/${tssId}/tx/${txId}?req_guessed_tx_state=ACTIVE`,
    { type: "RECEIPT", state: "CANCELLED", client_id: clientId },
    { headers }
  );
  logger.info("fiskaly transaction cancelled", { txId });
  return data;
}

// ── Trigger DSFinV-K export (for tax office) ────────────────────────────
export async function exportDsfinvk(tssId: string) {
  const headers = await getHeaders();
  const { data } = await axios.post(`${BASE}/tss/${tssId}/export`, {}, { headers });
  logger.info("DSFinV-K export triggered", { tssId, exportId: data._id });
  return data;
}
