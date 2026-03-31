import type { NotificationPreference } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { ValidationError } from "../../../shared/utils";
import { UserRole } from "../../../shared/types";
import type { UpdateAgentNotificationPreferencesDto } from "../dto/agent-notification-preference.dto";

const prisma = getDatabase();

async function ensureAgent(agentUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: agentUserId } });
  if (!user || user.role !== UserRole.AGENT) {
    throw new ValidationError("Only agents can access notification preferences");
  }
}

function buildEmailSmsPatches(body: UpdateAgentNotificationPreferencesDto) {
  const createUpdate: Partial<
    Pick<
      NotificationPreference,
      | "emailEnabled"
      | "emailTransactional"
      | "emailMarketing"
      | "emailSecurity"
      | "smsEnabled"
      | "smsTransactional"
      | "smsMarketing"
      | "smsSecurity"
    >
  > = {};

  if (body.email !== undefined) {
    createUpdate.emailEnabled = body.email;
    createUpdate.emailTransactional = body.email;
    createUpdate.emailMarketing = body.email;
    createUpdate.emailSecurity = body.email;
  }

  if (body.sms !== undefined) {
    createUpdate.smsEnabled = body.sms;
    createUpdate.smsTransactional = body.sms;
    createUpdate.smsMarketing = body.sms;
    createUpdate.smsSecurity = body.sms;
  }

  return createUpdate;
}

export class AgentNotificationPreferenceService {
  async getAgentNotificationPreferences(agentUserId: string): Promise<NotificationPreference> {
    await ensureAgent(agentUserId);

    let row = await prisma.notificationPreference.findUnique({
      where: { userId: agentUserId },
    });

    if (!row) {
      row = await prisma.notificationPreference.create({
        data: { userId: agentUserId },
      });
    }

    return row;
  }

  async updateAgentNotificationPreferences(
    agentUserId: string,
    body: UpdateAgentNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    await ensureAgent(agentUserId);

    const patches = buildEmailSmsPatches(body);

    return prisma.notificationPreference.upsert({
      where: { userId: agentUserId },
      create: {
        userId: agentUserId,
        ...patches,
      },
      update: patches,
    });
  }
}

const agentNotificationPreferenceService = new AgentNotificationPreferenceService();
export default agentNotificationPreferenceService;
