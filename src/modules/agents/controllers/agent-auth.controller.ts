import { NextFunction, Response } from 'express';
import authController from '../../auth/controllers/auth.controller';
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

