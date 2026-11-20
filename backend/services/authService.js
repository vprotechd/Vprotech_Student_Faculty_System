import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { sendVerificationEmail } from "./emailService.js";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Session from "../models/Session.js";
import generateToken from "../utils/generateToken.js";

const SALT_ROUNDS = 12;

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified === true,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
});

async function createSession(user) {
  const sessionId = randomUUID();

  const token = generateToken(user, sessionId);

  const decoded = jwt.decode(token);

  if (!decoded?.exp) {
    throw new Error(
      "Generated authentication token is missing an expiry."
    );
  }

  await Session.create({
    sessionId,
    userId: user._id,
    expiresAt: new Date(decoded.exp * 1000),
  });

  return {
    token,
    user: publicUser(user),
  };
}

export async function registerStudent({
  name,
  email,
  password,
  role,
}, baseUrl) {
  // -----------------------------------
  // Only students can register publicly
  // -----------------------------------

  if (role && role !== "student") {
    const error = new Error(
      "Public registration is available for students only. Faculty and admin accounts must be created by an administrator."
    );

    error.statusCode = 403;
    throw error;
  }

  // -----------------------------------
  // Validate name
  // -----------------------------------

  if (
    typeof name !== "string" ||
    name.trim().length < 2
  ) {
    const error = new Error(
      "Name must contain at least 2 characters."
    );

    error.statusCode = 400;
    throw error;
  }

  // -----------------------------------
  // Validate email/password
  // -----------------------------------

  if (
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    const error = new Error(
      "Name, email and password are required."
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email
    .trim()
    .toLowerCase();

  // -----------------------------------
  // Check duplicate email
  // -----------------------------------

  if (
    await User.exists({
      email: normalizedEmail,
    })
  ) {
    const error = new Error(
      "An account with this email already exists."
    );

    error.statusCode = 409;
    throw error;
  }

  // -----------------------------------
  // Hash password
  // -----------------------------------

  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  try {
    // -----------------------------------
    // Create student user
    // -----------------------------------

    const verificationToken = randomBytes(32).toString("hex");
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "student",
      isActive: false,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      mustChangePassword: false,
    });

    let studentCreated = false;
    try {
      const suffix = user._id.toString().slice(-6).toUpperCase();
      await Student.create({
        userId: user._id,
        studentId: `STU${new Date().getFullYear()}${suffix}`,
        rollNumber: suffix,
      });
      studentCreated = true;

      // The account and verification token remain saved if SMTP is temporarily
      // unavailable, allowing the user to request another verification email.
      let emailSent = false;
      let emailWarning = null;
      try {
        await sendVerificationEmail(user.email, user.name, verificationToken, baseUrl);
        emailSent = true;
      } catch (mailError) {
        console.error("VERIFICATION EMAIL SEND ERROR:", mailError?.message || mailError);
        emailWarning = "Your account was created, but the verification email could not be sent right now. Please tap Resend Verification Email.";
      }

      return {
        user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, isEmailVerified: false },
        emailSent,
        message: emailWarning || "Verification email sent. Please verify your email before signing in.",
      };
    } catch (profileError) {
      if (studentCreated) await Student.deleteOne({ userId: user._id });
      await User.deleteOne({ _id: user._id }).catch(() => {});
      throw profileError;
    }
  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error(
        "An account with this email already exists or a generated student ID conflicts. Please retry."
      );

      duplicateError.statusCode = 409;

      throw duplicateError;
    }

    throw error;
  }
}

export async function loginUser({
  email,
  password,
  role,
}) {
  // -----------------------------------
  // Validate login input
  // -----------------------------------

  if (
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    const error = new Error(
      "Email and password are required."
    );

    error.statusCode = 400;
    throw error;
  }

  // -----------------------------------
  // Find user
  // -----------------------------------

  // Match the exact email first (admin-created faculty keep the address the
  // admin typed). Also try the legacy "normalized" Gmail form, because students
  // who registered earlier were stored without dots / "+tags".
  const exactEmail = email.trim().toLowerCase();
  const emailCandidates = [exactEmail];
  const [localPart, domainPart] = exactEmail.split("@");
  if (domainPart === "gmail.com" || domainPart === "googlemail.com") {
    const legacy = `${localPart.split("+")[0].replace(/\./g, "")}@gmail.com`;
    if (!emailCandidates.includes(legacy)) emailCandidates.push(legacy);
  }

  let user = null;
  for (const candidate of emailCandidates) {
    user = await User.findOne({ email: candidate }).select("+passwordHash");
    if (user) break;
  }

  // -----------------------------------
  // Verify password
  // -----------------------------------

  if (
    !user ||
    !(await bcrypt.compare(
      password,
      user.passwordHash
    ))
  ) {
    const error = new Error(
      "Invalid email or password."
    );

    error.statusCode = 401;
    throw error;
  }

  // -----------------------------------
  // Check selected role
  // -----------------------------------

  if (role && role !== user.role) {
    const error = new Error(
      `This account is registered as ${user.role}. Please select the correct role.`
    );

    error.statusCode = 403;
    throw error;
  }

  // Students must verify their email before a session can be created.
  if (user.role === "student" && user.isEmailVerified !== true) {
    const error = new Error("Please verify your email address before signing in.");
    error.statusCode = 403;
    error.code = "EMAIL_NOT_VERIFIED";
    error.email = user.email;
    throw error;
  }

  // -----------------------------------
  // Check account status
  // -----------------------------------

  if (!user.isActive) {
    const error = new Error(
      "This account is inactive. Contact the administrator."
    );

    error.statusCode = 403;
    throw error;
  }

  // -----------------------------------
  // Update last login
  // -----------------------------------

  user.lastLogin = new Date();

  await user.save();

  // -----------------------------------
  // Create session
  // -----------------------------------

  return createSession(user);
}