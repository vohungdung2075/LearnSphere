import mongoose from "mongoose";
import Course from "../models/Course.model.js";
import Enrollment from "../models/Enrollment.model.js";
import Lesson from "../models/Lesson.model.js";
import LessonProgress from "../models/LessonProgress.model.js";
import Quiz from "../models/Quiz.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";

const toId = (value) => value?.toString?.() ?? String(value ?? "");

const calculateScorePercent = (score, totalScore) => (
	Number(totalScore) > 0
		? Math.round((Number(score) / Number(totalScore)) * 100)
		: 0
);

export const getStudentLearningReport = async (courseId, enrollmentId, requesterId, requesterRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");
	if (!mongoose.isValidObjectId(enrollmentId)) throw new Error("INVALID_ENROLLMENT_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false })
		.select("title created_by");
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = toId(course.created_by) === toId(requesterId);
	if (requesterRole !== "admin" && (requesterRole !== "tutor" || !isOwner)) {
		throw new Error("FORBIDDEN_COURSE_ACTION");
	}

	const enrollment = await Enrollment.findOne({
		_id: enrollmentId,
		course_id: courseId,
		status: "active",
	}).populate("user_id", "full_name email role");
	if (!enrollment || !enrollment.user_id) throw new Error("ENROLLMENT_NOT_FOUND");

	const studentId = enrollment.user_id._id;
	await QuizAttempt.updateMany(
		{
			user_id: studentId,
			course_id: courseId,
			status: "in_progress",
			expires_at: { $lte: new Date() },
		},
		{ $set: { status: "expired" } },
	);

	const [lessons, completedProgress, quizzes, attempts] = await Promise.all([
		Lesson.find({ course_id: courseId })
			.select("title order_index")
			.sort({ order_index: 1 })
			.lean(),
		LessonProgress.find({
			user_id: studentId,
			course_id: courseId,
			is_completed: true,
		})
			.select("lesson_id completed_at")
			.lean(),
		Quiz.find({ course_id: courseId })
			.select("title difficulty")
			.lean(),
		QuizAttempt.find({ user_id: studentId, course_id: courseId })
			.select("+question_snapshot")
			.sort({ started_at: -1 })
			.lean(),
	]);

	const completedByLessonId = new Map(
		completedProgress.map((progress) => [toId(progress.lesson_id), progress]),
	);
	const completedLessons = lessons.filter((lesson) => completedByLessonId.has(toId(lesson._id))).length;
	const lessonProgressPercent = lessons.length > 0
		? Math.round((completedLessons / lessons.length) * 100)
		: 0;

	const quizById = new Map(quizzes.map((quiz) => [toId(quiz._id), quiz]));
	const formattedAttempts = attempts.map((attempt) => {
		const quiz = quizById.get(toId(attempt.quiz_id));
		const questionById = new Map(
			(attempt.question_snapshot ?? []).map((question) => [toId(question._id), question]),
		);

		return {
			attempt_id: attempt._id,
			quiz_id: attempt.quiz_id,
			quiz_title: quiz?.title ?? "Quiz đã bị xóa",
			difficulty: quiz?.difficulty ?? null,
			status: attempt.status,
			score: attempt.score,
			total_score: attempt.total_score,
			score_percent: calculateScorePercent(attempt.score, attempt.total_score),
			correct_answers: attempt.correct_answers,
			total_questions: attempt.total_questions,
			started_at: attempt.started_at,
			submitted_at: attempt.submitted_at,
			duration_seconds: attempt.duration_seconds,
			answers: (attempt.answers ?? []).map((answer) => {
				const question = questionById.get(toId(answer.question_id));
				return {
					question_id: answer.question_id,
					question_content: answer.question_content,
					selected_answers: answer.selected_answers ?? [],
					correct_answers: (question?.answers ?? [])
						.filter((item) => item.is_correct)
						.map((item) => ({ answer_id: item._id, content: item.content })),
					is_correct: answer.is_correct,
					earned_point: answer.earned_point,
					max_point: answer.max_point,
				};
			}),
		};
	});

	const submittedAttempts = formattedAttempts.filter((attempt) => attempt.status === "submitted");
	const attemptedQuizIds = new Set(submittedAttempts.map((attempt) => toId(attempt.quiz_id)));
	const averageScorePercent = submittedAttempts.length > 0
		? Math.round(
			submittedAttempts.reduce((total, attempt) => total + attempt.score_percent, 0)
				/ submittedAttempts.length,
		)
		: 0;
	const bestScorePercent = submittedAttempts.length > 0
		? Math.max(...submittedAttempts.map((attempt) => attempt.score_percent))
		: 0;

	return {
		course: {
			_id: course._id,
			title: course.title,
		},
		student: {
			_id: enrollment.user_id._id,
			full_name: enrollment.user_id.full_name,
			email: enrollment.user_id.email,
		},
		enrollment: {
			_id: enrollment._id,
			status: enrollment.status,
			requested_at: enrollment.requested_at,
			approved_at: enrollment.approved_at,
		},
		lesson_progress: {
			progress_percent: lessonProgressPercent,
			completed_lessons: completedLessons,
			total_lessons: lessons.length,
			lessons: lessons.map((lesson) => {
				const progress = completedByLessonId.get(toId(lesson._id));
				return {
					lesson_id: lesson._id,
					title: lesson.title,
					order_index: lesson.order_index,
					is_completed: Boolean(progress),
					completed_at: progress?.completed_at ?? null,
				};
			}),
		},
		quiz_progress: {
			total_quizzes: quizzes.length,
			attempted_quizzes: attemptedQuizIds.size,
			submitted_attempts: submittedAttempts.length,
			average_score_percent: averageScorePercent,
			best_score_percent: bestScorePercent,
			attempts: formattedAttempts,
		},
	};
};
