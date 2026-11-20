import express from "express";
import {
  createTestStudent,
  createTestUser,
  createTestFaculty,
  
} from "../controllers/testController.js";

const router = express.Router();

router.post("/user", createTestUser);
router.post("/student", createTestStudent);
router.post("/faculty", createTestFaculty);

export default router;
