
import express from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

import {
  getSubmittedAttempts,
  getAttemptForEvaluation,
  evaluateAttempt,
  publishAttemptResult,
  getExamResults,
} from "../../controllers/examination/evaluationController.js";

const router = express.Router();

router.use(requireAuth);

// Faculty evaluation
router.get("/:examId/submissions", getSubmittedAttempts);
router.get("/:examId/attempts/:attemptId", getAttemptForEvaluation);
router.put("/:examId/attempts/:attemptId/evaluate", evaluateAttempt);
router.patch("/:examId/attempts/:attemptId/publish", publishAttemptResult);

// Published results
router.get("/:examId/results", getExamResults);

export default router;
