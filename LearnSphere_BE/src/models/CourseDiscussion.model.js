import mongoose from "mongoose";

const CourseDiscussionSchema = new mongoose.Schema(
	{
		course_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Course",
			required: true,
			index: true,
		},
		author_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 2000,
		},
		replies: [
			{
				author_id: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				content: {
					type: String,
					required: true,
					trim: true,
					maxlength: 2000,
				},
				created_at: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{ timestamps: true },
);

CourseDiscussionSchema.index({ course_id: 1, createdAt: -1 });

const CourseDiscussion = mongoose.model("CourseDiscussion", CourseDiscussionSchema);
export default CourseDiscussion;
