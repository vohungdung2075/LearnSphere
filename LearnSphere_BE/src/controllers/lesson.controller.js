import { createLesson, getCourseLessons, getLessonById, updateLesson, deleteLesson, completeLesson, getCourseProgress } from "../services/lesson.service.js";
import { indexLessonFilesForAI } from "../services/lesson-ai-index.service.js";

export const handleCreateLesson = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { title, content, video_key, document_key, order_index } = req.body ?? {};
	try {
		const lesson = await createLesson(course_id, { title, content, video_key, document_key, order_index }, req.user._id, req.user.role);
		return res.status(201).json({ message: "Lesson created successfully", lesson });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Permission denied" });
		if (error.message === "INVALID_LESSON_TITLE") return res.status(400).json({ message: "Valid lesson title is required" });
		if (error.message === "INVALID_CONTENT") return res.status(400).json({ message: "Content must be a string" });
		if (error.message === "INVALID_VIDEO_KEY") return res.status(400).json({ message: "Invalid video key" });
		if (error.message === "INVALID_DOCUMENT_KEY") return res.status(400).json({ message: "Invalid document key" });
		if (["INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) return res.status(400).json({ message: "Invalid lesson file metadata" });
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Lesson file exceeds the allowed size" });
		if (error.message === "FILE_NOT_FOUND_IN_S3") return res.status(404).json({ message: "Uploaded lesson file was not found in S3" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify lesson file with S3" });
		if (error.message === "INVALID_ORDER_INDEX") return res.status(400).json({ message: "Order index must be a positive integer" });
		if (error.code === 11000) return res.status(409).json({ message: "This order index already exists in the course" });

		console.error("Create lesson error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetCourseLessons = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const lessons = await getCourseLessons(course_id, req.user._id, req.user.role);
		return res.status(200).json(lessons);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "You must be actively enrolled to view lessons" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetLessonById = async (req, res) => {
	const { lesson_id } = req.params ?? {};
	try {
		const lesson = await getLessonById(lesson_id, req.user._id, req.user.role);
		return res.status(200).json(lesson);
	} catch (error) {
		if (error.message === "INVALID_LESSON_ID") return res.status(400).json({ message: "Invalid lesson ID format" });
		if (error.message === "LESSON_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Access denied - Active enrollment required" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleUpdateLesson = async (req, res) => {
	const { lesson_id } = req.params ?? {};
	const { title, content, video_key, document_key, order_index } = req.body ?? {};
	try {
		const updated = await updateLesson(lesson_id, { title, content, video_key, document_key, order_index }, req.user._id, req.user.role);
		return res.status(200).json({ message: "Lesson updated successfully", lesson: updated });
	} catch (error) {
		if (error.message === "INVALID_LESSON_ID") return res.status(400).json({ message: "Invalid lesson ID format" });
		if (error.message === "LESSON_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "NO_FIELDS_TO_UPDATE") return res.status(400).json({ message: "At least one lesson field is required" });
		if (error.message === "INVALID_LESSON_TITLE") return res.status(400).json({ message: "Invalid lesson title format" });
		if (error.message === "INVALID_CONTENT") return res.status(400).json({ message: "Content must be a string" });
		if (error.message === "INVALID_VIDEO_KEY") return res.status(400).json({ message: "Invalid video key" });
		if (error.message === "INVALID_DOCUMENT_KEY") return res.status(400).json({ message: "Invalid document key" });
		if (["INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) return res.status(400).json({ message: "Invalid lesson file metadata" });
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Lesson file exceeds the allowed size" });
		if (error.message === "FILE_NOT_FOUND_IN_S3") return res.status(404).json({ message: "Uploaded lesson file was not found in S3" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify lesson file with S3" });
		if (error.message === "INVALID_ORDER_INDEX") return res.status(400).json({ message: "Order index must be a positive integer" });
		if (error.code === 11000) return res.status(409).json({ message: "This order index already exists in the course" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleDeleteLesson = async (req, res) => {
	const { lesson_id } = req.params ?? {};
	try {
		const result = await deleteLesson(lesson_id, req.user._id, req.user.role);
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "INVALID_LESSON_ID") return res.status(400).json({ message: "Invalid lesson ID format" });
		if (error.message === "LESSON_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "S3_DELETE_FAILED" || error.message === "S3_NOT_CONFIGURED") return res.status(502).json({ message: "Unable to delete lesson files from S3; lesson was not deleted", code: error.message });

		console.error("Delete lesson error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleCompleteLesson = async (req, res) => {
	const { lesson_id } = req.params ?? {};
	try {
		const progress = await completeLesson(lesson_id, req.user._id);
		return res.status(200).json({ message: "Lesson marked as completed successfully", progress });
	} catch (error) {
		if (error.message === "INVALID_LESSON_ID") return res.status(400).json({ message: "Invalid lesson ID format" });
		if (error.message === "LESSON_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "You must be an active student of this course to complete this lesson" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetCourseProgress = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const progress = await getCourseProgress(course_id, req.user._id);
		return res.status(200).json(progress);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to view progress" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleIndexLessonForAI = async (req, res) => {
	try {
		const result = await indexLessonFilesForAI(req.params?.lesson_id, req.user._id, req.user.role);
		return res.status(200).json({ message: "Lesson files processed for AI", ...result });
	} catch (error) {
		if (error.message === "INVALID_LESSON_ID") return res.status(400).json({ message: "Invalid lesson ID format" });
		if (error.message === "LESSON_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_LESSON_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "LESSON_DOCUMENT_REQUIRED") return res.status(409).json({ message: "A document is required for AI indexing", code: error.message });
		if (error.message === "AI_INDEX_IN_PROGRESS") return res.status(409).json({ message: "Lesson files are already being processed", code: error.message });

		console.error("Index lesson files for AI error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
