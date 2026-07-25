import express from "express";
import { handleSignup, handleLogin, handleGetMe, handleForgotPassword, handleResetPassword, handleLogout } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
	forgotPasswordRateLimit,
	loginRateLimit,
	registerRateLimit,
	resetPasswordRateLimit,
} from "../middleware/auth-rate-limit.middleware.js";

const router = express.Router();

router.post("/register", registerRateLimit, handleSignup);
router.post("/login", loginRateLimit, handleLogin);
router.get("/me", protect, handleGetMe);
router.post("/logout", handleLogout);
router.post("/forgot-password", forgotPasswordRateLimit, handleForgotPassword);
router.patch("/reset-password/:token", resetPasswordRateLimit, handleResetPassword);

export default router;
