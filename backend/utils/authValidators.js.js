import { body, validationResult } from "express-validator";

export const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must contain between 2 and 100 characters."),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address.")
    .customSanitizer((value) => String(value).trim().toLowerCase()), // keep the exact address typed so the verification mail reaches it

  body("password")
    .isString()
    .withMessage("Password must be a string.")
    .isLength({ min: 12, max: 128 })
    .withMessage("Password must contain between 12 and 128 characters.")
    .matches(/[a-z]/)
    .withMessage("Password must contain a lowercase letter.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number.")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain a special character."),
];

export const loginValidation = [
  // NOTE: normalizeEmail() is intentionally NOT used here. It strips dots from
  // Gmail addresses, so an admin-created faculty account such as
  // "john.doe@gmail.com" could never be found at login. The login service
  // matches the exact lower-cased email (and the legacy normalized form).
  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address.")
    .customSanitizer((value) => String(value).trim().toLowerCase()),

  body("password")
    .isString()
    .withMessage("Password is required.")
    .isLength({ min: 1, max: 128 })
    .withMessage("Password must not exceed 128 characters."),
];

export const checkValidation = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Please correct the submitted data.",
      errors: result.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  next();
};