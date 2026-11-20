
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ChatMessage from "../models/ChatMessage.js";

export const registerChatSockets = (io) => {
  // Authenticate socket connection using JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id || decoded.userId);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    const currentUserId = socket.user._id.toString();

    // Join personal room
    socket.join(currentUserId);

    console.log(`Chat user connected: ${currentUserId}`);

    // SEND MESSAGE
    socket.on("chat:send", async (data, callback) => {
      try {
        const { receiverId, message } = data || {};

        if (!receiverId || !message?.trim()) {
          return callback?.({
            success: false,
            message: "Receiver and message are required",
          });
        }

        if (receiverId.toString() === currentUserId) {
          return callback?.({
            success: false,
            message: "You cannot message yourself",
          });
        }

        const receiver = await User.findById(receiverId);

        if (!receiver) {
          return callback?.({
            success: false,
            message: "Receiver not found",
          });
        }

        const senderRole = socket.user.role;
        const receiverRole = receiver.role;

        const validRoles =
          ["student", "faculty"].includes(senderRole) &&
          ["student", "faculty"].includes(receiverRole) &&
          senderRole !== receiverRole;

        if (!validRoles) {
          return callback?.({
            success: false,
            message: "Only student-faculty chat is allowed",
          });
        }

        // Save message to MongoDB
        const savedMessage = await ChatMessage.create({
          senderId: currentUserId,
          receiverId: receiverId,
          message: message.trim(),
        });

        // Populate sender and receiver details
        const populatedMessage = await ChatMessage.findById(
          savedMessage._id
        )
          .populate("senderId", "name role")
          .populate("receiverId", "name role");

        // Deliver message to receiver
        io.to(receiverId.toString()).emit(
          "chat:receive",
          populatedMessage
        );

        // Confirmation to sender
        callback?.({
          success: true,
          data: populatedMessage,
        });
      } catch (error) {
        console.error("Chat send error:", error);

        callback?.({
          success: false,
          message: "Failed to send message",
        });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log(`Chat user disconnected: ${currentUserId}`);
    });
  });
};
