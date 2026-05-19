// apps/api/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";
import { paymentsRouter } from "./routes/payments";
import { webhooksRouter } from "./routes/webhooks";
import { refundsRouter } from "./routes/refunds";
import { locationsRouter } from "./routes/locations";
import { analyticsRouter } from "./routes/analytics";
import { receiptsRouter } from "./routes/receipts";
import { errorHandler } from "./middleware/errorHandler";
import { idempotency } from "./middleware/idempotency";
import { logger } from "./lib/logger";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));

// Webhooks MUST come before express.json() — need raw body for sig verification
app.use("/webhooks", webhooksRouter);

app.use(express.json({ limit: "10mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: "Too many requests" } }));
app.use("/api/payments", idempotency);

app.use("/api/orders",    ordersRouter);
app.use("/api/products",  productsRouter);
app.use("/api/payments",  paymentsRouter);
app.use("/api/refunds",   refundsRouter);
app.use("/api/receipts",  receiptsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/analytics", analyticsRouter);

app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
app.use(errorHandler);

app.listen(PORT, () => logger.info(`API running on port ${PORT} [${process.env.NODE_ENV}]`));
export default app;
