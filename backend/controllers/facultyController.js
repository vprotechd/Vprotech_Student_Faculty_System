import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Lecture from '../models/Lecture.js';
import Material from '../models/Material.js';
import Submission from '../models/Submission.js';

export const getFacultyProfile = async (
  req,
  res,
  next
) => {
  try {
    const faculty = await Faculty.findOne({
      userId: req.user.id,
    }).populate(
      'userId',
      'name email role isActive'
    ).populate(
      'departmentId',
      'name code'
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        faculty,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getFacultyDashboard = async (
  req,
  res,
  next
) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrow = new Date(todayStart);
    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const facultyProfile = await Faculty.findOne({ userId: req.user.id }).select('_id');
    const facultyDocumentId = facultyProfile?._id;

    const [
      todayLectures,
      pendingSubmissions,
      materialCount,
    ] = await Promise.all([
      Lecture.countDocuments({
        faculty: req.user.id,
        date: {
          $gte: todayStart,
          $lt: tomorrow,
        },
        status: {
          $ne: 'Cancelled',
        },
      }),

      facultyDocumentId
        ? Submission.countDocuments({ faculty: facultyDocumentId, status: 'pending' })
        : Promise.resolve(0),

      Material.countDocuments({
        uploadedBy: req.user.id,
        isActive: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        todayLectures,
        pendingSubmissions,
        materialCount,
      },
    });
  } catch (error) {
    next(error);
  }
};