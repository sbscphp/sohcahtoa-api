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
  currentWorkflowStageId?: string | null;
  disbursementWorkflowStageId?: string | null;
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
 * True while an approval workflow still has a stage waiting on a decision.
 *
 * A stage id is cleared once the last stage approves, so a stage still being set means the request
 * has not been fully approved — whether that is the first stage or the last one.
 */
function hasOutstandingApproval(tx: TransactionStatusSource, disbursementApprovalStatus: string): boolean {
  return (
    disbursementApprovalStatus === "PENDING_APPROVAL" ||
    Boolean(tx.currentWorkflowStageId) ||
    Boolean(tx.disbursementWorkflowStageId)
  );
}

/**
 * Coarse request status shown to admins: Pending, Approved, Rejected or Completed.
 *
 * Approved appears only once the last workflow stage has approved. Anything still moving through
 * the stages — including a disbursement that was just initiated — reports Pending.
 */
export function deriveRequestStatus(tx: TransactionStatusSource): string {
  const status = tx.status ? String(tx.status) : "";
  const disbursementApprovalStatus = tx.disbursementApprovalStatus
    ? String(tx.disbursementApprovalStatus)
    : "";

  if (status === "REJECTED" || disbursementApprovalStatus === "REJECTED") return "Rejected";
  if (COMPLETED_STATUSES.has(status)) return "Completed";
  if (hasOutstandingApproval(tx, disbursementApprovalStatus)) return "Pending";
  if (disbursementApprovalStatus === "APPROVED" || APPROVED_STATUSES.has(status)) return "Approved";
  return "Pending";
}
