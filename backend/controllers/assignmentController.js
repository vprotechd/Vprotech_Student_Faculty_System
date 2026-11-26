import mongoose from "mongoose";
import { Readable } from "node:stream";
import cloudinary from "../config/cloudinary.js";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Faculty from "../models/Faculty.js";
import Student from "../models/Student.js";

const isId = (value) => mongoose.isValidObjectId(value);
const uploadBuffer = (file, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder, resource_type: "auto", use_filename: true, unique_filename: true },
    (error, result) => error ? reject(error) : resolve(result)
  );
  Readable.from(file.buffer).pipe(stream);
});
const fileInfo = (file, result) => ({
  url: result.secure_url,
  publicId: result.public_id,
  fileName: file.originalname,
  mimeType: file.mimetype,
  resourceType: result.resource_type || "raw",
  bytes: file.size,
});
const removeCloudFile = async (publicId, resourceType = "raw") => {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (error) { console.warn("Assignment file cleanup failed:", error.message); }
};
const getFaculty = (req) => Faculty.findOne({ userId: req.user.id }).select("_id");
const getStudent = (req) => Student.findOne({ userId: req.user.id }).select("_id courseId semester section");
const canManage = async (req, assignment) => {
  if (req.user.role === "admin") return true;
  if (req.user.role !== "faculty") return false;
  const faculty = await getFaculty(req);
  return Boolean(faculty && String(assignment.faculty?._id || assignment.faculty) === String(faculty._id));
};
const studentMatches = (assignment, student) =>
  (!assignment.course || String(assignment.course?._id || assignment.course) === String(student.courseId)) &&
  (!assignment.semester || assignment.semester === student.semester) &&
  (!assignment.section || assignment.section === String(student.section || "").toUpperCase());

export const createAssignment = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req);
    if (!faculty) return res.status(404).json({ success: false, message: "Faculty profile not found." });
    const { title, description, instructions = "", course = null, semester = null, section = null, dueDate, maxMarks } = req.body;
    if (!title?.trim() || !description?.trim() || !dueDate || !Number.isFinite(Number(maxMarks)) || Number(maxMarks) <= 0 || !Number.isFinite(new Date(dueDate).getTime())) {
      return res.status(400).json({ success: false, message: "Title, description, valid deadline and positive maximum marks are required." });
    }
    if (course && !isId(course)) return res.status(400).json({ success: false, message: "Invalid course." });
    if (semester !== null && semester !== "" && (!Number.isInteger(Number(semester)) || Number(semester) < 1 || Number(semester) > 12)) return res.status(400).json({ success: false, message: "Semester must be between 1 and 12." });
    const payload = { title: title.trim(), description: description.trim(), instructions, faculty: faculty._id, course: course || null, semester: semester ? Number(semester) : null, section: section?.trim()?.toUpperCase() || null, dueDate: new Date(dueDate), maxMarks: Number(maxMarks) };
    if (req.file) {
      const result = await uploadBuffer(req.file, "vprotech/assignments");
      payload.attachment = fileInfo(req.file, result);
    }
    const assignment = await Assignment.create(payload);
    return res.status(201).json({ success: true, message: "Assignment created.", assignment });
  } catch (error) { next(error); }
};

export const listAssignments = async (req, res, next) => {
  try {
    if (req.user.role === "student") {
      const student = await getStudent(req);
      if (!student) return res.status(404).json({ success: false, message: "Student profile not found." });
      const candidates = await Assignment.find({ status: "published" }).populate("faculty", "facultyId designation").populate("course", "name code").sort({ dueDate: 1 });
      const assignments = candidates.filter((a) => studentMatches(a, student));
      const submissions = await AssignmentSubmission.find({ student: student._id, assignment: { $in: assignments.map((a) => a._id) } }).select("assignment status marks feedback submittedAt gradedAt file.fileName");
      const byAssignment = new Map(submissions.map((s) => [String(s.assignment), s]));
      return res.json({ success: true, assignments: assignments.map((a) => ({ ...a.toObject(), mySubmission: byAssignment.get(String(a._id)) || null })) });
    }
    if (req.user.role === "faculty") {
      const faculty = await getFaculty(req);
      if (!faculty) return res.status(404).json({ success: false, message: "Faculty profile not found." });
      const assignments = await Assignment.find({ faculty: faculty._id }).populate("course", "name code").sort({ createdAt: -1 });
      return res.json({ success: true, assignments });
    }
    const assignments = await Assignment.find().populate("faculty", "facultyId").populate("course", "name code").sort({ createdAt: -1 });
    return res.json({ success: true, assignments });
  } catch (error) { next(error); }
};

export const getAssignment = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid assignment ID." });
    const assignment = await Assignment.findById(req.params.id).populate("faculty", "facultyId designation").populate("course", "name code");
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (req.user.role === "student") {
      const student = await getStudent(req);
      if (!student || assignment.status !== "published" || !studentMatches(assignment, student)) return res.status(404).json({ success: false, message: "Assignment not found." });
      const submission = await AssignmentSubmission.findOne({ assignment: assignment._id, student: student._id });
      return res.json({ success: true, assignment, submission });
    }
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot access this assignment." });
    return res.json({ success: true, assignment });
  } catch (error) { next(error); }
};

export const updateAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot edit this assignment." });
    const hasSubmissions = await AssignmentSubmission.exists({ assignment: assignment._id });
    if (hasSubmissions) return res.status(409).json({ success: false, message: "This assignment already has submissions and can no longer be edited." });
    const allowed = ["title", "description", "instructions", "dueDate", "maxMarks", "course", "semester", "section"];
    for (const key of allowed) if (req.body[key] !== undefined) assignment[key] = req.body[key];
    if (!assignment.title?.trim() || !assignment.description?.trim() || !Number.isFinite(new Date(assignment.dueDate).getTime()) || Number(assignment.maxMarks) <= 0) return res.status(400).json({ success: false, message: "Please provide valid assignment details." });
    let previousAttachment = null;
    if (req.file) {
      const result = await uploadBuffer(req.file, "vprotech/assignments");
      previousAttachment = assignment.attachment;
      assignment.attachment = fileInfo(req.file, result);
    }
    await assignment.save();
    if (previousAttachment?.publicId) await removeCloudFile(previousAttachment.publicId, previousAttachment.resourceType || "raw");
    return res.json({ success: true, message: "Assignment updated.", assignment });
  } catch (error) { next(error); }
};

export const publishAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot publish this assignment." });
    if (assignment.status === "closed") return res.status(400).json({ success: false, message: "Closed assignments cannot be published." });
    assignment.status = "published";
    assignment.publishedAt = new Date();
    await assignment.save();
    return res.json({ success: true, assignment });
  } catch (error) { next(error); }
};

export const deleteAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot delete this assignment." });
    if (await AssignmentSubmission.exists({ assignment: assignment._id })) return res.status(409).json({ success: false, message: "Assignments with student submissions cannot be deleted. You can close them instead." });
    await assignment.deleteOne();
    if (assignment.attachment?.publicId) await removeCloudFile(assignment.attachment.publicId, assignment.attachment.resourceType || "raw");
    return res.json({ success: true, message: "Assignment deleted." });
  } catch (error) { next(error); }
};

export const submitAssignment = async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found." });
    if (!req.file) return res.status(400).json({ success: false, message: "Please attach your completed assignment file." });
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment || assignment.status !== "published" || !studentMatches(assignment, student)) return res.status(404).json({ success: false, message: "Assignment not found." });
    const now = new Date();
    const existing = await AssignmentSubmission.findOne({ assignment: assignment._id, student: student._id });
    if (existing?.status === "graded") return res.status(409).json({ success: false, message: "This submission has already been graded and cannot be replaced." });
    const result = await uploadBuffer(req.file, "vprotech/assignment-submissions");
    const file = fileInfo(req.file, result);
    const wasLate = now > assignment.dueDate;
    let submission;
    if (existing) {
      const oldFile = existing.file;
      existing.file = file;
      existing.comment = String(req.body.comment || "").slice(0, 3000);
      existing.status = wasLate ? "late" : "submitted";
      existing.submittedAt = now;
      existing.marks = null;
      existing.feedback = "";
      existing.gradedAt = null;
      submission = await existing.save();
      if (oldFile?.publicId) await removeCloudFile(oldFile.publicId, oldFile.resourceType || "raw");
    } else {
      submission = await AssignmentSubmission.create({ assignment: assignment._id, student: student._id, file, comment: String(req.body.comment || "").slice(0, 3000), status: wasLate ? "late" : "submitted", submittedAt: now });
    }
    return res.status(201).json({ success: true, message: wasLate ? "Assignment submitted after the deadline and marked late." : "Assignment submitted successfully.", submission });
  } catch (error) { next(error); }
};

export const listAssignmentSubmissions = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot view these submissions." });
    const submissions = await AssignmentSubmission.find({ assignment: assignment._id }).populate({ path: "student", populate: { path: "userId", select: "name email" } }).sort({ submittedAt: -1 });
    return res.json({ success: true, assignment, submissions });
  } catch (error) { next(error); }
};

export const gradeAssignmentSubmission = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
    if (!(await canManage(req, assignment))) return res.status(403).json({ success: false, message: "You cannot grade this assignment." });
    const marks = Number(req.body.marks);
    if (!Number.isFinite(marks) || marks < 0 || marks > assignment.maxMarks) return res.status(400).json({ success: false, message: `Marks must be between 0 and ${assignment.maxMarks}.` });
    const submission = await AssignmentSubmission.findOne({ _id: req.params.submissionId, assignment: assignment._id });
    if (!submission) return res.status(404).json({ success: false, message: "Student submission not found." });
    const faculty = req.user.role === "faculty" ? await getFaculty(req) : null;
    submission.marks = marks;
    submission.feedback = String(req.body.feedback || "").trim().slice(0, 5000);
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = faculty?._id || null;
    await submission.save();
    return res.json({ success: true, message: "Assignment evaluated successfully.", submission });
  } catch (error) { next(error); }
};

export const getMyAssignmentSubmission = async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found." });
    const submission = await AssignmentSubmission.findOne({ _id: req.params.submissionId, student: student._id }).populate("assignment", "title maxMarks dueDate");
    if (!submission) return res.status(404).json({ success: false, message: "Submission not found." });
    return res.json({ success: true, submission });
  } catch (error) { next(error); }
};
