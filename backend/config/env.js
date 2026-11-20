import dotenv from "dotenv";

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI || "",

  jwtSecret: process.env.JWT_SECRET || "",

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  agoraAppId: process.env.AGORA_APP_ID || "",

  agoraAppCertificate: process.env.AGORA_APP_CERTIFICATE || "",
};

export default env;