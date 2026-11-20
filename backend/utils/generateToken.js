import jwt from "jsonwebtoken";
import env from "../config/env.js";

const generateToken = (user, sessionId) => {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with a strong random secret."
    );
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      sessionId,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      algorithm: "HS256",
    }
  );
};

export default generateToken;