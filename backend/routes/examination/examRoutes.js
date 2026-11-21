import express from "express";
import requireAuth from "../../middleware/authMiddleware.js";

import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  publishExam,
  cancelExam,
} from "../../controllers/examination/examController.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", createExam);
router.get("/", getExams);
router.get("/:id", getExamById);
router.put("/:id", updateExam);
router.patch("/:id/publish", publishExam);
router.patch("/:id/cancel", cancelExam);

export default router;