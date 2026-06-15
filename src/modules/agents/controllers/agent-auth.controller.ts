import { NextFunction, Request, Response } from 'express';
import authController from '../../auth/controllers/auth.controller';
import authService from '../../auth/services/auth.service';
import { AuthRequest } from '../../../shared/middleware';
import { successResponse, ValidationError } from '../../../shared/utils';
import agentProfileService from '../services/agent-profile.service';

class AgentAuthController {
  /**
   * @swagger
   * /api/agent/auth/change-password:
   *   post:
   *     summary: Change agent password
   *     description: >
   *       Allows an authenticated agent to change their own password by providing the current password,
   *       a new password, and a confirmation of the new password.
   *     tags: [Agent Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *               - newPasswordConfirm
   *             properties:
   *               currentPassword:
   *                 type: string
   *                 format: password
   *                 description: Agent's current password
   *               newPassword:
   *                 type: string
   *                 format: password
   *                 description: New password (must meet existing password strength requirements)
   *               newPasswordConfirm:
   *                 type: string
   *                 format: password
   *                 description: Must match newPassword
   *     responses:
   *       200:
   *         description: Password updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: Password updated successfully
   *       400:
   *         description: Validation error (incorrect current password, mismatch, or weak password)
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  async changeAgentPassword(req: AuthRequest, res: Response, next: NextFunction) {
    return authController.changeAgentPassword(req, res, next);
  }

  /**
   * @swagger
   * /api/agent/auth/profile:
   *   get:
   *     summary: Get authenticated agent profile
   *     description: Returns the signed-in agent's profile (Agent id, contact, KYC fields, join date, last session time).
   *     tags: [Agent Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     email:
   *                       type: string
   *                       format: email
   *                     phone_number:
   *                       type: string
   *                     date_joined:
   *                       type: string
   *                       format: date-time
   *                     last_active:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     gender:
   *                       type: string
   *                       nullable: true
   *                     date_of_birth:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     bvn:
   *                       type: string
   *                       nullable: true
   *                     tin:
   *                       type: string
   *                       nullable: true
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         description: Not an agent
   */
  /**
   * @swagger
   * /api/agent/auth/otp/change-password:
   *   post:
   *     summary: Step 1 - Validate current password and send OTP
   *     description: Verifies the agent's current password, then sends a CHANGE_PASSWORD OTP to their email.
   *     tags: [Agent Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [oldPassword]
   *             properties:
   *               oldPassword:
   *                 type: string
   *                 description: The agent's current password
   *     responses:
   *       200:
   *         description: OTP sent to agent's email
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  async initiateChangePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new ValidationError('Authentication required');
      const { oldPassword } = req.body;
      const result = await authService.initiateAgentChangePassword(req.user.userId, oldPassword);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/agent/auth/otp/verify-change-password:
   *   post:
   *     summary: Step 2 - Validate OTP and receive reset token
   *     description: Validates the CHANGE_PASSWORD OTP. Returns a short-lived reset token (5 min) to use with POST /api/agent/auth/reset-password.
   *     tags: [Agent Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [otp]
   *             properties:
   *               otp:
   *                 type: string
   *                 example: "123456"
   *     responses:
   *       200:
   *         description: OTP verified — use resetToken with POST /api/agent/auth/reset-password
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     resetToken:
   *                       type: string
   *                     message:
   *                       type: string
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  async verifyChangePasswordOtp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new ValidationError('Authentication required');
      const { otp } = req.body;
      const result = await authService.verifyAgentChangePasswordOtp(req.user.userId, otp);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async resendChangePasswordOtp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new ValidationError('Authentication required');
      const result = await authService.resendAgentChangePasswordOtp(req.user.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/agent/auth/reset-password:
   *   post:
   *     summary: Step 3 - Set new password
   *     description: Sets a new password using the reset token from step 2. Invalidates all active sessions.
   *     tags: [Agent Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [resetToken, newPassword]
   *             properties:
   *               resetToken:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 example: "NewSecurePass@123"
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetAgentPassword(req.body);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError('Authentication required');
      }

      const data = await agentProfileService.getAgentProfile(authUser.userId);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }
}

const agentAuthController = new AgentAuthController();
export default agentAuthController;

