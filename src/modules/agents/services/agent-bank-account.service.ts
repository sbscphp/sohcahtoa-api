import { getDatabase } from '../../../config/database';
import { ValidationError, NotFoundError } from '../../../shared/utils';
import { UserRole } from '../../../shared/types';

const prisma = getDatabase();

interface AgentBankAccountInput {
  bankName: string;
  accountNumber: string;
  accountName: string;
  currency?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  bankAddress?: string;
  isDefault?: boolean;
}

async function resolveAgentId(agentUserId: string): Promise<string> {
  // Agents authenticate as Users with role AGENT; resolve to Agent record via email
  const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
  if (!agentUser || agentUser.role !== UserRole.AGENT) {
    throw new ValidationError('Only agents can manage bank accounts');
  }
  const agent = await (prisma as any).agent.findUnique({
    where: { email: agentUser.email },
    select: { id: true },
  });
  if (!agent) throw new NotFoundError('Agent profile not found');
  return agent.id;
}

export const agentBankAccountService = {
  async addBankAccount(agentUserId: string, input: AgentBankAccountInput) {
    const agentId = await resolveAgentId(agentUserId);

    const isNgn = !input.currency || input.currency === 'NGN';
    if (isNgn && !/^\d{10}$/.test(input.accountNumber)) {
      throw new ValidationError('Nigerian account numbers must be exactly 10 digits');
    }

    const existing = await (prisma as any).agentBankAccount.findFirst({
      where: { agentId, accountNumber: input.accountNumber },
    });
    if (existing) throw new ValidationError('Account number already saved');

    if (input.isDefault) {
      await (prisma as any).agentBankAccount.updateMany({ where: { agentId }, data: { isDefault: false } });
    }

    return (prisma as any).agentBankAccount.create({
      data: {
        agentId,
        bankName:      input.bankName,
        accountNumber: input.accountNumber,
        accountName:   input.accountName,
        currency:      input.currency || 'NGN',
        swiftCode:     input.swiftCode,
        iban:          input.iban,
        routingNumber: input.routingNumber,
        bankAddress:   input.bankAddress,
        isDefault:     input.isDefault ?? false,
      },
    });
  },

  async listBankAccounts(agentUserId: string, currency?: string) {
    const agentId = await resolveAgentId(agentUserId);
    const where: any = { agentId };

    if (currency) {
      const cur = currency.toUpperCase();
      if (cur === 'NGN') {
        where.AND = [{ OR: [{ currency: 'NGN' }, { currency: null }] }, { swiftCode: null }, { iban: null }, { routingNumber: null }];
      } else if (cur === 'FOREIGN') {
        where.OR = [
          { currency: { not: null, notIn: ['NGN'] } },
          { swiftCode: { not: null } },
          { iban: { not: null } },
          { routingNumber: { not: null } },
        ];
      } else {
        where.currency = cur;
      }
    }

    return (prisma as any).agentBankAccount.findMany({ where, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  },

  async updateBankAccount(agentUserId: string, accountId: string, input: Partial<AgentBankAccountInput>) {
    const agentId = await resolveAgentId(agentUserId);
    const account = await (prisma as any).agentBankAccount.findFirst({ where: { id: accountId, agentId } });
    if (!account) throw new NotFoundError('Bank account not found');

    if (input.isDefault) {
      await (prisma as any).agentBankAccount.updateMany({ where: { agentId }, data: { isDefault: false } });
    }

    return (prisma as any).agentBankAccount.update({
      where: { id: accountId },
      data: {
        ...(input.bankName      !== undefined && { bankName: input.bankName }),
        ...(input.accountName   !== undefined && { accountName: input.accountName }),
        ...(input.currency      !== undefined && { currency: input.currency }),
        ...(input.swiftCode     !== undefined && { swiftCode: input.swiftCode }),
        ...(input.iban          !== undefined && { iban: input.iban }),
        ...(input.routingNumber !== undefined && { routingNumber: input.routingNumber }),
        ...(input.bankAddress   !== undefined && { bankAddress: input.bankAddress }),
        ...(input.isDefault     !== undefined && { isDefault: input.isDefault }),
      },
    });
  },

  async deleteBankAccount(agentUserId: string, accountId: string) {
    const agentId = await resolveAgentId(agentUserId);
    const account = await (prisma as any).agentBankAccount.findFirst({ where: { id: accountId, agentId } });
    if (!account) throw new NotFoundError('Bank account not found');
    await (prisma as any).agentBankAccount.delete({ where: { id: accountId } });
    return { message: 'Bank account removed' };
  },

  async setDefault(agentUserId: string, accountId: string) {
    const agentId = await resolveAgentId(agentUserId);
    const account = await (prisma as any).agentBankAccount.findFirst({ where: { id: accountId, agentId } });
    if (!account) throw new NotFoundError('Bank account not found');
    await (prisma as any).agentBankAccount.updateMany({ where: { agentId }, data: { isDefault: false } });
    return (prisma as any).agentBankAccount.update({ where: { id: accountId }, data: { isDefault: true } });
  },
};
