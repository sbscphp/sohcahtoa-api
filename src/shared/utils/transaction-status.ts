/**
 * Presentation-level status derivation for transactions.
 *
 * The admin transaction list, transaction detail and wallet ledger views all surface the same
 * `workflowStage` / `requestStatus` pair, so the rules live here to keep the three read paths
 * from drifting apart.
 */

export interface TransactionStatusSource {
  status?: string | null;
  disbursementApprovalStatus?: string | null;
}

/** Statuses that mean the request has been approved and is progressing towards completion. */
const APPROVED_STATUSES = new Set([
  "APPROVED",
  "VERIFICATION_COMPLETED",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PENDING",
  "DEPOSIT_CONFIRMED",
  "AWAITING_DISBURSEMENT",
  "DISBURSEMENT_IN_PROGRESS",
  "PENDING_RECORD_VALIDATION",
]);

/** Statuses that mean the request is closed out. */
const COMPLETED_STATUSES = new Set(["COMPLETED", "REFUNDED", "CANCELLED"]);

/**
 * Label describing where the transaction sits in its workflow.
 */
export function deriveWorkflowStage(tx: TransactionStatusSource): string {
  const status = tx.status ? String(tx.status) : "";
  const disbursementApprovalStatus = tx.disbursementApprovalStatus
    ? String(tx.disbursementApprovalStatus)
    : "";

  if (status === "AWAITING_REFUND_VERIFICATION") return "PENDING_REFUND_APPROVAL";
  if (status === "REFUNDED") return "REFUNDED";
  if (disbursementApprovalStatus === "APPROVED" && status !== "COMPLETED") return "DISBURSEMENT_APPROVED";
  if (disbursementApprovalStatus === "REJECTED") return "DISBURSEMENT_REJECTED";
  return status;
}

/**
 * Coarse request status shown to admins: Pending, Approved, Rejected or Completed.
 *
 * A disbursement awaiting approval reports Pending — initiating a disbursement queues it for a
 * decision, so the request is not approved until that decision is made.
 */
export function deriveRequestStatus(tx: TransactionStatusSource): string {
  const status = tx.status ? String(tx.status) : "";
  const disbursementApprovalStatus = tx.disbursementApprovalStatus
    ? String(tx.disbursementApprovalStatus)
    : "";

  if (status === "REJECTED" || disbursementApprovalStatus === "REJECTED") return "Rejected";
  if (COMPLETED_STATUSES.has(status)) return "Completed";
  if (disbursementApprovalStatus === "PENDING_APPROVAL") return "Pending";
  if (disbursementApprovalStatus === "APPROVED" || APPROVED_STATUSES.has(status)) return "Approved";
  return "Pending";
}
