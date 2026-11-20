import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "faculty", "admin"],
      required: [true, "User role is required"],
      default: "student",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
  type: Boolean,
  default: false,
},
emailVerificationToken: {
  type: String,
  default: null,
},
emailVerificationExpires: {
  type: Date,
  default: null,
},
  },
  {
    timestamps: true,
  },
  
);

const User = mongoose.model("User", userSchema);

export default User;