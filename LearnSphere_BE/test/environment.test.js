import assert from "node:assert/strict";
import { test } from "node:test";
import { validateProductionEnvironment } from "../src/config/environment.js";

const validProductionEnvironment = {
	NODE_ENV: "production",
	MONGODB_URI: "mongodb+srv://example.invalid/learnsphere",
	JWT_SECRET: "a".repeat(64),
	FRONTEND_URL: "https://learnsphere.example.com",
	AWS_REGION: "ap-southeast-1",
	AWS_S3_BUCKET: "learnsphere-media",
	AI_PROVIDER: "bedrock",
	BEDROCK_REGION: "ap-southeast-1",
	BEDROCK_MODEL_ID: "global.example-model-v1:0",
};

test("production environment accepts a complete Bedrock configuration", () => {
	assert.doesNotThrow(() => validateProductionEnvironment(validProductionEnvironment));
});

test("production environment accepts comma-separated HTTPS frontend origins", () => {
	assert.doesNotThrow(() => validateProductionEnvironment({
		...validProductionEnvironment,
		FRONTEND_URL: "https://learnsphere.example.com, https://admin.example.com/",
	}));
});

test("production environment rejects missing required values and weak JWT secrets", () => {
	assert.throws(
		() => validateProductionEnvironment({
			...validProductionEnvironment,
			MONGODB_URI: "",
			JWT_SECRET: "too-short",
		}),
		(error) => {
			assert.match(error.message, /MONGODB_URI is required/);
			assert.match(error.message, /JWT_SECRET must contain at least 64 characters/);
			return true;
		},
	);
});

test("production environment requires HTTPS frontend origins", () => {
	assert.throws(
		() => validateProductionEnvironment({
			...validProductionEnvironment,
			FRONTEND_URL: "http://learnsphere.example.com",
		}),
		/FRONTEND_URL contains an invalid HTTPS origin/,
	);
});

test("production environment validates provider-specific settings", () => {
	assert.throws(
		() => validateProductionEnvironment({
			...validProductionEnvironment,
			AI_PROVIDER: "groq",
			GROQ_API_KEY: "",
			GROQ_MODEL: "",
		}),
		(error) => {
			assert.match(error.message, /GROQ_API_KEY is required/);
			assert.match(error.message, /GROQ_MODEL is required/);
			return true;
		},
	);
});

test("production environment requires email settings as a pair", () => {
	assert.throws(
		() => validateProductionEnvironment({
			...validProductionEnvironment,
			EMAIL: "noreply@example.com",
		}),
		/EMAIL and EMAIL_PASSWORD must be configured together/,
	);
});

test("non-production environments preserve optional local configuration", () => {
	assert.doesNotThrow(() => validateProductionEnvironment({
		NODE_ENV: "development",
	}));
});
