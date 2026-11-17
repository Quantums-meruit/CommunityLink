import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import corsMiddleware from "./config/cors.js";
import { isDbReady } from "./config/db.js";
import apiRoutes from "./routes/index.js";
import csrfOrigin from "./middleware/csrfMiddleware.js";
import { notFound } from "./middleware/notFoundMiddleware.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

// This file is the API entry point: it wires security middleware, JSON parsing,
// cookie handling, health checks, and the v1 route tree together. The order here
// matters because the app should reject malformed requests before the routes run,
// and every route should sit behind the same global protections.
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) =>
  res.json({ success: true, status: "alive" })
);

app.get("/api/ready", (req, res) =>
  isDbReady()
    ? res.json({ success: true, status: "ready" })
    : res.status(503).json({ success: false, status: "database unavailable" })
);

app.use("/api/v1", csrfOrigin, apiRoutes);
app.use("/api", csrfOrigin, apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
