import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../shared/utils";
import agentRateService from "../services/agent-rate.service";

class AgentRateController {
  getActiveRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromCurrency, toCurrency } = req.query;
      const result = await agentRateService.getActiveRates(
        fromCurrency as string | undefined,
        toCurrency as string | undefined
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  calculateAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;

      if (!fromCurrency || !toCurrency || !amount) {
        res.status(400).json({
          success: false,
          message: "fromCurrency, toCurrency and amount are required",
        });
        return;
      }

      const result = await agentRateService.calculateAmount(
        fromCurrency,
        toCurrency,
        parseFloat(amount)
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };
}

export default new AgentRateController();
