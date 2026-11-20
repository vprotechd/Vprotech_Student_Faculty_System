import express from "express";

import {
  getChatContacts,
  sendMessage,
  getChatHistory,
  markMessagesAsRead,
} from "../controllers/chatController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/contacts", protect, getChatContacts);
router.post("/send", protect, sendMessage);
router.get("/messages/:userId", protect, getChatHistory);
router.patch("/read/:userId", protect, markMessagesAsRead);

export default router;