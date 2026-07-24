import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createWorker, OEM, PSM } from "tesseract.js";
import vietnameseOCRData from "@tesseract.js-data/vie";
import Course from "../models/Course.model.js";
import Lesson from "../models/Lesson.model.js";
import { downloadS3ObjectBuffer } from "./file.service.js";

const MB = 1024 * 1024;
let activeOCRJobs = 0;

const readPositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeExtractedText = (value) => value
	.replace(/\u0000/g, "")
	.replace(/[ \t]+\n/g, "\n")
	.replace(/\n{3,}/g, "\n\n")
	.trim();

const limitStoredText = (text) => {
	const maxChars = readPositiveInteger(process.env.AI_INDEX_MAX_CHARS, 200000);
	return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[Nội dung đã được cắt bớt do giới hạn lập chỉ mục]` : text;
};

const runBeforeDeadline = async (operation, deadline) => {
	const remainingMs = deadline - Date.now();
	if (remainingMs <= 0) throw new Error("AI_OCR_TIMEOUT");

	let timer;
	try {
		return await Promise.race([
			operation,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error("AI_OCR_TIMEOUT")), remainingMs);
				timer.unref?.();
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
};

const extractScannedPdfText = async (parser, totalPages) => {
	const maxPages = readPositiveInteger(process.env.AI_PDF_OCR_MAX_PAGES, 12);
	const desiredWidth = readPositiveInteger(process.env.AI_PDF_OCR_IMAGE_WIDTH, 1400);
	const timeoutMs = readPositiveInteger(process.env.AI_PDF_OCR_TIMEOUT_MS, 120000);
	const maxConcurrentJobs = readPositiveInteger(process.env.AI_PDF_OCR_MAX_CONCURRENT, 1);
	const pageLimit = Math.min(maxPages, Math.max(1, totalPages || maxPages));
	const deadline = Date.now() + timeoutMs;
	if (activeOCRJobs >= maxConcurrentJobs) throw new Error("AI_OCR_BUSY");
	activeOCRJobs += 1;

	let worker;
	try {
		worker = await runBeforeDeadline(
			createWorker(vietnameseOCRData.code, OEM.LSTM_ONLY, {
				langPath: vietnameseOCRData.langPath,
				gzip: vietnameseOCRData.gzip,
			}),
			deadline,
		);
		await runBeforeDeadline(
			worker.setParameters({
				tessedit_pageseg_mode: PSM.AUTO,
				preserve_interword_spaces: "1",
			}),
			deadline,
		);
		const parts = [];
		let storedChars = 0;
		for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
			const screenshots = await runBeforeDeadline(
				parser.getScreenshot({
					partial: [pageNumber],
					desiredWidth,
					imageDataUrl: false,
					imageBuffer: true,
				}),
				deadline,
			);
			const page = screenshots.pages[0];
			if (!page) continue;
			const result = await runBeforeDeadline(worker.recognize(Buffer.from(page.data)), deadline);
			const pageText = normalizeExtractedText(result.data.text || "");
			if (pageText) {
				parts.push(`[Trang ${page.pageNumber}]\n${pageText}`);
				storedChars += pageText.length;
			}
			if (storedChars >= readPositiveInteger(process.env.AI_INDEX_MAX_CHARS, 200000)) break;
		}
		if (!parts.length) throw new Error("AI_DOCUMENT_TEXT_EMPTY");
		return parts.join("\n\n");
	} finally {
		try {
			if (worker) await worker.terminate();
		} finally {
			activeOCRJobs -= 1;
		}
	}
};

const extractDocumentText = async (fileKey) => {
	const maxBytes = readPositiveInteger(process.env.AI_DOCUMENT_MAX_BYTES, 20 * MB);
	const { buffer } = await downloadS3ObjectBuffer(fileKey, maxBytes);
	const extension = path.extname(fileKey).toLowerCase();

	let text;
	if (extension === ".pdf") {
		const parser = new PDFParse({ data: new Uint8Array(buffer) });
		try {
			const result = await parser.getText();
			text = result.text || "";
			const minimumTextChars = readPositiveInteger(process.env.AI_PDF_OCR_MIN_TEXT_CHARS, 200);
			if (normalizeExtractedText(text).length < minimumTextChars) {
				try {
					text = await extractScannedPdfText(parser, result.total);
				} catch (error) {
					if (["AI_DOCUMENT_TEXT_EMPTY", "AI_OCR_TIMEOUT", "AI_OCR_BUSY"].includes(error.message)) throw error;
					throw new Error("AI_OCR_FAILED", { cause: error });
				}
			}
		} finally {
			await parser.destroy();
		}
	} else if (extension === ".docx") {
		const result = await mammoth.extractRawText({ buffer });
		text = result.value;
	} else {
		throw new Error("AI_DOCUMENT_TYPE_UNSUPPORTED");
	}

	const normalized = normalizeExtractedText(text || "");
	if (!normalized) throw new Error("AI_DOCUMENT_TEXT_EMPTY");
	return limitStoredText(normalized);
};

const getIssueMessage = (source, error) => {
	const messages = {
		AI_DOCUMENT_TOO_LARGE: "Tài liệu vượt quá giới hạn xử lý",
		AI_DOCUMENT_TYPE_UNSUPPORTED: "Định dạng tài liệu chưa được hỗ trợ",
		AI_DOCUMENT_TEXT_EMPTY: "Không trích xuất được chữ từ tài liệu; PDF có thể chỉ chứa ảnh scan",
		AI_OCR_FAILED: "OCR cục bộ không thể xử lý PDF scan",
		AI_OCR_TIMEOUT: "OCR vượt quá thời gian xử lý cho phép; hãy giảm số trang hoặc thử lại",
		AI_OCR_BUSY: "Máy chủ đang OCR tài liệu khác; vui lòng thử lại sau",
		S3_READ_FAILED: "Không đọc được file từ S3",
	};
	return `${source}: ${messages[error.message] || "Không thể xử lý file"}`;
};

const getStaleBefore = () => {
	const staleMs = readPositiveInteger(process.env.AI_INDEX_STALE_MS, 10 * 60 * 1000);
	return new Date(Date.now() - staleMs);
};

export const recoverStaleAIIndexes = async (filter = {}) => {
	return Lesson.updateMany(
		{
			...filter,
			ai_index_status: "processing",
			$or: [
				{ ai_index_started_at: null },
				{ ai_index_started_at: { $lte: getStaleBefore() } },
			],
		},
		{
			$set: {
				ai_index_status: "failed",
				ai_index_started_at: null,
				ai_index_run_id: "",
				ai_index_error: "Lần xử lý trước bị gián đoạn hoặc quá thời gian. Bạn có thể chạy lại.",
			},
		},
	);
};

export const indexLessonFilesForAI = async (lessonId, userId, userRole) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");
	const lesson = await Lesson.findById(lessonId).select("+ai_document_text +ai_indexed_document_key");
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");
	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "tutor" || !isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");
	if (!lesson.document_key) throw new Error("LESSON_DOCUMENT_REQUIRED");

	const startedAt = new Date();
	const runId = randomUUID();
	const sourceDocumentKey = lesson.document_key;
	const claimedLesson = await Lesson.findOneAndUpdate(
		{
			_id: lesson._id,
			document_key: sourceDocumentKey,
			$or: [
				{ ai_index_status: { $ne: "processing" } },
				{ ai_index_started_at: null },
				{ ai_index_started_at: { $lte: getStaleBefore() } },
			],
		},
		{
			$set: {
				ai_index_status: "processing",
				ai_index_started_at: startedAt,
				ai_index_run_id: runId,
				ai_index_error: "",
			},
		},
		{ new: true },
	).select("+ai_document_text +ai_indexed_document_key +ai_index_run_id");
	if (!claimedLesson) throw new Error("AI_INDEX_IN_PROGRESS");

	const issues = [];
	let documentText = claimedLesson.ai_document_text;
	try {
		if (claimedLesson.ai_indexed_document_key !== sourceDocumentKey || !documentText?.trim()) {
			documentText = await extractDocumentText(sourceDocumentKey);
		}
	} catch (error) {
		documentText = "";
		issues.push(getIssueMessage("Tài liệu", error));
	}

	const completedAt = new Date();
	const status = documentText ? "ready" : "failed";
	const completedLesson = await Lesson.findOneAndUpdate(
		{
			_id: lesson._id,
			document_key: sourceDocumentKey,
			ai_index_status: "processing",
			ai_index_run_id: runId,
		},
		{
			$set: {
				ai_document_text: documentText,
				ai_indexed_document_key: documentText ? sourceDocumentKey : "",
				ai_index_status: status,
				ai_index_started_at: null,
				ai_index_run_id: "",
				ai_indexed_at: completedAt,
				ai_index_error: issues.join("; "),
			},
		},
		{ new: true },
	).select("+ai_document_text");
	if (!completedLesson) throw new Error("AI_INDEX_SOURCE_CHANGED");

	return {
		lesson_id: completedLesson._id,
		status: completedLesson.ai_index_status,
		indexed_at: completedLesson.ai_indexed_at,
		document_indexed: Boolean(completedLesson.ai_document_text),
		issues,
	};
};
