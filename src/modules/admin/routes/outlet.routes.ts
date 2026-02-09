import { Router } from "express";

const OutletRouter: Router = Router();

OutletRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default OutletRouter;
