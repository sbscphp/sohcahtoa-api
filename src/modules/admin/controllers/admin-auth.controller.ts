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

  validateResetOtp = asyncHandler(async (req: Request, res: Response) => {
    const { otp } = req.body;
    const result = await adminAuthService.validateResetOtp(otp);
    res.json(successResponse(result));
  });

  submitNewPassword = asyncHandler(async (req: Request, res: Response) => {
    const { resetToken, password } = req.body;
    const result = await adminAuthService.submitNewPassword(resetToken, password);
    res.json(successResponse(result));
  });

  resendOtp = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await adminAuthService.resendLoginOtp(email);
    res.json(successResponse(result));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await adminAuthService.logout(user?.userId, user?.sessionId);
    res.json(successResponse(result));
  });

  resendForgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await adminAuthService.resendForgotOtp(email);
    res.json(successResponse(result));
  });

  verifyOldPassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { oldPassword } = req.body as { oldPassword: string };
    const result = await adminAuthService.verifyOldPassword(userId, oldPassword);
    res.json(successResponse(result));
  });

  submitPasswordChange = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { changeToken, newPassword } = req.body as { changeToken: string; newPassword: string };
    const result = await adminAuthService.submitPasswordChange(userId, changeToken, newPassword);
    res.json(successResponse(result));
  });
}

export const adminAuthController = new AdminAuthController();
