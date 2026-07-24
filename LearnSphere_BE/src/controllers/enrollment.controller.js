import { enrollCourse, unenrollCourse, getMyCourses, getCourseEnrollments, approveEnrollment, removeEnrollment } from "../services/enrollment.service.js";

export const handleEnrollCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const enrollment = await enrollCourse(course_id, req.user._id);

		const message = enrollment.status === "active"
				? "Enrolled in course successfully"
				: "Enrollment request submitted successfully";

		return res.status(201).json({ message, enrollment });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "ALREADY_ENROLLED") return res.status(409).json({ message: "You are already enrolled" });
		if (error.message === "ENROLLMENT_ALREADY_PENDING") return res.status(409).json({ message: "Your enrollment request is already pending" });
		if (error.code === 11000) return res.status(409).json({ message: "An enrollment already exists" });

		console.error("Enroll course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleUnenrollCourse = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const result = await unenrollCourse(course_id, req.user._id);
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "ENROLLMENT_NOT_FOUND") return res.status(404).json({ message: "Enrollment not found" });
		if (error.message === "ACTIVE_QUIZ_ATTEMPT_EXISTS") return res.status(409).json({ message: "Finish or wait for the active quiz attempt to expire before unenrolling" });

		console.error("Unenroll course error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetMyCourses = async (req, res) => {
	try {
		const enrollments = await getMyCourses(req.user._id);
		return res.status(200).json(enrollments);
	} catch (error) {
		console.error("Get my courses error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetCourseEnrollments = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { status } = req.query ?? {};
	try {
		const enrollments = await getCourseEnrollments(
				course_id,
				status,
				req.user._id,
				req.user.role,
			);
		return res.status(200).json(enrollments);
	} catch (error) {
        if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "INVALID_ENROLLMENT_STATUS") return res.status(400).json({ message: "Invalid enrollment status" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "Forbidden - You do not have permission to view enrollments for this course" });

		console.error("Get course enrollments error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleApproveEnrollment = async (req, res) => {
    const { course_id, enrollment_id } = req.params;
    try {
		const enrollment = await approveEnrollment(
			course_id,
			enrollment_id,
			req.user._id,
			req.user.role
		);
		return res.status(200).json({ message: "Enrollment approved successfully", enrollment });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID" || error.message === "INVALID_ENROLLMENT_ID") return res.status(400).json({ message: "Invalid ID format" });
        if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
        if (error.message === "ENROLLMENT_NOT_FOUND") return res.status(404).json({ message: "Enrollment request not found" });
        if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "You don't have permission to approve this enrollment" });
        if (error.message === "ENROLLMENT_ALREADY_ACTIVE") return res.status(409).json({ message: "Enrollment is already active" });
        if (error.message === "ENROLLMENT_STATE_CHANGED") return res.status(409).json({ message: "Enrollment state changed; refresh and try again" });

		console.error("Approve enrollment error:", error);
		return res.status(500).json({ message: "Internal server error" });
	
	}
};


export const handleRemoveEnrollment = async (req, res) => {
	const { course_id, enrollment_id } = req.params;
	try {
		const result = await removeEnrollment(
			course_id,
			enrollment_id,
			req.user._id,
			req.user.role
		);
		return res.status(200).json(result); 
	} catch (error) {
        if (error.message === "INVALID_COURSE_ID" || error.message === "INVALID_ENROLLMENT_ID") return res.status(400).json({ message: "Invalid ID format" });
        if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
        if (error.message === "ENROLLMENT_NOT_FOUND") return res.status(404).json({ message: "Enrollment request not found" });
        if (error.message === "FORBIDDEN_COURSE_ACTION") return res.status(403).json({ message: "You don't have permission to remove this enrollment" });
        if (error.message === "ACTIVE_QUIZ_ATTEMPT_EXISTS") return res.status(409).json({ message: "Học viên đang làm quiz; chưa thể xóa khỏi khóa học." });
        if (error.message === "ENROLLMENT_STATE_CHANGED") return res.status(409).json({ message: "Enrollment state changed; refresh and try again" });

		console.error("Remove enrollment error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
