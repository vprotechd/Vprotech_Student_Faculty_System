import Lecture from '../models/Lecture.js';
import Student from '../models/Student.js';

const isValidDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidTime = (value) =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getStudentLectures = async (req, res, next) => {
  try {
    const student = await Student.findOne({ userId: req.user.id })
      .select('semester section courseId')
      .populate('courseId', 'name code')
      .lean();

    if (!student) {
      return res.status(200).json({ success: true, data: { lectures: [] } });
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const scheduled = await Lecture.find({
      date: { $gte: start },
      status: { $ne: 'Cancelled' },
    })
      .sort({ date: 1, startTime: 1 })
      .limit(500)
      .lean();

    const normalize = (value) =>
      String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const course = student.courseId;
    const courseNames = course
      ? [course.name, course.code].map(normalize).filter(Boolean)
      : [];
    const studentSemester = Number.isInteger(student.semester)
      ? String(student.semester)
      : '';
    const semesterPattern = studentSemester
      ? new RegExp(
          `(?:^|[^a-z0-9])(?:(?:semester|sem)\\s*${escapeRegex(studentSemester)}|${escapeRegex(studentSemester)}(?:st|nd|rd|th)?\\s*(?:semester|sem)?)(?:[^0-9]|$)`,
          'i'
        )
      : null;
    const section = String(student.section || '').trim();
    const sectionPattern = section
      ? new RegExp(
          `(?:section|sec)\\s*[:#-]?\\s*${escapeRegex(section)}(?:\\b|$)|\\b${escapeRegex(section)}\\b`,
          'i'
        )
      : null;

    const lectures = scheduled.filter((lecture) => {
      const cohort = String(lecture.cohort || '');
      const normalizedCourse = normalize(lecture.course);
      const cohortHasSemester =
        /(?:semester|sem)\s*\d+|\b\d+(?:st|nd|rd|th)?\s*(?:semester|sem)\b/i.test(cohort);
      const cohortHasSection =
        /(?:section|sec)\s*[:#-]?\s*[a-z0-9]+/i.test(cohort) ||
        /[-,]\s*[a-z0-9]+\s*$/i.test(cohort);
      const courseMatches =
        courseNames.length > 0 &&
        courseNames.some(
          (name) =>
            normalizedCourse === name ||
            normalizedCourse.startsWith(`${name} `) ||
            normalizedCourse.endsWith(` ${name}`)
        );
      const semesterMatches =
        !semesterPattern || semesterPattern.test(cohort);
      const sectionMatches =
        !sectionPattern || sectionPattern.test(cohort);
      const cohortMatches =
        Boolean(semesterPattern && sectionPattern) &&
        semesterPattern.test(cohort) &&
        sectionPattern.test(cohort);
      const courseAndCohortMatch =
        courseMatches &&
        (!cohortHasSemester || semesterMatches) &&
        (!cohortHasSection || sectionMatches);

      return cohortMatches || courseAndCohortMatch;
    });

    return res.status(200).json({
      success: true,
      data: { lectures },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLectures = async (
  req,
  res,
  next
) => {
  try {
    const {
      date,
    } = req.query;

    const query = {
      faculty: req.user.id,
    };

    if (date) {
      const start = new Date(
        `${date}T00:00:00`
      );

      const end = new Date(start);

      end.setDate(
        end.getDate() + 1
      );

      query.date = {
        $gte: start,
        $lt: end,
      };
    }

    const lectures =
      await Lecture.find(query)
        .sort({
          date: 1,
          startTime: 1,
        });

    return res.status(200).json({
      success: true,
      data: {
        lectures,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createLecture = async (
  req,
  res,
  next
) => {
  try {
    const course = typeof req.body.course === 'string' ? req.body.course.trim() : '';
    const cohort = typeof req.body.cohort === 'string' ? req.body.cohort.trim() : '';
    const date = req.body.date;
    const startTime = typeof req.body.startTime === 'string' ? req.body.startTime.trim() : '';
    const endTime = typeof req.body.endTime === 'string' ? req.body.endTime.trim() : '';
    const room = typeof req.body.room === 'string' ? req.body.room.trim() : '';
    const meetingUrl =
      typeof req.body.meetingUrl === 'string' ? req.body.meetingUrl.trim() : '';

    if (
      !course ||
      !cohort ||
      !date ||
      !startTime ||
      !endTime ||
      !room
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Course, cohort, date, time and room are required.',
      });
    }

    if (course.length > 150 || cohort.length > 150 || room.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Course and cohort must be at most 150 characters; room must be at most 100 characters.',
      });
    }

    if (!isValidDateOnly(date)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid date in YYYY-MM-DD format.',
      });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Enter valid 24-hour times such as 09:30.',
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be later than start time.',
      });
    }

    if (meetingUrl && meetingUrl.length > 2048) {
      return res.status(400).json({
        success: false,
        message: 'Meeting link must be at most 2048 characters.',
      });
    }

    const lecture =
      await Lecture.create({
        faculty: req.user.id,
        course,
        cohort,
        date,
        startTime,
        endTime,
        room,
        meetingUrl:
          meetingUrl || '',
      });

    return res.status(201).json({
      success: true,
      message:
        'Lecture scheduled successfully.',
      data: {
        lecture,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLectureStatus =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        status,
      } = req.body;

      const allowedStatuses = [
        'Scheduled',
        'Live Soon',
        'Live',
        'Completed',
        'Cancelled',
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid lecture status.',
        });
      }

      const lecture =
        await Lecture.findOneAndUpdate(
          {
            _id: req.params.id,
            faculty: req.user.id,
          },
          {
            $set: {
              status,
            },
          },
          {
            new: true,
          }
        );

      if (!lecture) {
        return res.status(404).json({
          success: false,
          message:
            'Lecture not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message:
          'Lecture status updated.',
        data: {
          lecture,
        },
      });
    } catch (error) {
      next(error);
    }
  };