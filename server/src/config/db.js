import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required.");

  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected."));
  mongoose.connection.on("error", (e) => console.error("MongoDB error:", e.message));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log("MongoDB connected.");
}

export const isDbReady = () => mongoose.connection.readyState === 1;