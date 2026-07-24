import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import courseRoutes from "./routes/course.route.js";
import userRoutes from "./routes/user.route.js";
import lessonRoutes from "./routes/lesson.route.js";
import quizRoutes from "./routes/quiz.route.js";
import quizAttemptRoutes from "./routes/quiz-attempt.route.js";
import fileRoutes from "./routes/file.route.js";
import statsRoutes from "./routes/stats.route.js";
import notificationRoutes from "./routes/notification.route.js";
import aiRoutes from "./routes/ai.route.js";
import { trackApiRequest } from "./middleware/request-metrics.middleware.js";

const app = express();

if (process.env.TRUST_PROXY?.toLowerCase() === "true") {
	app.set("trust proxy", 1);
}

const configuredOrigins = (process.env.FRONTEND_URL ?? "")
	.split(",")
	.map((origin) => origin.trim().replace(/\/$/, ""))
	.filter(Boolean);
const allowedOrigins = new Set(
	configuredOrigins.length
		? configuredOrigins
		: process.env.NODE_ENV === "production"
			? []
			: ["http://localhost:5173"],
);

app.use(helmet({
	crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
	credentials: true,
	origin(origin, callback) {
		if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
			return callback(null, true);
		}
		const error = new Error("CORS_ORIGIN_NOT_ALLOWED");
		error.status = 403;
		return callback(error);
	},
}));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(trackApiRequest);

app.get("/", (req, res) => {
	res.json({ message: "LearnSphere Platform API is running" });
});

app.get("/health/live", (req, res) => {
	res.json({ status: "ok" });
});

app.get("/health/ready", (req, res) => {
	const databaseReady = mongoose.connection.readyState === 1;
	return res.status(databaseReady ? 200 : 503).json({
		status: databaseReady ? "ready" : "not_ready",
		database: databaseReady ? "connected" : "disconnected",
	});
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/quiz-attempts", quizAttemptRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);

app.use((req, res) => res.status(404).json({
	message: "Route not found",
	code: "ROUTE_NOT_FOUND",
}));

app.use((error, req, res, next) => {
	if (res.headersSent) return next(error);

	const status = Number.isInteger(error?.status) ? error.status : 500;
	if (status >= 500) {
		console.error("Unhandled request error:", error);
	}
	return res.status(status).json({
		message: status === 500 ? "Internal server error" : error.message,
		code: error.message === "CORS_ORIGIN_NOT_ALLOWED" ? "CORS_ORIGIN_NOT_ALLOWED" : "REQUEST_FAILED",
	});
});

export default app;
