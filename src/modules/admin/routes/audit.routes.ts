import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { auditController } from "../controllers/audit.controller";

const AuditRouter: Router = Router();

AuditRouter.get("/trail", authenticate, authorize(UserRole.SUPER_ADMIN), auditController.list);


export default AuditRouter;
