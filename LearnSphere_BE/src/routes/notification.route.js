import express from "express";
import { handleGetMyNotifications, handleMarkAllNotificationsAsRead, handleMarkNotificationAsRead } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, handleGetMyNotifications);
router.patch("/read-all", protect, handleMarkAllNotificationsAsRead);
router.patch("/:notification_id/read", protect, handleMarkNotificationAsRead);

export default router;
