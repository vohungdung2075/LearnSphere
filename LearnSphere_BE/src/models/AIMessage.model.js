import mongoose from "mongoose";

const AIMessageSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		course_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Course",
			default: null,
			index: true,
		},
		lesson_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Lesson",
			default: null,
			index: true,
		},
		user_message: {
			type: String,
			required: true,
		},
		ai_response: {
			type: String,
			required: true,
		},
		model_id: {
			type: String,
			required: true,
			trim: true,
		},
		input_tokens: {
			type: Number,
			default: 0,
			min: 0,
		},
		output_tokens: {
			type: Number,
			default: 0,
			min: 0,
		},
		total_tokens: {
			type: Number,
			default: 0,
			min: 0,
		},
		stop_reason: {
			type: String,
			default: "",
			trim: true,
		},
	},
	{ timestamps: true },
);

AIMessageSchema.index({ user_id: 1, course_id: 1, lesson_id: 1, createdAt: -1 });

const AIMessage = mongoose.model("AIMessage", AIMessageSchema);
export default AIMessage;
