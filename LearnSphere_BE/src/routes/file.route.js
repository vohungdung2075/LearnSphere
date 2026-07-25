import express from "express";
import {
	handleCreatePresignedUpload,
	handleCreatePresignedDownload,
	handleGetCourseThumbnail,
	handleCreateProfileAvatarUpload,
	handleGetProfileAvatar,
	handleConfirmUpload,
	handleCreateMultipartUpload,
	handleCompleteMultipartUpload,
	handleAbortUpload,
} from "../controllers/file.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/profile-avatar/presigned-upload", protect, handleCreateProfileAvatarUpload);
router.get("/profile-avatar", protect, handleGetProfileAvatar);
router.post("/presigned-upload", protect, authorize("tutor"), handleCreatePresignedUpload);
router.post("/uploads/:session_id/confirm", protect, handleConfirmUpload);
router.delete("/uploads/:session_id", protect, handleAbortUpload);
router.post("/multipart/start", protect, authorize("tutor"), handleCreateMultipartUpload);
router.post("/multipart/:session_id/complete", protect, authorize("tutor"), handleCompleteMultipartUpload);
router.get("/presigned-download", protect, handleCreatePresignedDownload);
router.get("/course-thumbnail/:course_id", handleGetCourseThumbnail);

export default router;
