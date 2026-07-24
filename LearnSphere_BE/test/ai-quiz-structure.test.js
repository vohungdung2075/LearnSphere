import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneratedQuestions } from "../src/services/ai.service.js";

const question = {
	content: "Câu hỏi mẫu?",
	question_type: "single_choice",
	answers: [
		{ content: "Đáp án đúng", is_correct: true },
		{ content: "Đáp án sai 1", is_correct: false },
		{ content: "Đáp án sai 2", is_correct: false },
		{ content: "Đáp án sai 3", is_correct: false },
	],
};

test("quiz parser accepts the JSON object shape requested from Groq", () => {
	const parsed = parseGeneratedQuestions(JSON.stringify({ questions: [question] }), 1);
	assert.equal(parsed.length, 1);
	assert.equal(parsed[0].point, 1);
	assert.equal(parsed[0].answers[0].is_correct, true);
});

test("quiz parser remains compatible with a direct JSON array and markdown fence", () => {
	const parsed = parseGeneratedQuestions(`\`\`\`json\n${JSON.stringify([question])}\n\`\`\``, 1);
	assert.equal(parsed.length, 1);
});

test("quiz parser rejects an unexpected question count", () => {
	assert.throws(
		() => parseGeneratedQuestions(JSON.stringify({ questions: [question] }), 2),
		(error) => error.message === "AI_INVALID_STRUCTURED_RESPONSE"
			&& error.structured_reason === "unexpected_question_count",
	);
});

test("quiz parser rejects string values used instead of JSON booleans", () => {
	const invalid = structuredClone(question);
	invalid.answers[0].is_correct = "true";
	assert.throws(
		() => parseGeneratedQuestions(JSON.stringify({ questions: [invalid] }), 1),
		(error) => error.message === "AI_INVALID_STRUCTURED_RESPONSE"
			&& error.structured_reason === "invalid_answer_shape",
	);
});
