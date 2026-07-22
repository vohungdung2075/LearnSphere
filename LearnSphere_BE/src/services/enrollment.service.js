import mongoose from "mongoose";
import Course from "../models/Course.model.js";
import Enrollment from "../models/Enrollment.model.js";
import { createNotification } from "./notification.service.js";

export const enrollCourse = async (courseId, studentId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
    if (!course) throw new Error("COURSE_NOT_FOUND");

	const existingEnrollment = await Enrollment.findOne({ user_id: studentId, course_id: courseId });
	if (existingEnrollment) {
		if (existingEnrollment.status === "active") {
			throw new Error("ALREADY_ENROLLED");
		}
        throw new Error("ENROLLMENT_ALREADY_PENDING");
	}

	const status = course.enrollment_type === "open" ? "active" : "pending";

	const enrollment = await Enrollment.create({
		user_id: studentId,
		course_id: courseId,
		status,
		approved_at: status === "active" ? new Date() : null,
	});

	if (status === "pending") {
		await createNotification({
			recipient_id: course.created_by,
			type: "enrollment",
			title: "Có yêu cầu đăng ký mới",
			message: `Một học viên vừa gửi yêu cầu tham gia khóa học "${course.title}".`,
			link: `/lesson-management?course_id=${courseId}`,
			metadata: { action: "review_enrollment", course_id: courseId, enrollment_id: enrollment._id },
		});
	} else {
		await createNotification({
			recipient_id: studentId,
			type: "enrollment",
			title: "Đăng ký khóa học thành công",
			message: `Bạn đã được ghi danh vào khóa học "${course.title}".`,
			link: `/lesson-detail?course_id=${courseId}`,
			metadata: { action: "start_learning", course_id: courseId, enrollment_id: enrollment._id },
		});
	}

	return enrollment;
};


export const unenrollCourse = async (courseId, studentId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const enrollment = await Enrollment.findOne({ user_id: studentId, course_id: courseId });
    if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

	await enrollment.deleteOne();
    return { message: "Unenrolled from course successfully" };
};


export const getMyCourses = async (studentId) => {
	const enrollments = await Enrollment.find({ user_id: studentId })
		.populate({
			path: "course_id",
			match: { is_deleted: false },
			populate: {
				path: "created_by",
				select: "full_name role",
			},
		})
		.sort({ requested_at: -1 });

	return enrollments.filter( (enrollment) => enrollment.course_id !== null );
};


export const getCourseEnrollments = async (courseId, status, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const allowedStatuses = ["pending", "active"];
	const selectedStatus = status || "pending";
    if (!allowedStatuses.includes(selectedStatus)) throw new Error("INVALID_ENROLLMENT_STATUS");
	
	const course = await Course.findOne({ _id: courseId, is_deleted: false });
    if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
    if ( userRole !== "admin" && !isOwner) throw new Error("FORBIDDEN_COURSE_ACTION");

	return Enrollment.find({ course_id: courseId, status: selectedStatus })
		.populate(
			"user_id",
			"full_name email role",
		)
		.sort({ requested_at: 1 });
};


export const approveEnrollment = async (courseId, enrollmentId, userId, userRole) => {
	if (!mongoose.Types.ObjectId.isValid(courseId)) throw new Error("INVALID_COURSE_ID");
	if (!mongoose.Types.ObjectId.isValid(enrollmentId)) throw new Error("INVALID_ENROLLMENT_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	if (userRole !== "admin" && course.created_by.toString() !== userId.toString()) {
		throw new Error("FORBIDDEN_COURSE_ACTION");
	}

	const enrollment = await Enrollment.findOne({ _id: enrollmentId, course_id: courseId });
	if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

	if (enrollment.status === "active") throw new Error("ENROLLMENT_ALREADY_ACTIVE");

	enrollment.status = "active";
	enrollment.approved_at = new Date();

	await enrollment.save();
	await enrollment.populate("user_id", "full_name email role");

	await createNotification({
		recipient_id: enrollment.user_id._id ?? enrollment.user_id,
		type: "enrollment",
		title: "Yêu cầu đăng ký đã được duyệt",
		message: `Bạn đã được duyệt vào khóa học "${course.title}".`,
		link: `/lesson-detail?course_id=${courseId}`,
		metadata: { action: "start_learning", course_id: courseId, enrollment_id: enrollment._id },
	});

	return enrollment;
};


export const rejectEnrollment = async (courseId, enrollmentId, userId, userRole) => {
	if (!mongoose.Types.ObjectId.isValid(courseId)) throw new Error("INVALID_COURSE_ID");
	if (!mongoose.Types.ObjectId.isValid(enrollmentId)) throw new Error("INVALID_ENROLLMENT_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
    if (!course) throw new Error("COURSE_NOT_FOUND");

	if (userRole !== "admin" && course.created_by.toString() !== userId.toString()) {
		throw new Error("FORBIDDEN_COURSE_ACTION");
	}

	const enrollment = await Enrollment.findOne({ _id: enrollmentId, course_id: courseId });
    if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

	if (enrollment.status === "active") throw new Error("CANNOT_REJECT_ACTIVE_ENROLLMENT");

	const studentId = enrollment.user_id;
	await enrollment.deleteOne();

	await createNotification({
		recipient_id: studentId,
		type: "enrollment",
		title: "Yêu cầu đăng ký bị từ chối",
		message: `Yêu cầu tham gia khóa học "${course.title}" của bạn chưa được chấp nhận.`,
		link: `/my-courses`,
		metadata: { action: "view_my_courses", course_id: courseId, enrollment_id: enrollmentId },
	});

	return { message: "Enrollment request rejected successfully" };
};
