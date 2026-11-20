import ChatMessage from "../models/ChatMessage.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// GET CHAT CONTACTS
const getChatContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [contacts, latestMessages] = await Promise.all([
      User.find({
        _id: { $ne: userId },
        role: { $in: ["student", "faculty"] },
      }).select("name email role").lean(),
      ChatMessage.aggregate([
        {
          $match: {
            $or: [
              { senderId: userObjectId },
              { receiverId: userObjectId },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", userObjectId] },
                "$receiverId",
                "$senderId",
              ],
            },
            message: { $first: "$message" },
            createdAt: { $first: "$createdAt" },
          },
        },
      ]),
    ]);

    const latestMessageByContact = new Map(
      latestMessages.map((item) => [item._id.toString(), item])
    );
    const contactsWithLatestMessage = contacts
      .map((contact) => {
        const latestMessage = latestMessageByContact.get(contact._id.toString());
        return {
          ...contact,
          lastMessage: latestMessage?.message || "",
          lastMessageAt: latestMessage?.createdAt || null,
        };
      })
      .sort((a, b) => {
        if (!a.lastMessageAt) return b.lastMessageAt ? 1 : 0;
        if (!b.lastMessageAt) return -1;
        return (
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
        );
      });

    res.status(200).json({
      success: true,
      contacts: contactsWithLatestMessage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// SEND MESSAGE
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, message } = req.body;

    if (!receiverId || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Receiver and message are required",
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself",
      });
    }

    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    const newMessage = await ChatMessage.create({
      senderId,
      receiverId,
      message: message.trim(),
    });

    const populatedMessage = await ChatMessage.findById(newMessage._id)
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET CHAT HISTORY
const getChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    const messages = await ChatMessage.find({
      $or: [
        {
          senderId: currentUserId,
          receiverId: otherUserId,
        },
        {
          senderId: otherUserId,
          receiverId: currentUserId,
        },
      ],
    })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// MARK MESSAGES AS READ
const markMessagesAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    await ChatMessage.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



export {
  getChatContacts,
  sendMessage,
  getChatHistory,
  markMessagesAsRead,
};