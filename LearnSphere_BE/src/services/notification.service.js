import mongoose from "mongoose";
import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";

const MAX_LIMIT = 50;

function resolveNotificationLink(notification, recipientRole) {
	if (
		notification.type === "enrollment" &&
		notification.link === "/courses" &&
		notification.metadata?.course_id
	) {
		if (recipientRole === "student") return "/my-courses";
		return `/lesson-management?course_id=${notification.metadata.course_id}`;
	}

	return notification.link;
}

export const createNotification = async ({ recipient_id, type = "system", title, message, link = "", metadata = {} }) => {
	if (!recipient_id || !title || !message) return null;

	return Notification.create({
		recipient_id,
		type,
		title,
		message,
		link,
		metadata,
	});
};

export const getMyNotifications = async (userId, { limit = 20 } = {}) => {
	const selectedLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

	const [items, unreadCount, recipient] = await Promise.all([
		Notification.find({ recipient_id: userId })
			.sort({ createdAt: -1 })
			.limit(selectedLimit)
			.lean(),
		Notification.countDocuments({ recipient_id: userId, read_at: null }),
		User.findById(userId).select("role").lean(),
	]);

	return {
		items: items.map((item) => ({
			...item,
			link: resolveNotificationLink(item, recipient?.role),
		})),
		unread_count: unreadCount,
	};
};

export const markNotificationAsRead = async (userId, notificationId) => {
	if (!mongoose.isValidObjectId(notificationId)) throw new Error("INVALID_NOTIFICATION_ID");

	const notification = await Notification.findOne({ _id: notificationId, recipient_id: userId });
	if (!notification) throw new Error("NOTIFICATION_NOT_FOUND");

	if (!notification.read_at) {
		notification.read_at = new Date();
		await notification.save();
	}

	return notification;
};

export const markAllNotificationsAsRead = async (userId) => {
	const now = new Date();
	await Notification.updateMany(
		{ recipient_id: userId, read_at: null },
		{ $set: { read_at: now } },
	);

	return { message: "All notifications marked as read" };
};
