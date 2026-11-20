import User from "../models/User.js";
import Student from "../models/Student.js";
import Faculty from "../models/Faculty.js";
import Department from "../models/Department.js";


export const createTestUser = async (req, res, next) => {
  try {
    const existingUser = await User.findOne({
      email: "test.student@example.com",
    });

    if (existingUser) {
      return res.status(200).json({  
        success: true,
        message: "Test user already exists",
        data: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
    }

    const user = await User.create({
      name: "Test Student",
      email: "test.student@example.com",
      passwordHash: "temporary-test-hash",
      role: "student",
    });

    res.status(201).json({
      success: true,
      message: "Test user created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createTestStudent = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: "test.student@example.com",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Test user not found",
      });
    }

    const existingStudent = await Student.findOne({
      userId: user._id,
    });

    if (existingStudent) {
      return res.status(200).json({
        success: true,
        message: "Test student already exists",
        data: existingStudent,
      });
    }

    const student = await Student.create({
      userId: user._id,
      studentId: "STU2026001",
      rollNumber: "23",
      semester: 5,
      section: "A",
      enrollmentYear: 2026,
      phone: "9999999999",
    });

    res.status(201).json({
      success: true,
      message: "Test student created successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
};



export const createTestFaculty = async (req, res, next) => {
  try {
    let user = await User.findOne({
      email: "test.faculty@example.com",
    });

    if (!user) {
      user = await User.create({
        name: "Test Faculty",
        email: "test.faculty@example.com",
        passwordHash: "temporary-test-hash",
        role: "faculty",
      });
    }

    const existingFaculty = await Faculty.findOne({
      userId: user._id,
    });

    if (existingFaculty) {
      return res.status(200).json({
        success: true,
        message: "Test faculty already exists",
        data: existingFaculty,
      });
    }

    const faculty = await Faculty.create({
      userId: user._id,
      facultyId: "FAC2026001",
      employeeId: "EMP001",
      designation: "Assistant Professor",
      qualification: "M.Tech",
      specialization: "Computer Science",
      phone: "8888888888",
    });

    res.status(201).json({
      success: true,
      message: "Test faculty created successfully",
      data: faculty,
    });
  } catch (error) {
    next(error);
  }
};


export const createTestCourse = async (req, res, next) => {
  try {
    const department = await Department.findOne({
      code: "CSE",
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Test department not found. Create department first.",
      });
    }

    const existingCourse = await Course.findOne({
      code: "BTECH-CSE",
    });

    if (existingCourse) {
      return res.status(200).json({
        success: true,
        message: "Test course already exists",
        data: existingCourse,
      });
    }

    const course = await Course.create({
      departmentId: department._id,
      name: "B.Tech Computer Science and Engineering",
      code: "BTECH-CSE",
      durationYears: 4,
      description:
        "Bachelor of Technology in Computer Science and Engineering",
    });

    res.status(201).json({
      success: true,
      message: "Test course created successfully",
      data: course,
    });
  } catch (error) {
    next(error);
  }
};