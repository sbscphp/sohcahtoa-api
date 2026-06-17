import { Router } from 'express';
import agentAuthController from '../controllers/agent-auth.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const AgentAuthRouter: Router = Router();

// Public routes (no JWT required)
AgentAuthRouter.post('/forgot-password', agentAuthController.forgotPassword);
AgentAuthRouter.post('/forgot-password/verify', agentAuthController.verifyForgotPasswordOtp);
AgentAuthRouter.post('/reset-password', agentAuthController.resetPassword);

// All routes below require authenticated agent
AgentAuthRouter.use(authenticate, authorize(UserRole.AGENT));

AgentAuthRouter.get('/profile', agentAuthController.getProfile);
AgentAuthRouter.post('/change-password', agentAuthController.changeAgentPassword);
AgentAuthRouter.post('/otp/change-password', agentAuthController.initiateChangePassword);
AgentAuthRouter.post('/otp/verify-change-password', agentAuthController.verifyChangePasswordOtp);
AgentAuthRouter.post('/otp/change-password/resend', agentAuthController.resendChangePasswordOtp);

export default AgentAuthRouter;

