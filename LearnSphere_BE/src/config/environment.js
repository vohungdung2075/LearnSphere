const REQUIRED_PRODUCTION_VALUES = [
	"MONGODB_URI",
	"JWT_SECRET",
	"FRONTEND_URL",
	"AWS_REGION",
	"AWS_S3_BUCKET",
];

const getValue = (environment, key) => environment[key]?.trim() ?? "";

const validateFrontendOrigins = (value, errors) => {
	const origins = value
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	if (!origins.length) {
		errors.push("FRONTEND_URL must contain at least one HTTPS origin");
		return;
	}

	for (const origin of origins) {
		try {
			const parsed = new URL(origin);
			if (
				parsed.protocol !== "https:" ||
				parsed.username ||
				parsed.password ||
				parsed.search ||
				parsed.hash ||
				(parsed.pathname !== "/" && parsed.pathname !== "")
			) {
				throw new Error("invalid frontend origin");
			}
		} catch {
			errors.push(`FRONTEND_URL contains an invalid HTTPS origin: ${origin}`);
		}
	}
};

export const validateProductionEnvironment = (environment = process.env) => {
	if (environment.NODE_ENV?.trim().toLowerCase() !== "production") return;

	const errors = [];
	for (const key of REQUIRED_PRODUCTION_VALUES) {
		if (!getValue(environment, key)) errors.push(`${key} is required`);
	}

	const jwtSecret = getValue(environment, "JWT_SECRET");
	if (jwtSecret && jwtSecret.length < 64) {
		errors.push("JWT_SECRET must contain at least 64 characters");
	}

	const frontendUrl = getValue(environment, "FRONTEND_URL");
	if (frontendUrl) validateFrontendOrigins(frontendUrl, errors);

	const provider = getValue(environment, "AI_PROVIDER").toLowerCase();
	if (!["bedrock", "groq"].includes(provider)) {
		errors.push("AI_PROVIDER must be either bedrock or groq");
	} else if (provider === "bedrock") {
		if (!getValue(environment, "BEDROCK_REGION")) errors.push("BEDROCK_REGION is required when AI_PROVIDER=bedrock");
		if (!getValue(environment, "BEDROCK_MODEL_ID")) errors.push("BEDROCK_MODEL_ID is required when AI_PROVIDER=bedrock");
	} else {
		if (!getValue(environment, "GROQ_API_KEY")) errors.push("GROQ_API_KEY is required when AI_PROVIDER=groq");
		if (!getValue(environment, "GROQ_MODEL")) errors.push("GROQ_MODEL is required when AI_PROVIDER=groq");
	}

	const email = getValue(environment, "EMAIL");
	const emailPassword = getValue(environment, "EMAIL_PASSWORD");
	if (Boolean(email) !== Boolean(emailPassword)) {
		errors.push("EMAIL and EMAIL_PASSWORD must be configured together");
	}

	if (errors.length) {
		throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
	}
};
