import mongoose from "mongoose";

const UploadSessionSchema = new mongoose.Schema(
	{
		owner_id: {
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
		folder: {
			type: String,
			required: true,
		},
		file_key: {
			type: String,
			required: true,
			unique: true,
		},
		content_type: {
			type: String,
			required: true,
		},
		file_size: {
			type: Number,
			required: true,
			min: 1,
		},
		upload_mode: {
			type: String,
			enum: ["single", "multipart"],
			required: true,
		},
		multipart_upload_id: {
			type: String,
			default: "",
			select: false,
		},
		part_size: {
			type: Number,
			default: 0,
			min: 0,
		},
		status: {
			type: String,
			enum: ["pending", "uploaded", "processing", "failed"],
			default: "pending",
			index: true,
		},
		expires_at: {
			type: Date,
			required: true,
			index: true,
		},
		locked_at: {
			type: Date,
			default: null,
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
	},
	{ timestamps: true },
);

UploadSessionSchema.index({ status: 1, expires_at: 1 });

const UploadSession = mongoose.model("UploadSession", UploadSessionSchema);
export default UploadSession;
