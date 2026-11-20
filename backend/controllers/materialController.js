
import Material from "../models/Material.js";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

// ==========================================
// UPLOAD / PUBLISH STUDY MATERIAL
// ==========================================

export const uploadMaterial = async (req, res, next) => {
  try {
    // --------------------------------------
    // Authentication
    // --------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // --------------------------------------
    // Faculty Only
    // --------------------------------------

    if (req.user.role !== "faculty") {
      return res.status(403).json({
        success: false,
        message:
          "Only faculty members can publish study materials.",
      });
    }

    // --------------------------------------
    // Get Form Data
    // --------------------------------------

    const {
      title,
      batch,
      type,
    } = req.body;

    // --------------------------------------
    // Validate Title
    // --------------------------------------

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Material title is required.",
      });
    }

    // --------------------------------------
    // Validate Batch
    // --------------------------------------

    if (!batch?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch / cohort is required.",
      });
    }

    // --------------------------------------
    // Validate Material Type
    // --------------------------------------

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Material type is required.",
      });
    }

    if (!["note", "video"].includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Material type must be either note or video.",
      });
    }

    // --------------------------------------
    // Validate File
    // --------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file.",
      });
    }

    // --------------------------------------
    // Upload File to Cloudinary
    // --------------------------------------
    //
    // uploadMiddleware uses multer memoryStorage(),
    // so req.file.path does not exist. Upload the
    // in-memory buffer directly to Cloudinary instead.
    //

    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file data is missing.",
      });
    }

    const uploadedFile = await new Promise(
      (resolve, reject) => {
        const uploadStream =
          cloudinary.uploader.upload_stream(
            {
              folder: "study-materials",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              if (!result?.secure_url) {
                reject(
                  new Error(
                    "Cloudinary did not return a file URL."
                  )
                );
                return;
              }

              resolve(result);
            }
          );

        streamifier
          .createReadStream(req.file.buffer)
          .pipe(uploadStream);
      }
    );

    const fileUrl =
      uploadedFile.secure_url;

    const publicId =
      uploadedFile.public_id;

    // --------------------------------------
    // Create Material
    // --------------------------------------

    const material = await Material.create({
      title: title.trim(),

      batch: batch.trim(),

      type,

      fileUrl,

      publicId,

      // Material schema uses originalName
      originalName:
        req.file.originalname ||
        req.file.name ||
        "uploaded-file",

      mimeType:
        req.file.mimetype ||
        req.file.mimeType ||
        null,

      size:
        req.file.size ||
        null,

      // Authenticated User ID
      // This matches ref: "User"
      uploadedBy: req.user.id,

      /*
       * IMPORTANT:
       *
       * Your schema says:
       *
       * faculty: {
       *   type: mongoose.Schema.Types.ObjectId,
       *   ref: "Faculty"
       * }
       *
       * req.user.id belongs to User.
       *
       * Therefore DO NOT put req.user.id
       * into faculty unless User ID and
       * Faculty ID are intentionally the same.
       *
       * We leave it null for now.
       */
      faculty: null,

      isActive: true,
    });

    // --------------------------------------
    // Response
    // --------------------------------------

    return res.status(201).json({
      success: true,
      message:
        "Study material published successfully.",
      material,
    });
  } catch (error) {
    console.error(
      "UPLOAD MATERIAL ERROR:",
      error
    );

    next(error);
  }
};

// ==========================================
// GET FACULTY MATERIALS
// ==========================================

export const getFacultyMaterials = async (
  req,
  res,
  next
) => {
  try {
    // --------------------------------------
    // Authentication
    // --------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // --------------------------------------
    // Faculty Only
    // --------------------------------------

    if (req.user.role !== "faculty") {
      return res.status(403).json({
        success: false,
        message:
          "Only faculty members can access faculty materials.",
      });
    }

    // --------------------------------------
    // Get Materials
    // --------------------------------------

    /*
     * Use uploadedBy here because uploadedBy
     * references the User model.
     *
     * req.user.id is a User ID.
     */

    const materials = await Material.find({
      uploadedBy: req.user.id,
      isActive: true,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    // --------------------------------------
    // Response
    // --------------------------------------

    return res.status(200).json({
      success: true,
      materials,
    });
  } catch (error) {
    console.error(
      "GET FACULTY MATERIALS ERROR:",
      error
    );

    next(error);
  }
};

// ==========================================
// GET ALL MATERIALS
// ==========================================

export const getAllMaterials = async (
  req,
  res,
  next
) => {
  try {
    // --------------------------------------
    // Authentication
    // --------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // --------------------------------------
    // Get All Active Materials
    // --------------------------------------

    const materials = await Material.find({
      isActive: true,
    })
      .populate(
        "faculty",
        "name fullName email department designation"
      )
      .populate(
        "uploadedBy",
        "name fullName email"
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    // --------------------------------------
    // Response
    // --------------------------------------

    return res.status(200).json({
      success: true,
      materials,
    });
  } catch (error) {
    console.error(
      "GET ALL MATERIALS ERROR:",
      error
    );

    next(error);
  }
};

// ==========================================
// DELETE MATERIAL
// ==========================================

export const deleteMaterial = async (
  req,
  res,
  next
) => {
  try {
    // --------------------------------------
    // Authentication
    // --------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // --------------------------------------
    // Get Material
    // --------------------------------------

    const material = await Material.findById(
      req.params.id
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found.",
      });
    }

    // --------------------------------------
    // Faculty Ownership Check
    // --------------------------------------

    if (req.user.role === "faculty") {
      /*
       * uploadedBy references User,
       * so compare uploadedBy with req.user.id.
       */

      if (
        !material.uploadedBy ||
        material.uploadedBy.toString() !==
          req.user.id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only delete your own study materials.",
        });
      }
    }

    // --------------------------------------
    // Delete Material
    // --------------------------------------

    await Material.findByIdAndDelete(
      req.params.id
    );

    // --------------------------------------
    // Response
    // --------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Study material deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE MATERIAL ERROR:",
      error
    );

    next(error);
  }
};
