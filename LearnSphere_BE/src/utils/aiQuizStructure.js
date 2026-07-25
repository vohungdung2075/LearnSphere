const createInvalidStructuredResponseError = (reason) => {
	const error = new Error("AI_INVALID_STRUCTURED_RESPONSE");
	error.structured_reason = reason;
	return error;
};

const parseStructuredPayload = (rawText) => {
	if (typeof rawText !== "string" || !rawText.trim()) {
		throw createInvalidStructuredResponseError("empty_response");
	}

	const withoutFence = rawText
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();

	try {
		return JSON.parse(withoutFence);
	} catch {}

	const candidates = [
		[withoutFence.indexOf("{"), withoutFence.lastIndexOf("}")],
		[withoutFence.indexOf("["), withoutFence.lastIndexOf("]")],
	];
	for (const [start, end] of candidates) {
		if (start < 0 || end <= start) continue;
		try {
			return JSON.parse(withoutFence.slice(start, end + 1));
		} catch {}
	}

	throw createInvalidStructuredResponseError("invalid_json");
};

export const parseGeneratedQuestions = (rawText, expectedCount) => {
	const payload = parseStructuredPayload(rawText);
	const questions = Array.isArray(payload) ? payload : payload?.questions;

	if (!Array.isArray(questions) || questions.length !== expectedCount) {
		throw createInvalidStructuredResponseError("unexpected_question_count");
	}

	return questions.map((question) => {
		if (
			!question ||
			typeof question.content !== "string" ||
			!question.content.trim() ||
			!["single_choice", "multiple_choice"].includes(question.question_type) ||
			!Array.isArray(question.answers) ||
			question.answers.length < 2 ||
			question.answers.length > 6
		) {
			throw createInvalidStructuredResponseError("invalid_question_shape");
		}

		const answers = question.answers.map((answer) => {
			if (
				!answer ||
				typeof answer.content !== "string" ||
				!answer.content.trim() ||
				typeof answer.is_correct !== "boolean"
			) {
				throw createInvalidStructuredResponseError("invalid_answer_shape");
			}
			return { content: answer.content.trim(), is_correct: answer.is_correct };
		});

		const correctCount = answers.filter((answer) => answer.is_correct).length;
		if (
			(question.question_type === "single_choice" && correctCount !== 1) ||
			(question.question_type === "multiple_choice" && correctCount < 1)
		) {
			throw createInvalidStructuredResponseError("invalid_correct_answer_count");
		}

		return {
			content: question.content.trim(),
			question_type: question.question_type,
			point: 1,
			answers,
		};
	});
};
