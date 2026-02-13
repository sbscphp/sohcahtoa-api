import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { reportController } from "../controllers/report.controller";

const ReportRouter: Router = Router();

ReportRouter.get("/modules", authenticate, authorize(UserRole.SUPER_ADMIN), reportController.modules);
ReportRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN), reportController.stats);
ReportRouter.get("/jobs", authenticate, authorize(UserRole.SUPER_ADMIN), reportController.list);
ReportRouter.get("/jobs/:id", authenticate, authorize(UserRole.SUPER_ADMIN), reportController.get);
ReportRouter.post("/generate", authenticate, authorize(UserRole.SUPER_ADMIN), reportController.generate);

export default ReportRouter;
