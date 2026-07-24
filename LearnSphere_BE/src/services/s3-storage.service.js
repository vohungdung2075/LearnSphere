import mongoose from "mongoose";
import {
	DeleteObjectsCommand,
	paginateListObjectsV2,
} from "@aws-sdk/client-s3";

import s3Client from "../config/s3.js";

const getS3Bucket = () => {
	if (!process.env.AWS_S3_BUCKET) throw new Error("S3_NOT_CONFIGURED");
	return process.env.AWS_S3_BUCKET;
};

const throwIfDeleteFailed = (response) => {
	if (response.Errors?.length) {
		const failedKeys = response.Errors.map((item) => item.Key).filter(Boolean);
		const error = new Error("S3_DELETE_FAILED");
		error.failedKeys = failedKeys;
		throw error;
	}
};

export const deleteS3Objects = async (fileKeys = []) => {
	const keys = [...new Set(fileKeys.filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim()))];
	if (!keys.length) return { deleted_count: 0 };

	try {
		let deletedCount = 0;
		for (let index = 0; index < keys.length; index += 1000) {
			const chunk = keys.slice(index, index + 1000);
			const response = await s3Client.send(new DeleteObjectsCommand({
				Bucket: getS3Bucket(),
				Delete: {
					Objects: chunk.map((Key) => ({ Key })),
					Quiet: true,
				},
			}));
			throwIfDeleteFailed(response);
			deletedCount += chunk.length;
		}
		return { deleted_count: deletedCount };
	} catch (error) {
		if (error.message === "S3_DELETE_FAILED" || error.message === "S3_NOT_CONFIGURED") throw error;
		const wrappedError = new Error("S3_DELETE_FAILED");
		wrappedError.cause = error;
		throw wrappedError;
	}
};

export const deleteCourseS3Prefix = async (courseId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");
	const prefix = `courses/${courseId}/`;
	let deletedCount = 0;

	try {
		const paginator = paginateListObjectsV2(
			{ client: s3Client },
			{ Bucket: getS3Bucket(), Prefix: prefix },
		);

		for await (const page of paginator) {
			const keys = (page.Contents ?? [])
				.map((object) => object.Key)
				.filter((key) => typeof key === "string" && key.startsWith(prefix));
			if (!keys.length) continue;

			const response = await s3Client.send(new DeleteObjectsCommand({
				Bucket: getS3Bucket(),
				Delete: {
					Objects: keys.map((Key) => ({ Key })),
					Quiet: true,
				},
			}));
			throwIfDeleteFailed(response);
			deletedCount += keys.length;
		}

		return { deleted_count: deletedCount, prefix };
	} catch (error) {
		if (error.message === "S3_DELETE_FAILED" || error.message === "S3_NOT_CONFIGURED") throw error;
		const wrappedError = new Error("S3_DELETE_FAILED");
		wrappedError.cause = error;
		throw wrappedError;
	}
};
