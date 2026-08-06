import { NotificationChannel, NotificationPriority } from '@prisma/client';

export interface NotificationTemplate {
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  actionUrl?: string;
}

export const NotificationTemplates = {
  // User Registration & Authentication
  WELCOME: (data: { firstName: string }): NotificationTemplate => ({
    title: 'Welcome to Sochatoa! 🎉',
    body: `Hi ${data.firstName}! Welcome to Sochatoa. Your account has been created successfully.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: '/dashboard',
  }),

  EMAIL_VERIFIED: (data: { firstName: string }): NotificationTemplate => ({
    title: 'Email Verified',
    body: `${data.firstName}, your email has been verified successfully.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
  }),

  PHONE_VERIFIED: (data: { firstName: string }): NotificationTemplate => ({
    title: 'Phone Number Verified',
    body: `${data.firstName}, your phone number has been verified successfully.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
  }),

  PASSWORD_RESET_REQUESTED: (): NotificationTemplate => ({
    title: 'Password Reset Requested',
    body: 'A password reset was requested for your account. If this was not you, please contact support immediately.',
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
  }),

  PASSWORD_RESET_COMPLETED: (): NotificationTemplate => ({
    title: 'Password Changed',
    body: 'Your password has been changed successfully.',
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
  }),

  // KYC Notifications
  KYC_SUBMITTED: (data: { firstName: string }): NotificationTemplate => ({
    title: 'KYC Submitted',
    body: `${data.firstName}, your KYC documents have been submitted and are under review.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: '/profile/kyc',
  }),

  KYC_APPROVED: (data: { firstName: string }): NotificationTemplate => ({
    title: 'KYC Approved ✅',
    body: `Great news ${data.firstName}! Your KYC has been approved. You can now create transactions.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: '/transactions/new',
  }),

  KYC_REJECTED: (data: { firstName: string; reason?: string }): NotificationTemplate => ({
    title: 'KYC Rejected',
    body: `${data.firstName}, your KYC has been rejected. ${data.reason ? `Reason: ${data.reason}` : 'Please review and resubmit.'}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: '/profile/kyc',
  }),

  BVN_VERIFIED: (data: { firstName: string }): NotificationTemplate => ({
    title: 'BVN Verified',
    body: `${data.firstName}, your BVN has been verified successfully.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
  }),

  // Transaction Lifecycle
  TRANSACTION_CREATED: (data: {
    referenceNumber: string;
    amount: string;
    currency: string;
  }): NotificationTemplate => ({
    title: 'Transaction Created',
    body: `Transaction ${data.referenceNumber} for ${data.currency} ${data.amount} has been created.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_SUBMITTED: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Transaction Submitted',
    body: `Transaction ${data.referenceNumber} has been submitted for verification.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  VERIFICATION_IN_PROGRESS: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Verification In Progress',
    body: `Your transaction ${data.referenceNumber} is being verified. This may take a few minutes.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  VERIFICATION_COMPLETED: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Verification Complete ✅',
    body: `Document verification for transaction ${data.referenceNumber} is complete.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  VERIFICATION_FAILED: (data: { referenceNumber: string; reason?: string }): NotificationTemplate => ({
    title: 'Verification Failed',
    body: `Verification failed for transaction ${data.referenceNumber}. ${data.reason || 'Please review and resubmit documents.'}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  AWAITING_DEPOSIT: (data: {
    referenceNumber: string;
    amount: string;
    currency: string;
  }): NotificationTemplate => ({
    title: 'Deposit Required',
    body: `Please deposit NGN ${data.amount} for transaction ${data.referenceNumber}.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  DEPOSIT_RECEIVED: (data: { referenceNumber: string; amount: string }): NotificationTemplate => ({
    title: 'Deposit Received',
    body: `We've received your deposit of NGN ${data.amount} for transaction ${data.referenceNumber}.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  DEPOSIT_CONFIRMED: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Deposit Confirmed ✅',
    body: `Your deposit for transaction ${data.referenceNumber} has been confirmed.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  COMPLIANCE_REVIEW: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Compliance Review Required',
    body: `Transaction ${data.referenceNumber} requires compliance review. This may take 24-48 hours.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  ADMIN_APPROVAL_PENDING: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Pending Admin Approval',
    body: `Transaction ${data.referenceNumber} is pending admin approval.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_APPROVED: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Transaction Approved ✅',
    body: `Great news! Transaction ${data.referenceNumber} has been approved.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_REJECTED: (data: { referenceNumber: string; reason?: string }): NotificationTemplate => ({
    title: 'Transaction Rejected',
    body: `Transaction ${data.referenceNumber} has been rejected. ${data.reason ? `Reason: ${data.reason}` : ''}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_REVERSED: (data: { referenceNumber: string; reason?: string }): NotificationTemplate => ({
    title: 'Deposit Reversed',
    body: `The deposit for transaction ${data.referenceNumber} has been reversed. ${data.reason ? `Reason: ${data.reason}` : 'Please contact support if you have questions.'}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  DISBURSEMENT_IN_PROGRESS: (data: {
    referenceNumber: string;
    method: string;
  }): NotificationTemplate => ({
    title: 'Disbursement In Progress',
    body: `Your funds for transaction ${data.referenceNumber} are being disbursed via ${data.method}.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_COMPLETED: (data: {
    referenceNumber: string;
    amount: string;
    currency: string;
  }): NotificationTemplate => ({
    title: 'Transaction Completed 🎉',
    body: `Transaction ${data.referenceNumber} for ${data.currency} ${data.amount} has been completed successfully!`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  TRANSACTION_CANCELLED: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Transaction Cancelled',
    body: `Transaction ${data.referenceNumber} has been cancelled.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  // Payment & Disbursement
  CASH_PICKUP_READY: (data: {
    referenceNumber: string;
    pickupCode: string;
    location: string;
  }): NotificationTemplate => ({
    title: 'Cash Pickup Ready 💵',
    body: `Your cash is ready for pickup at ${data.location}. Pickup code: ${data.pickupCode}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  PREPAID_CARD_READY: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Prepaid Card Ready 💳',
    body: `Your prepaid card for transaction ${data.referenceNumber} is ready.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  BANK_TRANSFER_INITIATED: (data: { referenceNumber: string; bank: string }): NotificationTemplate => ({
    title: 'Bank Transfer Initiated',
    body: `Bank transfer to ${data.bank} for transaction ${data.referenceNumber} has been initiated.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  // Compliance & AML
  AML_FLAG_RAISED: (data: { referenceNumber: string; severity: string }): NotificationTemplate => ({
    title: 'Compliance Alert',
    body: `Your transaction ${data.referenceNumber} requires additional compliance review.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.HIGH,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  COMPLIANCE_REVIEW_COMPLETE: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Compliance Review Complete',
    body: `Compliance review for transaction ${data.referenceNumber} is complete.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.NORMAL,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  ADDITIONAL_INFO_REQUIRED: (data: { referenceNumber: string; info: string }): NotificationTemplate => ({
    title: 'Additional Information Required',
    body: `Transaction ${data.referenceNumber} requires additional information: ${data.info}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
    actionUrl: `transactions/detail/${data.referenceNumber}`,
  }),

  // Account & Security
  LOGIN_ALERT: (data: { location: string; device: string; time: string }): NotificationTemplate => ({
    title: 'New Login Detected',
    body: `New login from ${data.device} in ${data.location} at ${data.time}. If this wasn't you, please secure your account immediately.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
  }),

  ACCOUNT_SUSPENDED: (data: { reason?: string }): NotificationTemplate => ({
    title: 'Account Suspended',
    body: `Your account has been suspended. ${data.reason ? `Reason: ${data.reason}` : 'Please contact support for assistance.'}`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.URGENT,
    actionUrl: '/support',
  }),

  ACCOUNT_ACTIVATED: (): NotificationTemplate => ({
    title: 'Account Activated',
    body: 'Your account has been activated. You can now use all features.',
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.HIGH,
    actionUrl: '/dashboard',
  }),

  // Support & Tickets
  TICKET_CREATED: (data: { ticketReference: string }): NotificationTemplate => ({
    title: 'Support Ticket Created',
    body: `Your support ticket ${data.ticketReference} has been created. We'll respond shortly.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `/support/tickets/${data.ticketReference}`,
  }),

  TICKET_UPDATED: (data: { ticketReference: string }): NotificationTemplate => ({
    title: 'Ticket Updated',
    body: `Your support ticket ${data.ticketReference} has been updated.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `/support/tickets/${data.ticketReference}`,
  }),

  TICKET_RESOLVED: (data: { ticketReference: string }): NotificationTemplate => ({
    title: 'Ticket Resolved',
    body: `Your support ticket ${data.ticketReference} has been resolved.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
    actionUrl: `/support/tickets/${data.ticketReference}`,
  }),

  // Admin Notifications
  NEW_TRANSACTION_ADMIN: (data: {
    referenceNumber: string;
    amount: string;
    type: string;
    customerName?: string;
  }): NotificationTemplate => ({
    title: 'New Transaction Requires Review',
    body: `${data.type} transaction ${data.referenceNumber} for NGN ${data.amount}${data.customerName ? ` from ${data.customerName}` : ''} requires your review.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.HIGH,
    actionUrl: `/admin/transactions/${data.referenceNumber}`,
  }),

  COMPLIANCE_REVIEW_REQUIRED_ADMIN: (data: { referenceNumber: string }): NotificationTemplate => ({
    title: 'Compliance Review Required',
    body: `Transaction ${data.referenceNumber} requires compliance officer review.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.URGENT,
    actionUrl: `/admin/compliance/${data.referenceNumber}`,
  }),

  SETTLEMENT_PENDING_ADMIN: (data: {
    referenceNumber: string;
    amount: string;
  }): NotificationTemplate => ({
    title: 'Settlement Requires Confirmation',
    body: `Settlement of NGN ${data.amount} for transaction ${data.referenceNumber} requires confirmation.`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.HIGH,
    actionUrl: `/admin/settlements/${data.referenceNumber}`,
  }),

  TICKET_ASSIGNED_ADMIN: (data: {
    ticketReference: string;
    ticketId: string;
    customerName?: string;
    priority?: string;
  }): NotificationTemplate => ({
    title: `${data.priority ? `[${data.priority}] ` : ''}Ticket Assigned`,
    body: `Support ticket ${data.ticketReference}${data.customerName ? ` for ${data.customerName}` : ''} has been assigned to you.`,
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.HIGH,
    actionUrl: `/admin/tickets/${data.ticketId}`,
  }),

  // System Notifications
  SYSTEM_MAINTENANCE: (data: { startTime: string; duration: string }): NotificationTemplate => ({
    title: 'Scheduled Maintenance',
    body: `System maintenance scheduled for ${data.startTime}. Expected duration: ${data.duration}.`,
    channel: NotificationChannel.ALL,
    priority: NotificationPriority.NORMAL,
  }),

  RATE_UPDATE: (data: { currency: string; newRate: string }): NotificationTemplate => ({
    title: 'Exchange Rate Updated',
    body: `New ${data.currency} rate: ${data.newRate}`,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.LOW,
  }),
};

export default NotificationTemplates;
