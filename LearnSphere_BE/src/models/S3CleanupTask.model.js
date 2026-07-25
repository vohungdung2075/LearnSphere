import mongoose from "mongoose";

const S3CleanupTaskSchema = new mongoose.Schema(
	{
		cleanup_type: {
			type: String,
			enum: ["objects", "course_prefix"],
			required: true,
		},
		object_keys: {
			type: [String],
			default: [],
		},
		course_id: {
			type: String,
			default: "",
			trim: true,
		},
		context: {
			type: String,
			default: "unspecified",
			trim: true,
			maxlength: 200,
		},
		status: {
			type: String,
			enum: ["pending", "processing", "failed"],
			default: "pending",
			index: true,
		},
		attempts: {
			type: Number,
			default: 0,
			min: 0,
		},
		last_error: {
			type: String,
			default: "",
		},
		next_attempt_at: {
			type: Date,
			default: Date.now,
			index: true,
		},
		locked_at: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true },
);

S3CleanupTaskSchema.index({ status: 1, next_attempt_at: 1 });

const S3CleanupTask = mongoose.model("S3CleanupTask", S3CleanupTaskSchema);
export default S3CleanupTask;
