import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Resolves the standard "internal control / compliance" admin distribution list:
 * INTERNAL_CONTROL_EMAIL env var + the default control mailbox + every active
 * admin user in a Compliance, Internal Control, or Super Admin role/department.
 * Shared by the flagged-transaction, transaction-initiated, and transaction-activity emails.
 */
export async function getComplianceAdminEmails(): Promise<string[]> {
  const recipients = new Set<string>();

  if (process.env.INTERNAL_CONTROL_EMAIL) {
    recipients.add(process.env.INTERNAL_CONTROL_EMAIL.trim());
  }
  recipients.add('internalcontrol@sohcahtoabdc.com');

  const controlAdmins = await prisma.adminUser.findMany({
    where: {
      OR: [
        { role: { name: { in: ['Internal Control', 'Internal_Control', 'Compliance', 'Compliance Officer', 'Super Admin'], mode: 'insensitive' } } },
        { department: { name: { in: ['Internal Control', 'Compliance', 'Control'], mode: 'insensitive' } } },
      ],
      isActive: true,
    },
    select: { email: true },
  }).catch(() => []);

  for (const admin of controlAdmins) {
    if (admin?.email) recipients.add(admin.email.trim());
  }

  return [...recipients];
}
