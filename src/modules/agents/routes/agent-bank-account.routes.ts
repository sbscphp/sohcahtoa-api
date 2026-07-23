import { Router } from 'express';
import { agentBankAccountController } from '../controllers/agent-bank-account.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

router.use(authenticate, authorize(UserRole.AGENT));

// GET    /api/agent/bank-accounts/banks                                   — list Nigerian banks
// GET    /api/agent/bank-accounts/lookup                                  — account name enquiry
// GET    /api/agent/customers/:customerId/bank-accounts                   — list customer accounts
// POST   /api/agent/customers/:customerId/bank-accounts                   — add account for customer
// PATCH  /api/agent/customers/:customerId/bank-accounts/:accountId/default — set default
// DELETE /api/agent/customers/:customerId/bank-accounts/:accountId        — remove account

// Static utility routes — must be before any parameterised routes
router.get('/bank-accounts/banks',  agentBankAccountController.getBanks);
router.get('/bank-accounts/lookup', agentBankAccountController.lookupAccountName);

// Customer-scoped routes
router.get('/customers/:customerId/bank-accounts',                         agentBankAccountController.listBankAccounts);
router.post('/customers/:customerId/bank-accounts',                        agentBankAccountController.addBankAccount);
router.patch('/customers/:customerId/bank-accounts/:accountId/default',    agentBankAccountController.setDefault);
router.delete('/customers/:customerId/bank-accounts/:accountId',           agentBankAccountController.deleteBankAccount);

export default router;
