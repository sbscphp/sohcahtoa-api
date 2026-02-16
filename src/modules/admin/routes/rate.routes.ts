import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { rateController } from "../controllers/rate.controller";

const RateRouter: Router = Router();

RateRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.stats);
RateRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.list);
RateRouter.get("/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.get);
RateRouter.post("/", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.create);
RateRouter.put("/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.update);
RateRouter.patch("/:id/deactivate", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), rateController.deactivate);


export default RateRouter;
