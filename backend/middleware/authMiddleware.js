
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

const requireAuth = async (req, res, next) => {
  try {
    // --------------------------------------------------
    // GET AUTHORIZATION HEADER
    // --------------------------------------------------

    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // --------------------------------------------------
    // GET TOKEN
    // --------------------------------------------------

    const token = authorization
      .slice(7)
      .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    // --------------------------------------------------
    // JWT CONFIGURATION
    // --------------------------------------------------

    if (
      !env.jwtSecret ||
      env.jwtSecret.length < 32
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Authentication is not configured correctly.",
      });
    }

    // --------------------------------------------------
    // VERIFY JWT
    // --------------------------------------------------

    const decoded = jwt.verify(
      token,
      env.jwtSecret,
      {
        algorithms: ["HS256"],
      }
    );

    // --------------------------------------------------
    // FIND USER
    // --------------------------------------------------

    const user = await User.findById(
      decoded.userId
    );

    if (
      !user ||
      !user.isActive ||
      user.role !== decoded.role
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your session is invalid. Please log in again.",
      });
    }

    // --------------------------------------------------
    // SESSION
    // --------------------------------------------------

    const sessionId =
      decoded.sessionId ||
      `legacy-${user._id.toString()}`;

    let session;

    // --------------------------------------------------
    // EXISTING JWT SESSION
    // --------------------------------------------------

    if (decoded.sessionId) {
      session =
        await Session.findOneAndUpdate(
          {
            sessionId,
            userId: user._id,
            revokedAt: null,
          },
          {
            $set: {
              lastActivityAt:
                new Date(),
            },
          },
          {
            new: true,
          }
        );
    }

    // --------------------------------------------------
    // LEGACY TOKEN
    // --------------------------------------------------

    else {
      const now = new Date();

      try {
        session =
          await Session.findOneAndUpdate(
            {
              sessionId,
              userId: user._id,
              revokedAt: null,
            },
            {
              $set: {
                lastActivityAt: now,
              },

              $setOnInsert: {
                expiresAt:
                  decoded.exp
                    ? new Date(
                        decoded.exp * 1000
                      )
                    : new Date(
                        Date.now() +
                          24 *
                            60 *
                            60 *
                            1000
                      ),
              },
            },
            {
              new: true,
              upsert: true,
            }
          );
      } catch (error) {
        // Handle duplicate session creation
        if (error.code !== 11000) {
          throw error;
        }

        session =
          await Session.findOneAndUpdate(
            {
              sessionId,
              userId: user._id,
              revokedAt: null,
            },
            {
              $set: {
                lastActivityAt: now,
              },
            },
            {
              new: true,
            }
          );
      }
    }

    // --------------------------------------------------
    // SESSION VALIDATION
    // --------------------------------------------------

    if (!session) {
      return res.status(401).json({
        success: false,
        message:
          "Your session is invalid. Please log in again.",
      });
    }

    // --------------------------------------------------
    // TEMPORARY PASSWORD PROTECTION
    // --------------------------------------------------

    if (
      user.mustChangePassword &&
      ![
        "/change-password",
        "/logout",
        "/heartbeat",
      ].includes(req.path)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Change your temporary password before continuing.",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    // --------------------------------------------------
    // ATTACH USER TO REQUEST
    // --------------------------------------------------

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword:
        user.mustChangePassword,
      sessionId,
    };

    // --------------------------------------------------
    // CONTINUE
    // --------------------------------------------------

    next();
  } catch (error) {
    // --------------------------------------------------
    // JWT ERRORS
    // --------------------------------------------------

    if (
      error.name ===
        "TokenExpiredError" ||
      error.name ===
        "JsonWebTokenError" ||
      error.name ===
        "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token.",
      });
    }

    // --------------------------------------------------
    // OTHER ERRORS
    // --------------------------------------------------

    next(error);
  }
};

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

export { requireAuth };

export default requireAuth;