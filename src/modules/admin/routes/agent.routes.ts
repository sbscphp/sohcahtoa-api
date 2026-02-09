import { Router } from "express";

const AgentRouter: Router = Router();

AgentRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default AgentRouter;
