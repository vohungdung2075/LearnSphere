import RequestMetric from "../models/RequestMetric.model.js";
import RequestMetricUserDay from "../models/RequestMetricUserDay.model.js";

const getUtcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const persistMetric = async ({ date, durationMs, failed, userId }) => {
	const update = {
		$inc: {
			total_requests: 1,
			failed_requests: failed ? 1 : 0,
			total_duration_ms: durationMs,
		},
	};

	try {
		try {
			await RequestMetric.updateOne({ date }, update, { upsert: true });
		} catch (error) {
			if (error?.code !== 11000) throw error;
			await RequestMetric.updateOne({ date }, update);
		}

		if (userId) try {
			await RequestMetricUserDay.updateOne(
				{ date, user_id: userId },
				{ $setOnInsert: { date, user_id: userId } },
				{ upsert: true },
			);
		} catch (error) {
			// A concurrent first request may win the unique (date, user) insert.
			if (error?.code !== 11000) throw error;
		}
	} catch (error) {
		console.error("Request metric persistence error:", error);
	}
};

export const trackApiRequest = (req, res, next) => {
	if (!req.originalUrl.startsWith("/api/")) {
		return next();
	}

	const startedAt = process.hrtime.bigint();

	res.once("finish", () => {
		const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
		const durationMs = Math.max(0, Math.round(Number(elapsedNanoseconds) / 1_000_000));

		void persistMetric({
			date: getUtcDateKey(),
			durationMs,
			failed: res.statusCode >= 400,
			userId: req.user?._id,
		});
	});

	return next();
};
