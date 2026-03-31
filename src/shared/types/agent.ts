import { CustomerType, KycStatus } from "./auth";
import { TransactionType } from "./transaction";

export interface AgentCreateNigerianCustomerAccountRequest {
  verificationToken: string;
  password: string;
  customerType?: CustomerType;
}

export interface AgentCustomerListFilters {
  status?: KycStatus | string;
  lastTransactionType?: TransactionType | string;
  customerType?: CustomerType | string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface AgentUpdateCustomerRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

/** GET /api/agent/auth/profile — snake_case fields for API consumers */
export interface AgentSelfProfileResponse {
  id: string;
  email: string;
  phone_number: string;
  date_joined: string;
  last_active: string | null;
  gender: string | null;
  date_of_birth: string | null;
  bvn: string | null;
  tin: string | null;
}

/** GET /api/agent/notifications — one row per Notification record */
export interface AgentNotificationListItem {
  id: string;
  agent_id: string;
  notification_title: string;
  notification_body: string;
  timestamp: string;
  /** Read label from Prisma `Notification.status` (READ → read; DELIVERED and others → unread) */
  status: "unread" | "read";
  notification_type: string;
}

/** POST /api/agent/notifications/:id/read */
export interface AgentMarkNotificationReadResponse {
  id: string;
  message: string;
}

export interface AgentNotificationListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** PUT /api/agent/notifications/preferences — at least one of email or sms */
export interface AgentNotificationPreferencesUpdateBody {
  email?: boolean;
  sms?: boolean;
}

