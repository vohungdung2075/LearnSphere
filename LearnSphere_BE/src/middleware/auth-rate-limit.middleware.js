import { rateLimit } from "express-rate-limit";

const createAuthRateLimit = ({ windowMs, limit }) => rateLimit({
	windowMs,
	limit,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	handler: (req, res, next, options) => res.status(options.statusCode).json({
		message: "Too many authentication requests. Please try again later.",
		code: "AUTH_RATE_LIMITED",
	}),
});

export const loginRateLimit = createAuthRateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
});

export const registerRateLimit = createAuthRateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 5,
});

export const forgotPasswordRateLimit = createAuthRateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 5,
});

export const resetPasswordRateLimit = createAuthRateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10,
});
