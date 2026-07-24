import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.AWS_REGION = "ap-southeast-1";
process.env.AWS_S3_BUCKET = "learnsphere-test-bucket";
process.env.FRONTEND_URL = "https://frontend.example.com";

const { default: app } = await import("../src/app.js");

let server;
let baseUrl;

before(async () => {
	await new Promise((resolve) => {
		server = app.listen(0, "127.0.0.1", () => {
			const address = server.address();
			baseUrl = `http://127.0.0.1:${address.port}`;
			resolve();
		});
	});
});

after(async () => {
	await new Promise((resolve, reject) => {
		server.close((error) => error ? reject(error) : resolve());
	});
});

test("liveness endpoint and security headers are available", async () => {
	const response = await fetch(`${baseUrl}/health/live`);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-content-type-options"), "nosniff");
	assert.deepEqual(await response.json(), { status: "ok" });
});

test("readiness is unavailable while MongoDB is disconnected", async () => {
	const response = await fetch(`${baseUrl}/health/ready`);
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), {
		status: "not_ready",
		database: "disconnected",
	});
});

test("unknown routes return a JSON 404 instead of the home response", async () => {
	const response = await fetch(`${baseUrl}/does-not-exist`);
	assert.equal(response.status, 404);
	assert.equal((await response.json()).code, "ROUTE_NOT_FOUND");
});

test("CORS accepts configured frontend and rejects another origin", async () => {
	const allowed = await fetch(`${baseUrl}/health/live`, {
		headers: { Origin: "https://frontend.example.com" },
	});
	assert.equal(allowed.status, 200);
	assert.equal(allowed.headers.get("access-control-allow-origin"), "https://frontend.example.com");

	const denied = await fetch(`${baseUrl}/health/live`, {
		headers: { Origin: "https://attacker.example.com" },
	});
	assert.equal(denied.status, 403);
	assert.equal((await denied.json()).code, "CORS_ORIGIN_NOT_ALLOWED");
});
