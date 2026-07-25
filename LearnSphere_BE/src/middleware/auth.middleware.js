import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getAuthCookieName } from "../utils/authCookie.js";

export const protect = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
	const token = bearerToken || req.cookies?.[getAuthCookieName()];

	if (!token) {
		return res.status(401).json({ message: "Unauthorized - Missing or invalid token format" });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = await User.findById(decoded.id).select("-password_hash -reset_password_token -reset_password_expires");

		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized - User no longer exists" });
		}

		if (decoded.token_version !== req.user.token_version) {
			return res.status(401).json({ message: "Unauthorized - Token has been revoked" });
		}

		if (req.user.account_status !== "active") {
			return res.status(403).json({ message: `Forbidden - Account is ${req.user.account_status}` });
		}
		next();
	} catch (err) {
		return res.status(401).json({ message: "Invalid or Expired Token" });
	}
};

export const authorize = (...roles) => {
	return (req, res, next) => {
		if (!req.user || !roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Forbidden - You do not have permission to access this resource" });
		}
		next();
	};
};
