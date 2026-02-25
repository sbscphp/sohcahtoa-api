export class CreateAdminUserDto {
    email!: string;
    fullName!: string;
    phoneNumber!: string;
    department!: string;
    branch!: string;
    role!: string;
    position?: string;
    altPhoneNumber?: string;
}

export class CreateRoleDto {
    name!: string;
    description!: string;
    permissions?: string[] | Record<string, Record<string, string[]>>;
    branch!: string;
    department!: string;
    isDefault?: boolean;
}

export class UpdateRoleDto {
    name?: string;
    description?: string;
    permissions?: string[] | Record<string, Record<string, string[]>>;
    branches?: string[];
    departments?: string[];
    isDefault?: boolean;
    isActive?: boolean;
}

export class RoleQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
}

export class CreateDepartmentDto {
    name!: string;
    departmentEmail?: string;
    description?: string;
    branch?: string;
}

export class UpdateDepartmentDto {
    name?: string;
    departmentEmail?: string;
    description?: string;
    branch?: string;
    isActive?: boolean;
}

export class DepartmentQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
}

export class UpdateAdminUserDto {
    email?: string;
    fullName?: string;
    phoneNumber?: string;
    department?: string;
    branch?: string;
    role?: string;
    position?: string;
    altPhoneNumber?: string;
    isActive?: boolean;
}
