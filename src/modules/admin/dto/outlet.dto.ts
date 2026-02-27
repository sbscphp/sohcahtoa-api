export class CreateFranchiseDto {
  franchiseName!: string;
  state!: string;
  address!: string;
  contactPersonName!: string;
  email!: string;
  phoneNumber!: string;
  altPhoneNumber?: string;
}

export class FranchiseQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export class UpdateFranchiseStatusDto {
  status!: string;
}

export class CreateBranchDto {
  branchName!: string;
  branchEmail?: string;
  state!: string;
  address!: string;
  branchManager!: string;
  email!: string;
  phoneNumber!: string;
  agentName?: string;
  agentEmail?: string;
  agentPhoneNumber?: string;
  franchiseId?: string;
}
