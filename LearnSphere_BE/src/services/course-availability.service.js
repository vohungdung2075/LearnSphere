import User from "../models/User.model.js";

export const isCourseCreatorActive = async (course) => {
	if (!course?.created_by) return false;
	if (typeof course.created_by === "object" && course.created_by.account_status !== undefined) {
		return course.created_by.role === "tutor" && course.created_by.account_status === "active";
	}
	return Boolean(await User.exists({
		_id: course.created_by._id ?? course.created_by,
		role: "tutor",
		account_status: "active",
	}));
};

export const requireActiveCourseCreator = async (course) => {
	if (!await isCourseCreatorActive(course)) {
		throw new Error("COURSE_NOT_FOUND");
	}
};
