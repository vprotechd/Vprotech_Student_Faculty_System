
import express from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

import {
  startExam,
  saveAnswers,
  submitExam,
  getMyAttempts,
} from "../../controllers/examination/examAttemptController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/my-attempts", getMyAttempts);
router.post("/:examId/start", startExam);
router.put("/:attemptId/answers", saveAnswers);
router.post("/:attemptId/submit", submitExam);

export default router;
