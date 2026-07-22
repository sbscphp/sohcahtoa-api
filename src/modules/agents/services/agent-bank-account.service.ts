import { getDatabase } from '../../../config/database';
import { ValidationError, NotFoundError } from '../../../shared/utils';
import { customerBankAccountService } from '../../customer/services/customer-bank-account.service';

const prisma = getDatabase();

/**
 * Resolve the agent record from the authenticated user ID, then verify
 * that the given customerId belongs to a customer created by that agent.
 * Returns the customer's userId for downstream operations.
 */
async function resolveCustomerForAgent(agentUserId: string, customerId: string): Promise<string> {
  // Resolve Agent record from the authenticated user (agents log in as Users with role AGENT)
  const agentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { email: true } });
  if (!agentUser) throw new NotFoundError('Agent not found');

  const agent = await (prisma as any).agent.findUnique({
    where: { email: agentUser.email },
    select: { id: true },
  });
  if (!agent) throw new NotFoundError('Agent profile not found');

  // Confirm the customer was created by this agent
  const customer = await prisma.user.findFirst({
    where: { id: customerId, createdByAgentId: agent.id },
    select: { id: true },
  });
  if (!customer) throw new NotFoundError('Customer not found or not managed by this agent');

  return customer.id;
}

export const agentBankAccountService = {
  /**
   * Add a bank account for a customer on the agent's behalf.
   */
  async addBankAccount(
    agentUserId: string,
    customerId: string,
    data: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      currency?: string;
      swiftCode?: string;
      iban?: string;
      routingNumber?: string;
      bankAddress?: string;
    }
  ) {
    const userId = await resolveCustomerForAgent(agentUserId, customerId);
    return customerBankAccountService.addBankAccount(userId, data);
  },

  /**
   * List bank accounts for a customer.
   */
  async listBankAccounts(agentUserId: string, customerId: string, currency?: string) {
    const userId = await resolveCustomerForAgent(agentUserId, customerId);
    return customerBankAccountService.listBankAccounts(userId, currency);
  },

  /**
   * Remove a bank account from a customer's profile.
   */
  async deleteBankAccount(agentUserId: string, customerId: string, bankAccountId: string) {
    const userId = await resolveCustomerForAgent(agentUserId, customerId);
    await customerBankAccountService.deleteBankAccount(userId, bankAccountId);
    return { message: 'Bank account removed' };
  },

  /**
   * Set a bank account as the customer's default.
   */
  async setDefault(agentUserId: string, customerId: string, bankAccountId: string) {
    const userId = await resolveCustomerForAgent(agentUserId, customerId);
    return customerBankAccountService.setDefault(userId, bankAccountId);
  },
};
