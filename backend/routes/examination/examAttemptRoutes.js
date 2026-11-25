
import express from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

import {
  startExam,
  getAttemptForStudent,
  saveAnswers,
  submitExam,
  getMyAttempts,
} from "../../controllers/examination/examAttemptController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/my-attempts", getMyAttempts);
router.get("/:attemptId", getAttemptForStudent);
router.post("/:examId/start", startExam);
router.put("/:attemptId/answers", saveAnswers);
router.post("/:attemptId/submit", submitExam);

export default router;
