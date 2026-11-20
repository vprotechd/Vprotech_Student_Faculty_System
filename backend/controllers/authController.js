
import {
  registerStudent,
  loginUser,
} from "../services/authService.js";

import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { sendVerificationEmail } from "../services/emailService.js";
import { randomBytes } from "node:crypto";

/**
 * ============================================
 * REGISTER STUDENT
 * ============================================
 *
 * POST /api/auth/register
 *
 * Registration creates the account but should NOT
 * automatically log the user in.
 *
 * The student must verify their email first.
 */
// Public base URL used to build the link inside verification emails.
const publicBaseUrl = (req) =>
  (process.env.BACKEND_PUBLIC_URL || "").trim().replace(/\/+$/, "").replace(/\/api$/, "") ||
  `${req.protocol}://${req.get("host")}`;

const renderVerifyPage = (res, status, ok, message) => {
  const color = ok ? "#15803D" : "#C62828";
  const bg = ok ? "#DCFCE7" : "#FEE2E2";
  const title = ok ? "Email Verified!" : "Verification Failed";
  const safe = String(message).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return res.status(status).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#F7FAFC;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box"><div style="max-width:420px;text-align:center"><div style="width:84px;height:84px;border-radius:42px;background:${bg};color:${color};font-size:42px;line-height:84px;margin:0 auto 20px">${ok ? "&#10003;" : "&#10007;"}</div><h1 style="color:#183B56;margin:0 0 10px">${title}</h1><p style="color:#718096;line-height:1.5">${safe}</p>${ok ? '<a href="myapp://" style="display:inline-block;margin-top:20px;background:#1769AA;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:bold">Open Campus Hub app</a><p style="color:#718096;font-size:13px;margin-top:18px">You can now close this page and sign in to the app.</p>' : ""}</div></body></html>`);
};

export const register = async (req, res, next) => {
  try {
    const result = await registerStudent(req.body, publicBaseUrl(req));

    return res.status(201).json({
      success: true,
      message: result?.message || "Student account created successfully. Please verify your email before signing in.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * LOGIN
 * ============================================
 *
 * POST /api/auth/login
 *
 * IMPORTANT:
 * Email verification is checked BEFORE returning
 * a login token.
 */
export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);

    /*
     * loginUser should return:
     *
     * {
     *   token,
     *   user
     * }
     */

    const user = result?.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid login response.",
      });
    }

    /*
     * ==========================================
     * EMAIL VERIFICATION CHECK
     * ==========================================
     *
     * Students must verify their email before
     * they can access the portal.
     *
     * Faculty/admin accounts created by the
     * administrator can continue without this
     * restriction if their account does not use
     * email verification.
     */

    if (
      user.role === "student" &&
      user.isEmailVerified !== true
    ) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email address before signing in.",
        data: {
          email: user.email,
          isEmailVerified: false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  } catch (error) {
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: error.message,
        data: { email: error.email, isEmailVerified: false },
      });
    }
    next(error);
  }
};

/**
 * ============================================
 * VERIFY EMAIL
 * ============================================
 *
 * GET /api/auth/verify-email?token=XXXX
 *
 * This endpoint is opened when the user clicks
 * the verification link received by email.
 */
export const verifyEmail = async (req, res) => {
  // Browsers (tapping the email link) get a web page; the app gets JSON.
  const wantsHtml = req.query.format !== "json" && req.accepts(["json", "html"]) === "html";
  const reply = (status, ok, message, data) =>
    wantsHtml
      ? renderVerifyPage(res, status, ok, message)
      : res.status(status).json({ success: ok, message, ...(data ? { data } : {}) });

  try {
    const { token } = req.query;

    // -----------------------------------------
    // CHECK TOKEN
    // -----------------------------------------

    if (!token || typeof token !== "string") {
      return reply(400, false, "Verification token is required.");
    }

    // -----------------------------------------
    // FIND USER
    // -----------------------------------------

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: {
        $gt: new Date(),
      },
    });

    // -----------------------------------------
    // INVALID / EXPIRED TOKEN
    // -----------------------------------------

    if (!user) {
      return reply(400, false, "This verification link is invalid, already used, or has expired. If you already verified, just sign in; otherwise request a new email from the app.");
    }

    // -----------------------------------------
    // ALREADY VERIFIED
    // -----------------------------------------

    if (user.isEmailVerified === true) {
      return reply(200, true, "Email is already verified.");
    }

    // -----------------------------------------
    // VERIFY EMAIL
    // -----------------------------------------

    user.isEmailVerified = true;

    /*
     * Activate the student account only after
     * successful email verification.
     */
    user.isActive = true;

    // -----------------------------------------
    // REMOVE VERIFICATION TOKEN
    // -----------------------------------------

    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();

    // -----------------------------------------
    // RESPONSE
    // -----------------------------------------

    return reply(200, true, "Email verified successfully. You can now sign in.", {
      email: user.email,
      isEmailVerified: true,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error);
    return reply(500, false, "Unable to verify email.");
  }
};

/**
 * ============================================
 * RESEND VERIFICATION EMAIL
 * ============================================
 *
 * POST /api/auth/resend-verification
 *
 * IMPORTANT:
 * Your frontend already calls this endpoint.
 *
 * This controller generates a new token and
 * sends the verification email.
 */
export const resendVerificationEmail = async (
  req,
  res,
  next
) => {
  try {
    const email = req.body?.email
      ?.trim()
      .toLowerCase();

    // -----------------------------------------
    // VALIDATE EMAIL
    // -----------------------------------------

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    // -----------------------------------------
    // FIND USER
    // -----------------------------------------

    let user = await User.findOne({ email });

    // Accounts registered before the fix were stored with a normalized Gmail address.
    if (!user) {
      const [local, domain] = email.split("@");
      if (domain === "gmail.com" || domain === "googlemail.com") {
        user = await User.findOne({ email: `${local.split("+")[0].replace(/\./g, "")}@gmail.com` });
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No account was found with this email address.",
      });
    }

    // -----------------------------------------
    // CHECK ROLE
    // -----------------------------------------

    if (user.role !== "student") {
      return res.status(400).json({
        success: false,
        message:
          "Email verification is only required for student accounts.",
      });
    }

    // -----------------------------------------
    // CHECK VERIFIED
    // -----------------------------------------

    if (user.isEmailVerified === true) {
      return res.status(400).json({
        success: false,
        message:
          "This email address is already verified.",
      });
    }

    // -----------------------------------------
    // GENERATE TOKEN
    // -----------------------------------------

    const verificationToken = randomBytes(32).toString("hex");

    user.emailVerificationToken =
      verificationToken;

    /*
     * Token expires after 24 hours.
     */
    user.emailVerificationExpires =
      new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken, publicBaseUrl(req));
    } catch (mailError) {
      console.error("RESEND VERIFICATION EMAIL ERROR:", mailError?.message || mailError);
      return res.status(502).json({
        success: false,
        message: "The verification email could not be sent. The mail server rejected the request - please try again in a few minutes or contact the administrator.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "A new verification email has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * CHANGE PASSWORD
 * ============================================
 *
 * POST /api/auth/change-password
 *
 * Authenticated users only.
 */
export const changePassword = async (
  req,
  res,
  next
) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    // -----------------------------------
    // CHECK AUTHENTICATION
    // -----------------------------------

    const userId =
      req.user?.id ||
      req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    // -----------------------------------
    // VALIDATE CURRENT PASSWORD
    // -----------------------------------

    if (
      typeof currentPassword !== "string" ||
      !currentPassword.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password is required.",
      });
    }

    // -----------------------------------
    // VALIDATE NEW PASSWORD
    // -----------------------------------

    if (
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password is required.",
      });
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be between 12 and 128 characters.",
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least one lowercase letter.",
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least one uppercase letter.",
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least one number.",
      });
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least one special character.",
      });
    }

    // -----------------------------------
    // GET USER
    // -----------------------------------

    const user =
      await User.findById(userId).select(
        "+passwordHash"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User account not found.",
      });
    }

    // -----------------------------------
    // CHECK ACCOUNT STATUS
    // -----------------------------------

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive. Please contact the administrator.",
      });
    }

    // -----------------------------------
    // VERIFY CURRENT PASSWORD
    // -----------------------------------

    const passwordMatches =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message:
          "Current password is incorrect.",
      });
    }

    // -----------------------------------
    // PREVENT SAME PASSWORD
    // -----------------------------------

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.passwordHash
      );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "Your new password must be different from your current password.",
      });
    }

    // -----------------------------------
    // HASH NEW PASSWORD
    // -----------------------------------

    user.passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    // Faculty no longer needs temporary password
    user.mustChangePassword = false;

    await user.save();

    // -----------------------------------
    // REVOKE OTHER SESSIONS
    // -----------------------------------

    if (req.user.sessionId) {
      await Session.updateMany(
        {
          userId: user._id,
          sessionId: {
            $ne: req.user.sessionId,
          },
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        }
      );
    }

    // -----------------------------------
    // RETURN UPDATED USER
    // -----------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully.",
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified:
            user.isEmailVerified,
          mustChangePassword:
            user.mustChangePassword,
          lastLogin:
            user.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * LOGOUT
 * ============================================
 *
 * POST /api/auth/logout
 */
export const logout = async (
  req,
  res,
  next
) => {
  try {
    if (req.user?.sessionId) {
      await Session.updateOne(
        {
          sessionId:
            req.user.sessionId,
          userId: req.user.id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * HEARTBEAT
 * ============================================
 *
 * GET /api/auth/heartbeat
 */
export const heartbeat = async (
  _req,
  res
) => {
  return res.status(200).json({
    success: true,
  });
};

/**
 * ============================================
 * CURRENT USER
 * ============================================
 *
 * GET /api/auth/me
 */
export const getCurrentUser = async (
  req,
  res,
  next
) => {
  try {
    return res.status(200).json({
      success: true,
      message:
        "Authenticated user retrieved successfully.",
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

