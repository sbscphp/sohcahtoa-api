import { Router } from "express";
import customerController from "../controllers/customer.controller";

const router:Router = Router();

// Read-only admin view
router.get("/", customerController.listCustomers);
router.get("/:userId", customerController.getCustomer);

// Flags
router.get("/:userId/flags", customerController.listCustomerFlags);
router.post("/:userId/flags", customerController.createFlag);

// Global flags view (optional but useful)
router.get("/flags/all", customerController.listAllFlags);

// Update flag status
router.patch("/flags/:flagId/status", customerController.updateFlagStatus);

export default router;
