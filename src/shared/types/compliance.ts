export enum AmlCheckStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FLAGGED = 'FLAGGED',
  FAILED = 'FAILED',
}

export enum AmlFlagSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ComplianceReviewStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REQUIRES_MORE_INFO = 'REQUIRES_MORE_INFO',
}

export interface AmlCheckRequest {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  transactionType: string;
  sourceOfFunds: string;
}

export interface AmlCheckResponse {
  checkId: string;
  transactionId: string;
  status: AmlCheckStatus;
  riskScore: number;
  flags: AmlFlag[];
  recommendations: string[];
  checkedAt: string;
}

export interface AmlFlag {
  id: string;
  type: AmlFlagType;
  severity: AmlFlagSeverity;
  description: string;
  details: any;
  createdAt: string;
}

export enum AmlFlagType {
  THRESHOLD_EXCEEDED = 'THRESHOLD_EXCEEDED',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  HIGH_RISK_COUNTRY = 'HIGH_RISK_COUNTRY',
  FREQUENT_TRANSACTIONS = 'FREQUENT_TRANSACTIONS',
  STRUCTURING = 'STRUCTURING',
  POLITICALLY_EXPOSED_PERSON = 'POLITICALLY_EXPOSED_PERSON',
  SANCTIONS_LIST = 'SANCTIONS_LIST',
  ADVERSE_MEDIA = 'ADVERSE_MEDIA',
}

export interface ComplianceReview {
  id: string;
  transactionId: string;
  reviewerId: string;
  status: ComplianceReviewStatus;
  notes: string;
  amlCheckId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceOfFundsVerification {
  transactionId: string;
  sourceType: string;
  description: string;
  supportingDocuments: string[];
  verificationStatus: string;
}

export interface NfiuReportRequest {
  transactionId: string;
  userId: string;
  amount: number;
  reportType: string;
  reason: string;
}
