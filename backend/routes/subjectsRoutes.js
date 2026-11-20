import Subject from "../models/Subject.js";
import resourceRoutes from "./resourceRoutes.js";
export default resourceRoutes(Subject, { read: ["student", "faculty", "admin"], create: ["admin"], update: ["admin"], remove: ["admin"] });
