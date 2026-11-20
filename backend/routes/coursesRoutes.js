import Course from "../models/Course.js";
import resourceRoutes from "./resourceRoutes.js";
export default resourceRoutes(Course, { read: ["student", "faculty", "admin"], create: ["admin"], update: ["admin"], remove: ["admin"] });
