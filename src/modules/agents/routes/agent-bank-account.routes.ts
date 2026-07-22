import { Router } from 'express';
import { agentBankAccountController } from '../controllers/agent-bank-account.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

router.use(authenticate, authorize(UserRole.AGENT));

// GET    /api/agent/customers/:customerId/bank-accounts              — list (filter ?currency=USD|NGN|FOREIGN)
// POST   /api/agent/customers/:customerId/bank-accounts              — add new account for customer
// DELETE /api/agent/customers/:customerId/bank-accounts/:accountId   — remove
// PATCH  /api/agent/customers/:customerId/bank-accounts/:accountId/default — set as default

router.get('/customers/:customerId/bank-accounts',                         agentBankAccountController.listBankAccounts);
router.post('/customers/:customerId/bank-accounts',                        agentBankAccountController.addBankAccount);
router.patch('/customers/:customerId/bank-accounts/:accountId/default',    agentBankAccountController.setDefault);
router.delete('/customers/:customerId/bank-accounts/:accountId',           agentBankAccountController.deleteBankAccount);

export default router;
