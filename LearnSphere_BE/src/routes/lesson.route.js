import express from "express";
import { handleGetLessonById, handleUpdateLesson, handleDeleteLesson, handleCompleteLesson, handleIndexLessonForAI } from "../controllers/lesson.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:lesson_id", protect, handleGetLessonById);
router.post("/:lesson_id/complete", protect, authorize("student"), handleCompleteLesson);
router.post("/:lesson_id/ai-index", protect, authorize("tutor", "admin"), handleIndexLessonForAI);

router.put("/:lesson_id", protect, authorize("tutor", "admin"), handleUpdateLesson);
router.delete("/:lesson_id", protect, authorize("tutor", "admin"), handleDeleteLesson);

export default router;
