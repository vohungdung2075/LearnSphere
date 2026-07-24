import {
	AbortMultipartUploadCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import s3Client from "../config/s3.js";
import Course from "../models/Course.model.js";
import Lesson from "../models/Lesson.model.js";
import UploadSession from "../models/UploadSession.model.js";
import User from "../models/User.model.js";

const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
let cleanupRunning = false;

const readPositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getS3Bucket = () => {
	if (!process.env.AWS_S3_BUCKET) throw new Error("S3_NOT_CONFIGURED");
	return process.env.AWS_S3_BUCKET;
};

const isFileReferenced = async (fileKey) => {
	const [course, lesson, user] = await Promise.all([
		Course.exists({ thumbnail_key: fileKey }),
		Lesson.exists({ $or: [{ video_key: fileKey }, { document_key: fileKey }] }),
		User.exists({ avatar_key: fileKey }),
	]);
	return Boolean(course || lesson || user);
};

export const markUploadAttachedBestEffort = async (fileKeys = [], context = "unspecified") => {
	const keys = [...new Set(fileKeys.filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim()))];
	if (!keys.length) return;
	try {
		// Keep the completed session briefly so confirm/complete retries remain idempotent.
		// The cleanup worker will remove the session after verifying that the file is referenced.
		await UploadSession.updateMany(
			{ file_key: { $in: keys } },
			{
				$set: {
					status: "uploaded",
					locked_at: null,
					last_error: "",
					expires_at: new Date(Date.now() + 60 * 60 * 1000),
				},
			},
		);
	} catch (error) {
		console.error(`Unable to mark upload attached (${context}); reference reconciliation will protect it:`, error.message);
	}
};

const claimExpiredUpload = async () => {
	const now = new Date();
	const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
	return UploadSession.findOneAndUpdate(
		{
			$or: [
				{ status: { $in: ["pending", "uploaded", "failed"] }, expires_at: { $lte: now } },
				{ status: "processing", locked_at: { $lte: staleBefore } },
			],
		},
		{
			$set: { status: "processing", locked_at: now, last_error: "" },
			$inc: { attempts: 1 },
		},
		{ new: true, sort: { expires_at: 1 } },
	).select("+multipart_upload_id");
};

const cleanupUpload = async (session) => {
	if (await isFileReferenced(session.file_key)) {
		await UploadSession.deleteOne({ _id: session._id });
		return { attached: true, deleted: false };
	}

	const Bucket = getS3Bucket();
	if (session.upload_mode === "multipart" && session.multipart_upload_id) {
		try {
			await s3Client.send(new AbortMultipartUploadCommand({
				Bucket,
				Key: session.file_key,
				UploadId: session.multipart_upload_id,
			}));
		} catch (error) {
			if (!["NoSuchUpload", "NotFound"].includes(error.name)) throw error;
		}
	}

	await s3Client.send(new DeleteObjectCommand({ Bucket, Key: session.file_key }));
	await UploadSession.deleteOne({ _id: session._id });
	return { attached: false, deleted: true };
};

export const cleanupExpiredUploads = async (limit = 20) => {
	if (cleanupRunning) return { skipped: true, processed: 0 };
	cleanupRunning = true;
	let processed = 0;
	try {
		for (let index = 0; index < limit; index += 1) {
			const session = await claimExpiredUpload();
			if (!session) break;
			try {
				await cleanupUpload(session);
			} catch (error) {
				const retryDelay = Math.min(MAX_RETRY_DELAY_MS, 30_000 * (2 ** Math.min(session.attempts - 1, 8)));
				await UploadSession.updateOne(
					{ _id: session._id },
					{
						$set: {
							status: "failed",
							locked_at: null,
							last_error: String(error.message || error).slice(0, 1000),
							expires_at: new Date(Date.now() + retryDelay),
						},
					},
				);
				console.error(`Orphan upload cleanup failed for ${session._id}:`, error.message);
			}
			processed += 1;
		}
		return { skipped: false, processed };
	} finally {
		cleanupRunning = false;
	}
};

export const startUploadCleanupScheduler = () => {
	const intervalMinutes = Math.max(
		1,
		readPositiveInteger(process.env.UPLOAD_CLEANUP_INTERVAL_MINUTES, 15),
	);
	const batchSize = readPositiveInteger(process.env.UPLOAD_CLEANUP_BATCH_SIZE, 20);
	const run = () => cleanupExpiredUploads(batchSize)
		.catch((error) => console.error("Upload cleanup scheduler failed:", error.message));

	void run();
	const timer = setInterval(() => void run(), intervalMinutes * 60 * 1000);
	timer.unref();
	return timer;
};
