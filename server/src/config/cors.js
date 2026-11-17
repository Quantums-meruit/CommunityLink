
import cors from "cors";

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests without an Origin header (e.g. server-to-server tools).
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS."));
  },

  credentials: true,

  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "X-CSRF-Token"],

  optionsSuccessStatus: 204,
});

export default corsMiddleware;
