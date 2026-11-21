
import express from "express";
import requireAuth from "../../middleware/authMiddleware.js";

import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestions,
} from "../../controllers/examination/questionController.js";

const router = express.Router();

router.use(requireAuth);

router.post("/:examId", addQuestion);
router.get("/:examId", getQuestions);
router.put("/:examId/:questionId", updateQuestion);
router.delete("/:examId/:questionId", deleteQuestion);

export default router;
