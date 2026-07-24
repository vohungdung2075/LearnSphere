import mongoose from "mongoose";
import Course from "../models/Course.model.js";
import Enrollment from "../models/Enrollment.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";
import { createNotificationBestEffort } from "./notification.service.js";
import { requireActiveCourseCreator } from "./course-availability.service.js";

export const enrollCourse = async (courseId, studentId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
    if (!course) throw new Error("COURSE_NOT_FOUND");
	await requireActiveCourseCreator(course);

	const existingEnrollment = await Enrollment.findOne({ user_id: studentId, course_id: courseId });
	if (existingEnrollment) {
		if (existingEnrollment.status === "active") {
			throw new Error("ALREADY_ENROLLED");
		}
		if (course.enrollment_type === "open") {
			existingEnrollment.status = "active";
			existingEnrollment.approved_at = new Date();
			await existingEnrollment.save();
			return existingEnrollment;
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
	const courseStillAvailable = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!courseStillAvailable) {
		await Enrollment.deleteOne({ _id: enrollment._id });
		throw new Error("COURSE_NOT_FOUND");
	}
	try {
		await requireActiveCourseCreator(courseStillAvailable);
	} catch (error) {
		await Enrollment.deleteOne({ _id: enrollment._id });
		throw error;
	}

	if (status === "pending") {
		await createNotificationBestEffort({
			recipient_id: course.created_by,
			type: "enrollment",
			title: "Có yêu cầu đăng ký mới",
			message: `Một học viên vừa gửi yêu cầu tham gia khóa học "${course.title}".`,
			link: `/lesson-management?course_id=${courseId}`,
			metadata: { action: "review_enrollment", course_id: courseId, enrollment_id: enrollment._id },
		}, `enrollment:${enrollment._id}:pending`);
	} else {
		await createNotificationBestEffort({
			recipient_id: studentId,
			type: "enrollment",
			title: "Đăng ký khóa học thành công",
			message: `Bạn đã được ghi danh vào khóa học "${course.title}".`,
			link: `/lesson-detail?course_id=${courseId}`,
			metadata: { action: "start_learning", course_id: courseId, enrollment_id: enrollment._id },
		}, `enrollment:${enrollment._id}:open`);
	}

	return enrollment;
};


export const unenrollCourse = async (courseId, studentId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const [enrollment, course] = await Promise.all([
		Enrollment.findOne({ user_id: studentId, course_id: courseId }),
		Course.findOne({ _id: courseId, is_deleted: false }).select("title created_by"),
	]);
    if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

	const activeAttempt = await QuizAttempt.exists({
		user_id: studentId,
		course_id: courseId,
		status: "in_progress",
		expires_at: { $gt: new Date() },
	});
	if (activeAttempt) throw new Error("ACTIVE_QUIZ_ATTEMPT_EXISTS");

	await enrollment.deleteOne();
	if (course?.created_by) {
		await createNotificationBestEffort({
			recipient_id: course.created_by,
			type: "enrollment",
			title: "Học viên đã rời khóa học",
			message: `Một học viên đã hủy đăng ký khóa học "${course.title}".`,
			link: `/lesson-management?course_id=${courseId}`,
			metadata: {
				action: "view_enrollments",
				course_id: courseId,
				enrollment_id: enrollment._id,
				student_id: studentId,
			},
		}, `enrollment:${enrollment._id}:student-left`);
	}

    return { message: "Hủy đăng ký khóa học thành công." };
};


export const getMyCourses = async (studentId) => {
	const pendingCourseIds = await Enrollment.distinct("course_id", {
		user_id: studentId,
		status: "pending",
	});
	if (pendingCourseIds.length > 0) {
		const openCourseIds = await Course.distinct("_id", {
			_id: { $in: pendingCourseIds },
			is_deleted: false,
			enrollment_type: "open",
		});
		if (openCourseIds.length > 0) {
			await Enrollment.updateMany(
				{
					user_id: studentId,
					course_id: { $in: openCourseIds },
					status: "pending",
				},
				{
					$set: {
						status: "active",
						approved_at: new Date(),
					},
				},
			);
		}
	}

	const enrollments = await Enrollment.find({ user_id: studentId })
		.populate({
			path: "course_id",
			match: { is_deleted: false },
			populate: {
				path: "created_by",
				match: { role: "tutor", account_status: "active" },
				select: "full_name role account_status",
			},
		})
		.sort({ requested_at: -1 });

	return enrollments.filter(
		(enrollment) => enrollment.course_id !== null && enrollment.course_id.created_by !== null,
	);
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

	if (userRole !== "tutor" || course.created_by.toString() !== userId.toString()) {
		throw new Error("FORBIDDEN_COURSE_ACTION");
	}

	const enrollment = await Enrollment.findOneAndUpdate(
		{ _id: enrollmentId, course_id: courseId, status: "pending" },
		{ $set: { status: "active", approved_at: new Date() } },
		{ new: true, runValidators: true },
	);
	if (!enrollment) {
		const currentEnrollment = await Enrollment.findOne({ _id: enrollmentId, course_id: courseId })
			.select("status");
		if (!currentEnrollment) throw new Error("ENROLLMENT_NOT_FOUND");
		if (currentEnrollment.status === "active") throw new Error("ENROLLMENT_ALREADY_ACTIVE");
		throw new Error("ENROLLMENT_STATE_CHANGED");
	}

	await enrollment.populate("user_id", "full_name email role");

	await createNotificationBestEffort({
		recipient_id: enrollment.user_id._id ?? enrollment.user_id,
		type: "enrollment",
		title: "Yêu cầu đăng ký đã được duyệt",
		message: `Bạn đã được duyệt vào khóa học "${course.title}".`,
		link: `/lesson-detail?course_id=${courseId}`,
		metadata: { action: "start_learning", course_id: courseId, enrollment_id: enrollment._id },
	}, `enrollment:${enrollment._id}:approved`);

	return enrollment;
};


export const removeEnrollment = async (courseId, enrollmentId, userId, userRole) => {
	if (!mongoose.Types.ObjectId.isValid(courseId)) throw new Error("INVALID_COURSE_ID");
	if (!mongoose.Types.ObjectId.isValid(enrollmentId)) throw new Error("INVALID_ENROLLMENT_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
    if (!course) throw new Error("COURSE_NOT_FOUND");

	if (userRole !== "tutor" || course.created_by.toString() !== userId.toString()) {
		throw new Error("FORBIDDEN_COURSE_ACTION");
	}

	const enrollment = await Enrollment.findOne({
		_id: enrollmentId,
		course_id: courseId,
	});
	if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");

	if (enrollment.status === "active") {
		const activeAttempt = await QuizAttempt.exists({
			user_id: enrollment.user_id,
			course_id: courseId,
			status: "in_progress",
			expires_at: { $gt: new Date() },
		});
		if (activeAttempt) throw new Error("ACTIVE_QUIZ_ATTEMPT_EXISTS");
	}

	const removedEnrollment = await Enrollment.findOneAndDelete({
		_id: enrollmentId,
		course_id: courseId,
		status: enrollment.status,
	});
	if (!removedEnrollment) throw new Error("ENROLLMENT_STATE_CHANGED");

	const studentId = enrollment.user_id;
	const wasPending = enrollment.status === "pending";

	await createNotificationBestEffort({
		recipient_id: studentId,
		type: "enrollment",
		title: wasPending ? "Yêu cầu đăng ký bị từ chối" : "Bạn đã được xóa khỏi khóa học",
		message: wasPending
			? `Yêu cầu tham gia khóa học "${course.title}" của bạn chưa được chấp nhận.`
			: `Giảng viên đã xóa bạn khỏi khóa học "${course.title}".`,
		link: `/my-courses`,
		metadata: {
			action: "view_my_courses",
			course_id: courseId,
			enrollment_id: enrollmentId,
			previous_status: enrollment.status,
		},
	}, `enrollment:${enrollmentId}:${wasPending ? "rejected" : "removed"}`);

	return {
		message: wasPending
			? "Đã từ chối yêu cầu đăng ký."
			: "Đã xóa học viên khỏi khóa học.",
		removed_status: enrollment.status,
	};
};
