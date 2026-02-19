import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { workflowController } from "../controllers/workflow.controller";

const WorkflowRouter: Router = Router();

WorkflowRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.stats);
WorkflowRouter.get("/actions", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.actions);

export default WorkflowRouter;
