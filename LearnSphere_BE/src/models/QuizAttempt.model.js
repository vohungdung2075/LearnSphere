import mongoose from "mongoose";

const SelectedAnswerSchema = new mongoose.Schema(
	{
		answer_id: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
	},
	{ _id: false },
);

const AttemptAnswerSchema = new mongoose.Schema(
	{
		question_id: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		question_content: {
			type: String,
			required: true,
			trim: true,
		},
		selected_answers: {
			type: [SelectedAnswerSchema],
			default: [],
		},
		is_correct: {
			type: Boolean,
			required: true,
		},
		earned_point: {
			type: Number,
			default: 0,
			min: 0,
		},
		max_point: {
			type: Number,
			required: true,
			min: 0,
		},
	},
	{ _id: false },
);

const SnapshotAnswerSchema = new mongoose.Schema(
	{
		_id: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
		is_correct: {
			type: Boolean,
			required: true,
		},
	},
	{ _id: false },
);

const SnapshotQuestionSchema = new mongoose.Schema(
	{
		_id: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
		question_type: {
			type: String,
			enum: ["single_choice", "multiple_choice"],
			required: true,
		},
		point: {
			type: Number,
			required: true,
			min: 0.01,
		},
		answers: {
			type: [SnapshotAnswerSchema],
			required: true,
		},
	},
	{ _id: false },
);

const QuizAttemptSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		quiz_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Quiz",
			required: true,
			index: true,
		},
		course_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Course",
			required: true,
			index: true,
		},
		status: {
			type: String,
			enum: ["in_progress", "submitted", "expired"],
			default: "in_progress",
			required: true,
		},
		started_at: {
			type: Date,
			required: true,
		},
		expires_at: {
			type: Date,
			required: true,
		},
		submitted_at: {
			type: Date,
			default: null,
		},
		duration_seconds: {
			type: Number,
			default: null,
			min: 0,
		},
		score: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
		},
		total_score: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
		},
		correct_answers: {
			type: Number,
			default: 0,
			min: 0,
		},
		total_questions: {
			type: Number,
			default: 0,
			min: 0,
		},
		question_snapshot: {
			type: [SnapshotQuestionSchema],
			default: undefined,
			select: false,
		},
		answers: {
			type: [AttemptAnswerSchema],
			default: [],
		},
	},
	{ timestamps: true },
);

QuizAttemptSchema.index(
	{ user_id: 1, quiz_id: 1, status: 1 },
	{
		name: "unique_active_attempt_per_student_quiz",
		unique: true,
		partialFilterExpression: { status: "in_progress" },
	},
);

const QuizAttempt = mongoose.model("QuizAttempt", QuizAttemptSchema);
export default QuizAttempt;
