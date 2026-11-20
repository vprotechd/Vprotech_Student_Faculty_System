import Department from "../models/Department.js";
import resourceRoutes from "./resourceRoutes.js";
export default resourceRoutes(Department, { read: ["student", "faculty", "admin"], create: ["admin"], update: ["admin"], remove: ["admin"] });
