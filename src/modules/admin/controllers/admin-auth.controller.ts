import { Request, Response } from "express";
import { successResponse } from "../../../shared/utils";
import { adminAuthService } from "../services/admin-auth.service";
import { CreateAdminUserDto } from "../dto/user-management.dto";
import { asyncHandler } from "../../../shared/middleware";

class AdminAuthController {

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await adminAuthService.initiateLogin(email, password);
    res.json(successResponse(result));
  });

  verifyLogin = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await adminAuthService.verifyLogin(email, otp);
    res.json(successResponse(result));
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await adminAuthService.forgotPassword(email);
    res.json(successResponse(result));
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { otp, password } = req.body;
    const result = await adminAuthService.resetPassword(otp, password);
    res.json(successResponse(result));
  });
}

export const adminAuthController = new AdminAuthController();
