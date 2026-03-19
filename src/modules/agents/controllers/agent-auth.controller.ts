import { NextFunction, Response } from 'express';
import authController from '../../auth/controllers/auth.controller';
import { AuthRequest } from '../../../shared/middleware';

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
}

const agentAuthController = new AgentAuthController();
export default agentAuthController;

