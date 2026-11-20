import Notification from "../models/Notification.js";

export const createNotification = async (notification) =>
  Notification.create(notification);