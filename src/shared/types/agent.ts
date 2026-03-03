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

