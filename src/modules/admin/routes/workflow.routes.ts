import { Router } from "express";

const WorkflowRouter: Router = Router();

WorkflowRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default WorkflowRouter;
