import mongoose from "mongoose";
import AIMessage from "../models/AIMessage.model.js";
import Course from "../models/Course.model.js";
import CourseDiscussion from "../models/CourseDiscussion.model.js";
import Enrollment from "../models/Enrollment.model.js";
import Lesson from "../models/Lesson.model.js";
import LessonProgress from "../models/LessonProgress.model.js";
import Quiz from "../models/Quiz.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";
import { deleteCourseS3Prefix } from "./file.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let cleanupRunning = false;

const readNonNegativeInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const purgeCourse = async (course) => {
	if (!course.is_deleted) throw new Error("COURSE_MUST_BE_DELETED_FIRST");

	const s3Result = await deleteCourseS3Prefix(course._id);
	const [enrollments, lessons, lessonProgress, quizzes, attempts, discussions, aiMessages] = await Promise.all([
		Enrollment.deleteMany({ course_id: course._id }),
		Lesson.deleteMany({ course_id: course._id }),
		LessonProgress.deleteMany({ course_id: course._id }),
		Quiz.deleteMany({ course_id: course._id }),
		QuizAttempt.deleteMany({ course_id: course._id }),
		CourseDiscussion.deleteMany({ course_id: course._id }),
		AIMessage.deleteMany({ course_id: course._id }),
	]);

	await course.deleteOne();
	return {
		course_id: course._id,
		deleted_s3_objects: s3Result.deleted_count,
		deleted_records: {
			enrollments: enrollments.deletedCount,
			lessons: lessons.deletedCount,
			lesson_progress: lessonProgress.deletedCount,
			quizzes: quizzes.deletedCount,
			quiz_attempts: attempts.deletedCount,
			discussions: discussions.deletedCount,
			ai_messages: aiMessages.deletedCount,
		},
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
	if (process.env.COURSE_CLEANUP_ENABLED?.toLowerCase() !== "true") return null;
	const intervalMinutes = Math.max(
		5,
		readNonNegativeInteger(process.env.COURSE_CLEANUP_INTERVAL_MINUTES, 360),
	);

	void purgeExpiredDeletedCourses();
	const timer = setInterval(() => {
		void purgeExpiredDeletedCourses();
	}, intervalMinutes * 60 * 1000);
	timer.unref();
	return timer;
};
