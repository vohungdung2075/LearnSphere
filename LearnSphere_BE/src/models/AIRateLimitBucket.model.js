import mongoose from "mongoose";

const AIRateLimitBucketSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		window_key: {
			type: String,
			required: true,
		},
		count: {
			type: Number,
			default: 0,
			min: 0,
		},
		expires_at: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: true },
);

AIRateLimitBucketSchema.index({ user_id: 1, window_key: 1 }, { unique: true });
AIRateLimitBucketSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const AIRateLimitBucket = mongoose.model("AIRateLimitBucket", AIRateLimitBucketSchema);
export default AIRateLimitBucket;
