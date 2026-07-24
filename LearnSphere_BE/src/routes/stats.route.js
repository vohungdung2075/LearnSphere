import express from "express";
import { handleGetSystemStats, handleGetTutorDashboardStats } from "../controllers/stats.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/tutor-dashboard", protect, authorize("tutor"), handleGetTutorDashboardStats);
router.get("/", protect, authorize("admin"), handleGetSystemStats);

export default router;
