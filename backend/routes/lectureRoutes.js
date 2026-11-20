import express from 'express';

import {
  getStudentLectures,
  getMyLectures,
  createLecture,
  updateLectureStatus,
} from '../controllers/lectureController.js';

import {
  requireAuth,
} from '../middleware/authMiddleware.js';

import {
  requireFaculty,
  requireStudent,
} from '../middleware/roleMiddleware.js';

const router =
  express.Router();

router.get(
  '/student',
  requireAuth,
  requireStudent,
  getStudentLectures
);

router.get(
  '/my',
  requireAuth,
  requireFaculty,
  getMyLectures
);

router.post(
  '/',
  requireAuth,
  requireFaculty,
  createLecture
);

router.patch(
  '/:id/status',
  requireAuth,
  requireFaculty,
  updateLectureStatus
);

export default router;