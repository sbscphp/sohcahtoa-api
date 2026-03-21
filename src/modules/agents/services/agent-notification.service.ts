import { NotificationStatus, NotificationType } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import {
  AgentMarkNotificationReadResponse,
  AgentNotificationListItem,
  AgentNotificationListMeta,
  UserRole,
} from "../../../shared/types";

const prisma = getDatabase();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const NOTIFICATION_TYPES = Object.values(NotificationType);

function parseNotificationTypeFilter(raw: string | undefined): NotificationType | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined;
  }
  const v = String(raw).trim().toUpperCase();
  if (!NOTIFICATION_TYPES.includes(v as NotificationType)) {
    throw new ValidationError(
      `Invalid notification_type. Allowed: ${NOTIFICATION_TYPES.join(", ")}`,
    );
  }
  return v as NotificationType;
}

/** API read label from Prisma `Notification.status`: READ → read, all else → unread */
export function mapNotificationStatusToReadLabel(
  status: NotificationStatus,
): "unread" | "read" {
  return status === NotificationStatus.READ ? "read" : "unread";
}

export class AgentNotificationService {
  async markNotificationRead(
    agentUserId: string,
    notificationId: string,
  ): Promise<AgentMarkNotificationReadResponse> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can update their notifications");
    }

    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId: agentUserId },
    });

    if (!existing) {
      throw new NotFoundError("Notification not found");
    }

    const now = new Date();
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: now,
        status: NotificationStatus.READ,
      },
    });

    return {
      id: notificationId,
      message: "Notification marked as read",
    };
  }

  async listAgentNotifications(
    agentUserId: string,
    page: number,
    limit: number,
    notificationType?: string,
  ): Promise<{ data: AgentNotificationListItem[]; meta: AgentNotificationListMeta }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view their notifications");
    }

    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const safePage = page < 1 ? 1 : page;
    const safeLimit = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const typeFilter = parseNotificationTypeFilter(notificationType);
    const where = {
      userId: agentUserId,
      ...(typeFilter !== undefined ? { type: typeFilter } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    const data: AgentNotificationListItem[] = rows.map((n) => ({
      id: n.id,
      agent_id: agent.id,
      notification_title: n.title,
      notification_body: n.body,
      timestamp: n.createdAt.toISOString(),
      status: mapNotificationStatusToReadLabel(n.status),
      notification_type: n.type,
    }));

    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }
}

const agentNotificationService = new AgentNotificationService();
export default agentNotificationService;
