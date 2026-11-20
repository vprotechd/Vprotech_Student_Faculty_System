import Class from "../models/Class.js";
import resourceRoutes from "./resourceRoutes.js";
export default resourceRoutes(Class, { read: ["student", "faculty", "admin"], create: ["faculty", "admin"], update: ["faculty", "admin"], remove: ["admin"] });
