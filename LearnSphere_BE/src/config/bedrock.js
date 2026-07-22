import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

let bedrockClient;

export const getBedrockConfig = () => ({
	region: process.env.BEDROCK_REGION?.trim() || "ap-southeast-1",
	modelId:
		process.env.BEDROCK_MODEL_ID?.trim() ||
		"global.anthropic.claude-haiku-4-5-20251001-v1:0",
});

export const getBedrockClient = () => {
	if (!bedrockClient) {
		const { region } = getBedrockConfig();
		bedrockClient = new BedrockRuntimeClient({
			region,
			maxAttempts: 3,
			retryMode: "standard",
		});
	}

	return bedrockClient;
};
