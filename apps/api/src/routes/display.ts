import { Router, Request, Response } from "express";
import { z } from "zod";

export const displayRouter = Router();

type DisplayPayload = {
  lines: { name: string; qty: number; modifiers: string; lineCents: number }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  updatedAt: string;
};

const store = new Map<string, DisplayPayload>();

const PushSchema = z.object({
  locationId: z.string(),
  lines: z.array(z.object({
    name: z.string(),
    qty: z.number().int().positive(),
    modifiers: z.string().optional(),
    lineCents: z.number().int(),
  })),
  subtotalCents: z.number().int(),
  discountCents: z.number().int().default(0),
  totalCents: z.number().int(),
});

displayRouter.get("/", (req: Request, res: Response) => {
  const locationId = String(req.query.locationId || "loc_01");
  const payload = store.get(locationId);
  res.json(payload ?? null);
});

displayRouter.post("/push", (req: Request, res: Response) => {
  try {
    const body = PushSchema.parse(req.body);
    const payload: DisplayPayload = {
      lines: body.lines.map((l) => ({
        name: l.name,
        qty: l.qty,
        modifiers: l.modifiers ?? "",
        lineCents: l.lineCents,
      })),
      subtotalCents: body.subtotalCents,
      discountCents: body.discountCents,
      totalCents: body.totalCents,
      updatedAt: new Date().toISOString(),
    };
    store.set(body.locationId, payload);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Failed to update display" });
  }
});

displayRouter.delete("/", (req: Request, res: Response) => {
  const locationId = String(req.query.locationId || "loc_01");
  store.delete(locationId);
  res.json({ ok: true });
});
