import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: "",
		},
		thumbnail_key: {
			type: String,
			default: "",
			trim: true,
		},
		enrollment_type: {
			type: String,
			enum: ["open", "approval_required"],
			required: true,
		},
		created_by: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		is_deleted: {
			type: Boolean,
			default: false,
			index: true,
		},
		deleted_at: {
			type: Date,
			default: null,
		},
		deleted_by: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		deleted_reason: {
			type: String,
			default: "",
			trim: true,
			maxlength: 500,
		},
	},
	{ timestamps: true },
);

const Course = mongoose.model("Course", CourseSchema);
export default Course;
