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
    branch?: string;
    department?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export class RoleQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: any;
}

export class CreateDepartmentDto {
    name!: string;
    departmentEmail?: string;
    description?: string;
    branch?: string;
    isDefault: boolean = false;
}

export class UpdateDepartmentDto {
    name?: string;
    departmentEmail?: string;
    description?: string;
    branch?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export class DepartmentQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: any;
}

export class AdminUserQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    fullName?: string;
    email?: string;
    role?: string;
    department?: string;
    isActive?: any;
    status?: any;
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
