import express from "express";
import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import requireAuth from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";
import resourceRoutes from "./resourceRoutes.js";

const router = express.Router();
router.use(requireAuth);

const visibleToUser = (user) => ({
  $and: [
    {
      $or: [
        { recipientId: user.id },
        {
          recipientId: null,
          recipientRole: { $in: [user.role, "all"] },
        },
      ],
    },
    {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    },
  ],
});

router.get(
  "/",
  allowRoles("student", "faculty", "admin"),
  async (req, res, next) => {
    try {
      const requestedLimit = Number.parseInt(String(req.query.limit || ""), 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(100, Math.max(1, requestedLimit))
        : 50;
      const notifications = await Notification.find(visibleToUser(req.user))
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return res.json({ success: true, data: notifications });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/:id",
  allowRoles("student", "faculty", "admin"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID.",
        });
      }

      const notification = await Notification.findOne({
        _id: req.params.id,
        ...visibleToUser(req.user),
      }).lean();
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found.",
        });
      }

      return res.json({ success: true, data: notification });
    } catch (error) {
      return next(error);
    }
  }
);

router.use(
  "/",
  resourceRoutes(Notification, {
    read: [],
    create: ["admin", "faculty"],
    update: ["admin"],
    remove: ["admin"],
  })
);

export default router;
