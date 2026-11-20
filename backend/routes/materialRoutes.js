
import express from "express";

import {
  uploadMaterial,
  getFacultyMaterials,
  getAllMaterials,
  deleteMaterial,
} from "../controllers/materialController.js";

import {
  requireAuth,
} from "../middleware/authMiddleware.js";

import {
  requireFaculty,
  requireAdmin,
  requireAnyAuthenticatedRole,
} from "../middleware/roleMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ==========================================
// FACULTY - UPLOAD MATERIAL
// POST /api/materials/upload
// ==========================================

router.post(
  "/upload",
  requireAuth,
  requireFaculty,
  upload.single("file"),
  uploadMaterial
);

// ==========================================
// FACULTY - GET OWN MATERIALS
// GET /api/materials/faculty
// ==========================================
//
// Keep /my as the existing route for compatibility.
// /faculty is the route used by the Faculty mobile app.
//

router.get(
  "/faculty",
  requireAuth,
  requireFaculty,
  getFacultyMaterials
);

// ==========================================
// FACULTY - GET OWN MATERIALS (LEGACY)
// GET /api/materials/my
// ==========================================

router.get(
  "/my",
  requireAuth,
  requireFaculty,
  getFacultyMaterials
);

// ==========================================
// STUDENTS / FACULTY / ADMIN - GET PUBLISHED MATERIALS
// GET /api/materials
// ==========================================

router.get(
  "/",
  requireAuth,
  requireAnyAuthenticatedRole,
  getAllMaterials
);

// ==========================================
// FACULTY / ADMIN - DELETE
// DELETE /api/materials/:id
// ==========================================

router.delete(
  "/:id",
  requireAuth,
  deleteMaterial
);

export default router;
