export enum WorkflowProcessType {
  RIGID_LINEAR = "RIGID_LINEAR",
  FLEXIBLE = "FLEXIBLE",
}

export interface WorkflowAssigneeDto {
  id?: string;
  adminId: string;
  order?: number;
}

export interface WorkflowStageDto {
  id?: string;
  name?: string;
  type?: string;
  escalationMinutes?: number;
  escalationAdminId?: string;
  order: number;
  assignees: WorkflowAssigneeDto[];
}

export enum ApprovalType {
  TRANSACTION = "TRANSACTION",
  REFUND = "REFUND",
  RATE = "RATE",
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  type: string;
  approvalType?: ApprovalType;
  minAmount?: number;
  maxAmount?: number;
  processType?: WorkflowProcessType;
  action?: string;
  branchId?: string;
  departmentId?: string;
  escalationMinutes?: number;
  hasPtaRequest?: boolean;
  stages: WorkflowStageDto[];
}

export interface UpdateWorkflowDto extends CreateWorkflowDto {}
