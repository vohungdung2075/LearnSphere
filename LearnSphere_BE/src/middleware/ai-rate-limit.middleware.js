const userBuckets = new Map();

const readPositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const aiRateLimit = (req, res, next) => {
	const limit = readPositiveInteger(process.env.AI_RATE_LIMIT_REQUESTS, 10);
	const windowMs = readPositiveInteger(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000);
	const now = Date.now();
	const userId = req.user?._id?.toString();

	if (!userId) {
		return res.status(401).json({ message: "Unauthorized", code: "UNAUTHORIZED" });
	}

	let bucket = userBuckets.get(userId);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: now + windowMs };
	}

	const remaining = Math.max(0, limit - bucket.count);
	res.setHeader("X-RateLimit-Limit", String(limit));
	res.setHeader("X-RateLimit-Remaining", String(remaining));
	res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

	if (bucket.count >= limit) {
		const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
		res.setHeader("Retry-After", String(retryAfterSeconds));
		return res.status(429).json({
			message: `AI request limit reached. Try again in ${retryAfterSeconds} seconds`,
			code: "AI_RATE_LIMITED",
			retry_after_seconds: retryAfterSeconds,
		});
	}

	bucket.count += 1;
	userBuckets.set(userId, bucket);
	res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));

	if (userBuckets.size > 10_000) {
		for (const [key, value] of userBuckets) {
			if (value.resetAt <= now) userBuckets.delete(key);
		}
	}

	next();
};
