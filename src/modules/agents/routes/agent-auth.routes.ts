import { Router } from 'express';
import agentAuthController from '../controllers/agent-auth.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const AgentAuthRouter: Router = Router();

// All routes require authenticated agent
AgentAuthRouter.use(authenticate, authorize(UserRole.AGENT));

AgentAuthRouter.get('/profile', agentAuthController.getProfile);

AgentAuthRouter.post('/change-password', agentAuthController.changeAgentPassword);

export default AgentAuthRouter;

