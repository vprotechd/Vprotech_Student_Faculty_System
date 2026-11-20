import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import connectDB from "./config/db.js";
dotenv.config();
const run = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters) in .env before seeding.");
  }
  await connectDB();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error("An account with ADMIN_EMAIL already exists; refusing to change its role or password.");
  const user = await User.create({ name: ADMIN_NAME.trim(), email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: "admin", isActive: true });
  console.log(`Initial administrator created: ${user.email}`);
  await mongoose.disconnect();
};
run().catch(async error => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
