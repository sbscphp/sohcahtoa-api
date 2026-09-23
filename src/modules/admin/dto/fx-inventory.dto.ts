export class InitiateCashDisbursementDto {
  agentId!: string;
  currency!: string;
  amount!: number;
  purpose?: string;
}

export class DisbursementDecisionDto {
  reason?: string;
}

export class ConfirmCashLodgmentDto {
  confirmedAmount?: number;
  reason?: string;
}

export class LodgmentDecisionDto {
  reason?: string;
}

export class FxInventoryQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  currency?: string;
  branchId?: string;
  agentId?: string;
}
