export enum WorkflowType {
  REVIEW = "REVIEW",
  APPROVAL = "APPROVAL",
}

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
  type?: WorkflowType;
  escalationMinutes?: number;
  order: number;
  assignees: WorkflowAssigneeDto[];
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  type: WorkflowType;
  processType?: WorkflowProcessType;
  action?: string;
  branchId?: string;
  departmentId?: string;
  escalationMinutes?: number;
  hasPtaRequest?: boolean;
  stages: WorkflowStageDto[];
}

export interface UpdateWorkflowDto extends CreateWorkflowDto {}
