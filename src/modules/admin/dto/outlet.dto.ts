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
  q?: string;
  search?: string;
  status?: string;
}

export type UpdateFranchiseStatusDto = {
  status: boolean;
};

export class UpdateFranchiseDto {
  franchiseName?: string;
  state?: string;
  address?: string;
  contactPersonName?: string;
  email?: string;
  phoneNumber?: string;
  altPhoneNumber?: string | null;
}

export class PickupStationQueryDto {
  page?: number;
  limit?: number;
  q?: string;
  search?: string;
  state?: string;
  region?: string;
  status?: string;
}

export class CreatePickupStationDto {
  stationName!: string;
  physicalAddress!: string;
  state!: string;
  region!: string;
  stationEmail!: string;
  phoneNumber!: string;
  status?: string;
}

export class UpdatePickupStationDto {
  stationName?: string;
  physicalAddress?: string;
  state?: string;
  region?: string;
  stationEmail?: string;
  phoneNumber?: string;
  status?: string;
  isActive?: boolean;
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
