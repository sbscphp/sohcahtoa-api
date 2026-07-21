import { Router } from 'express';
import { agentBankAccountController } from '../controllers/agent-bank-account.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

router.use(authenticate, authorize(UserRole.AGENT));

// GET  /api/agent/bank-accounts              — list all (filter ?currency=USD|NGN|FOREIGN)
// POST /api/agent/bank-accounts              — add new
// PATCH /api/agent/bank-accounts/:accountId  — update
// DELETE /api/agent/bank-accounts/:accountId — remove
// PATCH /api/agent/bank-accounts/:accountId/default — set as default

router.get('/',    agentBankAccountController.listBankAccounts);
router.post('/',   agentBankAccountController.addBankAccount);
router.patch('/:accountId/default', agentBankAccountController.setDefault);
router.patch('/:accountId',         agentBankAccountController.updateBankAccount);
router.delete('/:accountId',        agentBankAccountController.deleteBankAccount);

export default router;
