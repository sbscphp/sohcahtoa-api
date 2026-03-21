import { getDatabase } from "../../../config/database";
import { ValidationError } from "../../../shared/utils";
import { AgentSelfProfileResponse, UserRole } from "../../../shared/types";

const prisma = getDatabase();

export function mapAgentSelfProfile(
  agent: { id: string; createdAt: Date },
  user: {
    email: string;
    phoneNumber: string;
    profile: { dateOfBirth: Date | null } | null;
    kyc: { bvn: string | null; tin: string | null } | null;
  },
  lastSessionCreatedAt: Date | null,
): AgentSelfProfileResponse {
  return {
    id: agent.id,
    email: user.email,
    phone_number: user.phoneNumber,
    date_joined: agent.createdAt.toISOString(),
    last_active: lastSessionCreatedAt ? lastSessionCreatedAt.toISOString() : null,
    gender: null,
    date_of_birth: user.profile?.dateOfBirth ? user.profile.dateOfBirth.toISOString() : null,
    bvn: user.kyc?.bvn ?? null,
    tin: user.kyc?.tin ?? null,
  };
}

export class AgentProfileService {
  async getAgentProfile(agentUserId: string): Promise<AgentSelfProfileResponse> {
    const agentUser = await prisma.user.findUnique({
      where: { id: agentUserId },
      include: {
        profile: { select: { dateOfBirth: true } },
        kyc: { select: { bvn: true, tin: true } },
      },
    });

    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view this profile");
    }

    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const latestSession = await prisma.session.findFirst({
      where: { userId: agentUserId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return mapAgentSelfProfile(agent, agentUser, latestSession?.createdAt ?? null);
  }
}

const agentProfileService = new AgentProfileService();
export default agentProfileService;
