import jwt from "jsonwebtoken";
export default (user) => jwt.sign({ sub: user._id.toString(), globalRole: user.globalRole }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
