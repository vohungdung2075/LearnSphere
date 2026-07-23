import { createCourseDiscussion, createCourseDiscussionReply, getCourseDiscussions } from "../services/discussion.service.js";

export const handleGetCourseDiscussions = async (req, res) => {
	const { course_id } = req.params ?? {};

	try {
		const discussions = await getCourseDiscussions(course_id, req.user._id, req.user.role);
		return res.status(200).json(discussions);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to view course discussions" });
		if (error.message === "FORBIDDEN_DISCUSSION_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to view this discussion" });

		console.error("Get course discussions error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleCreateCourseDiscussion = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { content } = req.body ?? {};

	try {
		const discussion = await createCourseDiscussion(course_id, content, req.user._id, req.user.role);
		return res.status(201).json({ message: "Discussion message sent successfully", discussion });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "INVALID_DISCUSSION_CONTENT") return res.status(400).json({ message: "Discussion content is required and must be at most 2000 characters" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to join course discussions" });
		if (error.message === "FORBIDDEN_DISCUSSION_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to join this discussion" });

		console.error("Create course discussion error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleCreateCourseDiscussionReply = async (req, res) => {
	const { course_id, discussion_id } = req.params ?? {};
	const { content } = req.body ?? {};

	try {
		const discussion = await createCourseDiscussionReply(course_id, discussion_id, content, req.user._id, req.user.role);
		return res.status(201).json({ message: "Discussion reply sent successfully", discussion });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID" || error.message === "INVALID_DISCUSSION_ID") return res.status(400).json({ message: "Invalid ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "DISCUSSION_NOT_FOUND") return res.status(404).json({ message: "Discussion not found" });
		if (error.message === "INVALID_DISCUSSION_CONTENT") return res.status(400).json({ message: "Reply content is required and must be at most 2000 characters" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to reply to discussions" });
		if (error.message === "FORBIDDEN_DISCUSSION_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to reply to this discussion" });

		console.error("Create course discussion reply error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
