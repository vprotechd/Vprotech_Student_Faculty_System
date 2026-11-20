
// middleware/roleMiddleware.js

const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // -----------------------------------
    // Authentication check
    // -----------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // -----------------------------------
    // Role check
    // -----------------------------------

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "User role is not available.",
      });
    }

    // -----------------------------------
    // Permission check
    // -----------------------------------

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to access this resource.",
      });
    }

    // -----------------------------------
    // Authorized
    // -----------------------------------

    next();
  };
};

// Student-only routes
export const requireStudent =
  allowRoles("student");

// Faculty-only routes
export const requireFaculty =
  allowRoles("faculty");

// Admin-only routes
export const requireAdmin =
  allowRoles("admin");

// Multiple-role routes
export const requireStudentOrFaculty =
  allowRoles("student", "faculty");

export const requireFacultyOrAdmin =
  allowRoles("faculty", "admin");

export const requireAnyAuthenticatedRole =
  allowRoles(
    "student",
    "faculty",
    "admin"
  );

export default allowRoles;
