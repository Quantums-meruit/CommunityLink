
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE_NAME = process.env.COOKIE_NAME || "communitylink_token";

const USER_FIELDS = "name email globalRole isActive";

export async function protect(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload || typeof payload !== "object" || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(payload.sub).select(USER_FIELDS);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account unavailable.",
      });
    }

    req.user = user;

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session.",
    });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      if (payload && typeof payload === "object" && payload.sub) {
        const user = await User.findById(payload.sub).select(USER_FIELDS);

        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch {
    // Optional authentication must not block public requests.
  }

  return next();
}
