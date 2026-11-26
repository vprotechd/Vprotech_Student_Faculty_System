import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFaculty, requireFacultyOrAdmin, requireStudent } from "../middleware/roleMiddleware.js";
import upload from "../middleware/assignmentUploadMiddleware.js";
import {
  createAssignment, listAssignments, getAssignment, updateAssignment,
  publishAssignment, deleteAssignment, submitAssignment,
  listAssignmentSubmissions, gradeAssignmentSubmission, getMyAssignmentSubmission,
} from "../controllers/assignmentController.js";

const router = express.Router();
const assignmentFileUpload = (req, res, next) => upload.single("file")(req, res, (error) => {
  if (error) return res.status(400).json({ success: false, message: error.message || "Unable to upload file." });
  next();
});
router.use(requireAuth);

router.get("/", listAssignments);
router.post("/", requireFaculty, assignmentFileUpload, createAssignment);
router.get("/my-submissions/:submissionId", requireStudent, getMyAssignmentSubmission);
router.post("/:id/submit", requireStudent, assignmentFileUpload, submitAssignment);
router.get("/:id/submissions", requireFacultyOrAdmin, listAssignmentSubmissions);
router.patch("/:id/submissions/:submissionId/grade", requireFacultyOrAdmin, gradeAssignmentSubmission);
router.patch("/:id/publish", requireFacultyOrAdmin, publishAssignment);
router.put("/:id", requireFacultyOrAdmin, assignmentFileUpload, updateAssignment);
router.delete("/:id", requireFacultyOrAdmin, deleteAssignment);
router.get("/:id", getAssignment);

export default router;
