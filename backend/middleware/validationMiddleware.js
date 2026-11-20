export const validateRequest = (req, res, next) => {
  const errors = req.validationErrors || [];

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors,
    });
  }

  next();
};