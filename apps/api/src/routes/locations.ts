// apps/api/src/routes/locations.ts
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
export const locationsRouter = Router();

locationsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      where: { merchantId: "merchant_01", isActive: true },
      include: { devices: true },
    });
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

locationsRouter.get("/:id/devices", async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      where: { locationId: req.params.id },
    });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});
