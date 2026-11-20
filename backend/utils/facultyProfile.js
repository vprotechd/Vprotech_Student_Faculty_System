import Faculty from "../models/Faculty.js";

// Submission.faculty and Timetable.facultyId reference the Faculty profile
// document, but req.user.id is the User id. This resolves one to the other.
export const getFacultyProfileId = async (userId) => {
  const profile = await Faculty.findOne({ userId }).select("_id").lean();
  return profile ? profile._id : null;
};
