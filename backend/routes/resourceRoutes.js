import express from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

// Shared CRUD router for the project's existing Mongoose models. All routes require a valid token;
// writes are restricted by role at each mount point. Never accepts passwordHash or owner fields from clients.
export default function resourceRoutes(Model, { read = ["student", "faculty", "admin"], create = ["admin"], update = ["admin"], remove = ["admin"], ownerField = null } = {}) {
  const router = express.Router();
  router.use(requireAuth);
  const scopedFilter = (req) => {
    if (req.user.role === "admin" || !ownerField) return {};
    return { [ownerField]: req.user.id };
  };
  router.get("/", allowRoles(...read), async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
      const filter = { ...scopedFilter(req) };
      if (req.query.id && mongoose.isValidObjectId(req.query.id)) filter._id = req.query.id;
      const [items, total] = await Promise.all([Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Model.countDocuments(filter)]);
      res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (e) { next(e); }
  });
  router.get("/:id", allowRoles(...read), async (req, res, next) => {
    try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid resource ID." });
      const item = await Model.findOne({ _id: req.params.id, ...scopedFilter(req) }).lean();
      if (!item) return res.status(404).json({ success: false, message: "Record not found." });
      res.json({ success: true, data: item });
    } catch (e) { next(e); }
  });
  router.post("/", allowRoles(...create), async (req, res, next) => {
    try { const body = { ...req.body }; delete body.passwordHash; delete body._id; delete body.__v;
      if (Model.modelName === "Class") body.createdBy = req.user.id;
      if (["Lecture", "Material"].includes(Model.modelName)) body.uploadedBy = req.user.id;
      const item = await Model.create(body); res.status(201).json({ success: true, message: "Record created successfully.", data: item });
    } catch (e) { next(e); }
  });
  router.patch("/:id", allowRoles(...update), async (req, res, next) => {
    try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid resource ID." });
      const body = { ...req.body }; for (const key of ["_id", "__v", "passwordHash", "role", "userId", "createdBy", "uploadedBy"]) delete body[key];
      const item = await Model.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ success: false, message: "Record not found." }); res.json({ success: true, message: "Record updated successfully.", data: item });
    } catch (e) { next(e); }
  });
  router.delete("/:id", allowRoles(...remove), async (req, res, next) => {
    try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid resource ID." });
      const item = await Model.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ success: false, message: "Record not found." }); res.json({ success: true, message: "Record deleted successfully." });
    } catch (e) { next(e); }
  });
  return router;
}
