import { Router } from "express";

const ReportRouter: Router = Router();

ReportRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default ReportRouter;
