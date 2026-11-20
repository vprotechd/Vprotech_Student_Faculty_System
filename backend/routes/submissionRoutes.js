import express from 'express';

import {
  getPendingSubmissions,
  getSubmission,
  gradeSubmission,
} from '../controllers/submissionController.js';

import {
  requireAuth,
} from '../middleware/authMiddleware.js';

import {
  requireFaculty,
} from '../middleware/roleMiddleware.js';

const router =
  express.Router();

router.get(
  '/pending',
  requireAuth,
  requireFaculty,
  getPendingSubmissions
);

router.get(
  '/:id',
  requireAuth,
  requireFaculty,
  getSubmission
);

router.patch(
  '/:id/grade',
  requireAuth,
  requireFaculty,
  gradeSubmission
);

export default router;