import { Router } from "express";

const TicketsRouter: Router = Router();

TicketsRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

export default TicketsRouter;
