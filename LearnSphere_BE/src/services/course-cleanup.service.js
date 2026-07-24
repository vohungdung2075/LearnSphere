import mongoose from "mongoose";
import AIMessage from "../models/AIMessage.model.js";
import Course from "../models/Course.model.js";
import CourseDiscussion from "../models/CourseDiscussion.model.js";
import Enrollment from "../models/Enrollment.model.js";
import Lesson from "../models/Lesson.model.js";
import LessonProgress from "../models/LessonProgress.model.js";
import Quiz from "../models/Quiz.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";
import { processPendingS3CleanupTasks, processS3CleanupTask, queueCoursePrefixCleanup } from "./s3-cleanup-task.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let cleanupRunning = false;

const readNonNegativeInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const purgeCourse = async (course) => {
	if (!course.is_deleted) throw new Error("COURSE_MUST_BE_DELETED_FIRST");

	const session = await mongoose.startSession();
	let cleanupTask;
	let deletedRecords;
	try {
		await session.withTransaction(async () => {
			const courseToDelete = await Course.findOne({ _id: course._id, is_deleted: true }).session(session);
			if (!courseToDelete) throw new Error("DELETED_COURSE_NOT_FOUND");

			cleanupTask = await queueCoursePrefixCleanup(courseToDelete._id, session);
			// MongoDB does not support parallel operations inside one transaction.
			const enrollments = await Enrollment.deleteMany({ course_id: courseToDelete._id }, { session });
			const lessons = await Lesson.deleteMany({ course_id: courseToDelete._id }, { session });
			const lessonProgress = await LessonProgress.deleteMany({ course_id: courseToDelete._id }, { session });
			const quizzes = await Quiz.deleteMany({ course_id: courseToDelete._id }, { session });
			const attempts = await QuizAttempt.deleteMany({ course_id: courseToDelete._id }, { session });
			const discussions = await CourseDiscussion.deleteMany({ course_id: courseToDelete._id }, { session });
			const aiMessages = await AIMessage.deleteMany({ course_id: courseToDelete._id }, { session });
			await Course.deleteOne({ _id: courseToDelete._id }, { session });
			deletedRecords = {
				enrollments: enrollments.deletedCount,
				lessons: lessons.deletedCount,
				lesson_progress: lessonProgress.deletedCount,
				quizzes: quizzes.deletedCount,
				quiz_attempts: attempts.deletedCount,
				discussions: discussions.deletedCount,
				ai_messages: aiMessages.deletedCount,
			};
		});
	} finally {
		await session.endSession();
	}

	const s3Result = await processS3CleanupTask(cleanupTask._id);
	return {
		course_id: course._id,
		deleted_s3_objects: s3Result.deleted_count,
		s3_cleanup_pending: s3Result.pending,
		deleted_records: deletedRecords,
	};
};

export const permanentlyDeleteCourse = async (courseId, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");
	const course = await Course.findOne({ _id: courseId, is_deleted: true });
	if (!course) throw new Error("DELETED_COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "admin" && !isOwner) throw new Error("FORBIDDEN_COURSE_ACTION");

	return purgeCourse(course);
};

export const purgeExpiredDeletedCourses = async () => {
	if (cleanupRunning) return { skipped: true, purged_count: 0 };
	cleanupRunning = true;

	try {
		const retentionDays = readNonNegativeInteger(process.env.COURSE_TRASH_RETENTION_DAYS, 30);
		const batchSize = Math.max(1, readNonNegativeInteger(process.env.COURSE_CLEANUP_BATCH_SIZE, 20));
		const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
		const courses = await Course.find({
			is_deleted: true,
			deleted_at: { $ne: null, $lte: cutoff },
		})
			.sort({ deleted_at: 1 })
			.limit(batchSize);

		let purgedCount = 0;
		for (const course of courses) {
			try {
				await purgeCourse(course);
				purgedCount += 1;
			} catch (error) {
				console.error(`Course cleanup failed for ${course._id}:`, error.message);
			}
		}

		return { skipped: false, purged_count: purgedCount };
	} finally {
		cleanupRunning = false;
	}
};

export const startCourseCleanupScheduler = () => {
	const courseCleanupEnabled = process.env.COURSE_CLEANUP_ENABLED?.toLowerCase() === "true";
	const courseIntervalMinutes = Math.max(
		5,
		readNonNegativeInteger(process.env.COURSE_CLEANUP_INTERVAL_MINUTES, 360),
	);
	const fileIntervalMinutes = Math.max(
		1,
		readNonNegativeInteger(process.env.S3_CLEANUP_INTERVAL_MINUTES, 5),
	);
	const intervalMinutes = courseCleanupEnabled
		? Math.min(courseIntervalMinutes, fileIntervalMinutes)
		: fileIntervalMinutes;

	const runCleanupCycle = async () => {
		await processPendingS3CleanupTasks();
		if (courseCleanupEnabled) await purgeExpiredDeletedCourses();
	};

	void runCleanupCycle().catch((error) => console.error("Cleanup scheduler failed:", error.message));
	const timer = setInterval(() => {
		void runCleanupCycle().catch((error) => console.error("Cleanup scheduler failed:", error.message));
	}, intervalMinutes * 60 * 1000);
	timer.unref();
	return timer;
};
