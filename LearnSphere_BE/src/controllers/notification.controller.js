import { getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "../services/notification.service.js";

export const handleGetMyNotifications = async (req, res) => {
	try {
		const result = await getMyNotifications(req.user._id, req.query ?? {});
		return res.status(200).json(result);
	} catch (error) {
		console.error("Get notifications error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleMarkNotificationAsRead = async (req, res) => {
	try {
		const notification = await markNotificationAsRead(req.user._id, req.params.notification_id);
		return res.status(200).json(notification);
	} catch (error) {
		if (error.message === "INVALID_NOTIFICATION_ID") return res.status(400).json({ message: "Invalid notification ID format" });
		if (error.message === "NOTIFICATION_NOT_FOUND") return res.status(404).json({ message: "Notification not found" });

		console.error("Mark notification read error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleMarkAllNotificationsAsRead = async (req, res) => {
	try {
		const result = await markAllNotificationsAsRead(req.user._id);
		return res.status(200).json(result);
	} catch (error) {
		console.error("Mark all notifications read error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
