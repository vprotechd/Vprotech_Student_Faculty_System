
import express from "express";

import {
  getFacultyProfile,
  getFacultyDashboard,
} from "../controllers/facultyController.js";

import {
  requireAuth,
} from "../middleware/authMiddleware.js";

import {
  requireFaculty,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

// -----------------------------------
// Faculty Profile
// -----------------------------------

router.get(
  "/me",
  requireAuth,
  requireFaculty,
  getFacultyProfile
);

// -----------------------------------
// Faculty Dashboard
// -----------------------------------

router.get(
  "/dashboard",
  requireAuth,
  requireFaculty,
  getFacultyDashboard
);

export default router;
