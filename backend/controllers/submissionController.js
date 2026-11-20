import Submission from '../models/Submission.js';
import Faculty from '../models/Faculty.js';

export const getPendingSubmissions =
  async (
    req,
    res,
    next
  ) => {
    try {
      const faculty = await Faculty.findOne({ userId: req.user.id }).select('_id');
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      const submissions =
        await Submission.find({
          faculty: faculty._id,
          status: 'pending',
        })
          .populate(
            'student',
            'name email'
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        data: {
          submissions,
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const getSubmission =
  async (
    req,
    res,
    next
  ) => {
    try {
      const faculty = await Faculty.findOne({ userId: req.user.id }).select('_id');
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      const submission =
        await Submission.findOne({
          _id: req.params.id,
          faculty: faculty._id,
        }).populate(
          'student',
          'name email'
        );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message:
            'Submission not found.',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          submission,
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const gradeSubmission =
  async (
    req,
    res,
    next
  ) => {
    try {
      const faculty = await Faculty.findOne({ userId: req.user.id }).select('_id');
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      const {
        marks,
        feedback,
      } = req.body;

      if (
        marks === undefined ||
        marks === null ||
        Number.isNaN(Number(marks))
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Marks are required.',
        });
      }

      const numericMarks =
        Number(marks);

      if (
        numericMarks < 0 ||
        numericMarks > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Marks must be between 0 and 100.',
        });
      }

      const submission =
        await Submission.findOneAndUpdate(
          {
            _id: req.params.id,
            faculty: faculty._id,
          },
          {
            $set: {
              marks:
                numericMarks,

              feedback:
                feedback?.trim() || '',

              status:
                'graded',

              gradedAt:
                new Date(),
            },
          },
          {
            new: true,
          }
        ).populate(
          'student',
          'name email'
        );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message:
            'Submission not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message:
          'Submission graded successfully.',
        data: {
          submission,
        },
      });
    } catch (error) {
      next(error);
    }
  };