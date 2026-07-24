import AIRateLimitBucket from "../models/AIRateLimitBucket.model.js";

const readPositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const aiRateLimit = async (req, res, next) => {
	const limit = readPositiveInteger(process.env.AI_RATE_LIMIT_REQUESTS, 10);
	const windowMs = readPositiveInteger(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000);
	const now = Date.now();
	const userId = req.user?._id;

	if (!userId) {
		return res.status(401).json({ message: "Unauthorized", code: "UNAUTHORIZED" });
	}

	const windowStart = Math.floor(now / windowMs) * windowMs;
	const resetAt = windowStart + windowMs;
	const windowKey = `${windowStart}:${windowMs}`;
	res.setHeader("X-RateLimit-Limit", String(limit));
	res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

	try {
		const bucket = await AIRateLimitBucket.findOneAndUpdate(
			{ user_id: userId, window_key: windowKey, count: { $lt: limit } },
			{
				$inc: { count: 1 },
				$setOnInsert: {
					expires_at: new Date(resetAt + windowMs),
				},
			},
			{ new: true, upsert: true, runValidators: true },
		);
		res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
		return next();
	} catch (error) {
		if (error?.code !== 11000) {
			console.error("AI rate limit persistence failed:", error);
			return res.status(503).json({
				message: "AI request protection is temporarily unavailable",
				code: "AI_RATE_LIMIT_UNAVAILABLE",
			});
		}

		// Two first requests can race while creating the same fixed-window bucket.
		// Retry as an update; a null result now truly means that the limit is full.
		const racedBucket = await AIRateLimitBucket.findOneAndUpdate(
			{ user_id: userId, window_key: windowKey, count: { $lt: limit } },
			{ $inc: { count: 1 } },
			{ new: true, runValidators: true },
		);
		if (racedBucket) {
			res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - racedBucket.count)));
			return next();
		}

		const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
		res.setHeader("Retry-After", String(retryAfterSeconds));
		res.setHeader("X-RateLimit-Remaining", "0");
		return res.status(429).json({
			message: `AI request limit reached. Try again in ${retryAfterSeconds} seconds`,
			code: "AI_RATE_LIMITED",
			retry_after_seconds: retryAfterSeconds,
		});
	}
};
