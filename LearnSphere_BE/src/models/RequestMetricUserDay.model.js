import mongoose from "mongoose";

const RequestMetricUserDaySchema = new mongoose.Schema(
	{
		date: {
			type: String,
			required: true,
			index: true,
		},
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

RequestMetricUserDaySchema.index({ date: 1, user_id: 1 }, { unique: true });

const RequestMetricUserDay = mongoose.model("RequestMetricUserDay", RequestMetricUserDaySchema);
export default RequestMetricUserDay;
