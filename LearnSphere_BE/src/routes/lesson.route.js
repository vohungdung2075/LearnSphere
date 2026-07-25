import express from "express";
import { handleGetLessonById, handleUpdateLesson, handleDeleteLesson, handleCompleteLesson, handleIndexLessonForAI } from "../controllers/lesson.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { aiRateLimit } from "../middleware/ai-rate-limit.middleware.js";

const router = express.Router();

router.get("/:lesson_id", protect, handleGetLessonById);
router.post("/:lesson_id/complete", protect, authorize("student"), handleCompleteLesson);
router.post("/:lesson_id/ai-index", protect, authorize("tutor"), aiRateLimit, handleIndexLessonForAI);

router.put("/:lesson_id", protect, authorize("tutor"), handleUpdateLesson);
router.delete("/:lesson_id", protect, authorize("tutor"), handleDeleteLesson);

export default router;
