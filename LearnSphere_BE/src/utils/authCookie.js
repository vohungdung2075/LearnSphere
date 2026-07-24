const COOKIE_NAME = "learnsphere_access_token";

const getCookieOptions = () => {
	const production = process.env.NODE_ENV === "production";
	const configuredDays = Number(process.env.AUTH_COOKIE_MAX_AGE_DAYS);
	const maxAgeDays = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 7;
	const options = {
		httpOnly: true,
		secure: production,
		sameSite: "lax",
		path: "/",
		maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
	};
	if (process.env.AUTH_COOKIE_DOMAIN?.trim()) {
		options.domain = process.env.AUTH_COOKIE_DOMAIN.trim();
	}
	return options;
};

export const setAuthCookie = (res, token) => {
	res.cookie(COOKIE_NAME, token, getCookieOptions());
};

export const clearAuthCookie = (res) => {
	const { maxAge, ...options } = getCookieOptions();
	res.clearCookie(COOKIE_NAME, options);
};

export const getAuthCookieName = () => COOKIE_NAME;
