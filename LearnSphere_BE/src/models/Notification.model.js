import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
	{
		recipient_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: ["enrollment", "account", "system"],
			default: "system",
		},
		title: {
			type: String,
			required: true,
			trim: true,
			maxlength: 120,
		},
		message: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
		link: {
			type: String,
			default: "",
			trim: true,
		},
		read_at: {
			type: Date,
			default: null,
		},
		metadata: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
	},
	{ timestamps: true },
);

notificationSchema.index({ recipient_id: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
