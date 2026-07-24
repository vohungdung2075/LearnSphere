import { createCourse, getAllCourses, getCourseById, updateCourse, deleteCourse, getDeletedCourses, restoreCourse } from "../services/course.service.js";
import { permanentlyDeleteCourse } from "../services/course-cleanup.service.js";

export const handleCreateCourse = async (req, res) => {
	const { title, description, enrollment_type } = req.body ?? {};

    if (typeof title !== "string" || !title.trim()) {
		return res.status(400).json({ message: "Course title is required and must be a string" });
	}
	try {
		const course = await createCourse(
			{ title, description, enrollment_type },
			req.user._id,
		);
		return res.status(201).json({ message: "Course created successfully", course });
	} catch (error) {
        if (error.message === "INVALID_ENROLLMENT_TYPE") return res.status(400).json({ message: "Invalid course enrollment-type" }); 
		if (error.message === "INVALID_DESCRIPTION") return res.status(400).json({ message: "Description must be a string" });

		console.error("Create course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetAllCourses = async (req, res) => {
	try {
		const courses = await getAllCourses();
		return res.status(200).json(courses);
	} catch (error) {
		console.error("Get all courses error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetCourseById = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const course = await getCourseById(course_id);
		return res.status(200).json(course);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });

		console.error("Get course by ID error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleUpdateCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { title, description, thumbnail_key, enrollment_type } = req.body ?? {};
	try {
		const updated = await updateCourse(
			course_id,
			{ title, description, thumbnail_key, enrollment_type },
			req.user._id, 
			req.user.role
		);
		return res.status(200).json({ message: "Course updated successfully", course: updated });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" }); 
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" }); 
		if (error.message === "NO_FIELDS_TO_UPDATE") return res.status(400).json({ message: "At least one field is required to update" });
		if (error.message === "INVALID_COURSE_TITLE") return res.status(400).json({ message: "Invalid course title format" }); 
		if (error.message === "INVALID_ENROLLMENT_TYPE") return res.status(400).json({ message: "Invalid course enrollment-type" }); 
		if (error.message === "INVALID_DESCRIPTION") return res.status(400).json({ message: "Description must be a string" });
		if (error.message === "INVALID_THUMBNAIL_KEY") return res.status(400).json({ message: "Invalid thumbnail key" });
		if (["INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) return res.status(400).json({ message: "Invalid thumbnail file metadata" });
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Thumbnail exceeds the allowed size" });
		if (error.message === "FILE_NOT_FOUND_IN_S3") return res.status(404).json({ message: "Uploaded thumbnail was not found in S3" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify thumbnail with S3" });
		if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to modify this course" });

		console.error("Update course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleDeleteCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { deleted_reason } = req.body ?? {};
	try {
		const result = await deleteCourse(course_id, req.user._id, req.user.role, deleted_reason);
		return res.status(200).json(result); 
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "INVALID_DELETE_REASON") return res.status(400).json({ message: "Delete reason must be a string with at most 500 characters" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to delete this course" });
		if (error.message === "COURSE_HAS_ACTIVE_QUIZ_ATTEMPTS") return res.status(409).json({ message: "Course cannot be deleted while students are taking its quizzes" });

		console.error("Delete course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetDeletedCourses = async (req, res) => {
	try {
		const courses = await getDeletedCourses(req.user._id, req.user.role);
		return res.status(200).json(courses);
	} catch (error) {
		console.error("Get deleted courses error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleRestoreCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const restored = await restoreCourse(course_id, req.user._id, req.user.role);
		return res.status(200).json({ message: "Course restored successfully", course: restored });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to restore this course" });

		console.error("Restore course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handlePermanentlyDeleteCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const result = await permanentlyDeleteCourse(course_id, req.user._id, req.user.role);
		return res.status(200).json({
			message: result.s3_cleanup_pending
				? "Course data permanently deleted; S3 cleanup was queued for retry"
				: "Course, related data, and S3 files permanently deleted",
			...result,
		});
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "DELETED_COURSE_NOT_FOUND") return res.status(404).json({ message: "Deleted course not found" });
		if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "Forbidden - You cannot permanently delete this course" });
		console.error("Permanent course deletion error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
