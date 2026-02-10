import { Router } from "express";

const RateRouter: Router = Router();

RateRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default RateRouter;
