import S3CleanupTask from "../models/S3CleanupTask.model.js";
import { deleteCourseS3Prefix, deleteS3Objects } from "./file.service.js";

const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

const normalizeKeys = (keys = []) => [...new Set(keys.filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim()))];

export const queueS3ObjectsCleanup = async (objectKeys, session) => {
	const keys = normalizeKeys(objectKeys);
	if (!keys.length) return null;

	const [task] = await S3CleanupTask.create(
		[{ cleanup_type: "objects", object_keys: keys }],
		{ session },
	);
	return task;
};

export const queueCoursePrefixCleanup = async (courseId, session) => {
	const [task] = await S3CleanupTask.create(
		[{ cleanup_type: "course_prefix", course_id: courseId.toString() }],
		{ session },
	);
	return task;
};

const claimTask = async (taskId) => {
	const now = new Date();
	const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
	const retryableState = {
		$or: [
			{ status: { $in: ["pending", "failed"] }, next_attempt_at: { $lte: now } },
			{ status: "processing", locked_at: { $lte: staleBefore } },
		],
	};

	return S3CleanupTask.findOneAndUpdate(
		{ ...(taskId ? { _id: taskId } : {}), ...retryableState },
		{
			$set: { status: "processing", locked_at: now, last_error: "" },
			$inc: { attempts: 1 },
		},
		{ new: true, sort: { next_attempt_at: 1 } },
	);
};

export const processS3CleanupTask = async (taskId) => {
	const task = await claimTask(taskId);
	if (!task) return { processed: false, pending: true, deleted_count: 0 };

	try {
		const result = task.cleanup_type === "course_prefix"
			? await deleteCourseS3Prefix(task.course_id)
			: await deleteS3Objects(task.object_keys);
		await S3CleanupTask.deleteOne({ _id: task._id });
		return { processed: true, pending: false, deleted_count: result.deleted_count };
	} catch (error) {
		const retryDelay = Math.min(MAX_RETRY_DELAY_MS, 30_000 * (2 ** Math.min(task.attempts - 1, 8)));
		await S3CleanupTask.updateOne(
			{ _id: task._id },
			{
				$set: {
					status: "failed",
					locked_at: null,
					last_error: String(error.message || error).slice(0, 1000),
					next_attempt_at: new Date(Date.now() + retryDelay),
				},
			},
		);
		console.error(`S3 cleanup task ${task._id} failed; retry scheduled:`, error.message);
		return { processed: true, pending: true, deleted_count: 0 };
	}
};

export const processPendingS3CleanupTasks = async (limit = 20) => {
	let processed = 0;
	let pending = 0;

	for (let index = 0; index < limit; index += 1) {
		const result = await processS3CleanupTask();
		if (!result.processed) break;
		processed += 1;
		if (result.pending) pending += 1;
	}

	return { processed, pending };
};
