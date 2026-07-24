import mongoose from "mongoose";
import Course from "../models/Course.model.js";
import CourseDiscussion from "../models/CourseDiscussion.model.js";
import Enrollment from "../models/Enrollment.model.js";
import { createNotificationBestEffort } from "./notification.service.js";

const verifyDiscussionAccess = async (courseId, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	if (userRole === "admin") return course;

	if (userRole === "tutor") {
		const isOwner = course.created_by.toString() === userId.toString();
		if (!isOwner) throw new Error("FORBIDDEN_DISCUSSION_ACTION");
		return course;
	}

	if (userRole === "student") {
		const enrollment = await Enrollment.findOne({
			user_id: userId,
			course_id: course._id,
			status: "active",
		});
		if (!enrollment) throw new Error("ACTIVE_ENROLLMENT_REQUIRED");
		return course;
	}

	throw new Error("FORBIDDEN_DISCUSSION_ACTION");
};

export const getCourseDiscussions = async (courseId, userId, userRole) => {
	await verifyDiscussionAccess(courseId, userId, userRole);

	return CourseDiscussion.find({ course_id: courseId })
		.populate("author_id", "full_name role")
		.populate("replies.author_id", "full_name role")
		.sort({ createdAt: 1 });
};

export const createCourseDiscussion = async (courseId, content, userId, userRole) => {
	const course = await verifyDiscussionAccess(courseId, userId, userRole);

	if (typeof content !== "string" || !content.trim()) throw new Error("INVALID_DISCUSSION_CONTENT");
	const normalizedContent = content.trim();
	if (normalizedContent.length > 2000) throw new Error("INVALID_DISCUSSION_CONTENT");

	const discussion = await CourseDiscussion.create({
		course_id: course._id,
		author_id: userId,
		content: normalizedContent,
	});

	await discussion.populate("author_id", "full_name role");

	if (userRole === "student" && course.created_by.toString() !== userId.toString()) {
		await createNotificationBestEffort({
			recipient_id: course.created_by,
			type: "system",
			title: "Có thảo luận mới trong khóa học",
			message: `Một học viên vừa gửi câu hỏi trong khóa học "${course.title}".`,
			link: `/lesson-detail?course_id=${course._id}`,
			metadata: { action: "view_course_discussion", course_id: course._id, discussion_id: discussion._id },
		}, `discussion:${discussion._id}:created`);
	}

	return discussion;
};

export const createCourseDiscussionReply = async (courseId, discussionId, content, userId, userRole) => {
	const course = await verifyDiscussionAccess(courseId, userId, userRole);

	if (!mongoose.isValidObjectId(discussionId)) throw new Error("INVALID_DISCUSSION_ID");
	if (typeof content !== "string" || !content.trim()) throw new Error("INVALID_DISCUSSION_CONTENT");
	const normalizedContent = content.trim();
	if (normalizedContent.length > 2000) throw new Error("INVALID_DISCUSSION_CONTENT");

	const discussion = await CourseDiscussion.findOne({ _id: discussionId, course_id: course._id });
	if (!discussion) throw new Error("DISCUSSION_NOT_FOUND");

	discussion.replies.push({
		author_id: userId,
		content: normalizedContent,
		created_at: new Date(),
	});

	await discussion.save();
	await discussion.populate("author_id", "full_name role");
	await discussion.populate("replies.author_id", "full_name role");

	const latestReply = discussion.replies[discussion.replies.length - 1];
	const questionAuthorId = discussion.author_id?._id ?? discussion.author_id;
	if (questionAuthorId && questionAuthorId.toString() !== userId.toString()) {
		await createNotificationBestEffort({
			recipient_id: questionAuthorId,
			type: "system",
			title: "Có câu trả lời mới",
			message: `Câu hỏi của bạn trong khóa học "${course.title}" vừa có phản hồi mới.`,
			link: `/lesson-detail?course_id=${course._id}`,
			metadata: { action: "view_course_discussion_reply", course_id: course._id, discussion_id: discussion._id, reply_id: latestReply._id },
		}, `discussion:${discussion._id}:reply-author`);
	}

	if (userRole === "student" && course.created_by.toString() !== userId.toString() && course.created_by.toString() !== questionAuthorId?.toString()) {
		await createNotificationBestEffort({
			recipient_id: course.created_by,
			type: "system",
			title: "Có phản hồi mới trong thảo luận",
			message: `Một học viên vừa phản hồi thảo luận trong khóa học "${course.title}".`,
			link: `/lesson-detail?course_id=${course._id}`,
			metadata: { action: "view_course_discussion_reply", course_id: course._id, discussion_id: discussion._id, reply_id: latestReply._id },
		}, `discussion:${discussion._id}:reply-tutor`);
	}

	return discussion;
};
