import Student from "../models/Student.js";
import resourceRoutes from "./resourceRoutes.js";
export default resourceRoutes(Student, { read: ["student", "admin"], create: ["admin"], update: ["admin"], remove: ["admin"], ownerField: "userId" });
