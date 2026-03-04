import { createLogger } from "../../../shared/utils";
import { EventType, ServiceName, UserRole } from "../../../shared/types";
import { PrismaClient, AdminUser, Prisma } from "@prisma/client";
import { CreateAdminUserDto, CreateRoleDto, UpdateRoleDto, RoleQueryDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from "../dto/user-management.dto";
import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { generateId, DuplicateError, NotFoundError, BadRequestError, paginate } from '../../../shared/utils';
import { emailService } from '../../../shared/utils';


const logger = createLogger(ServiceName.ADMIN);

class UserManagementService {
    constructor(private readonly prisma: PrismaClient) { }

    addUser = async (body: CreateAdminUserDto) => {
        try {
            const result = await this.prisma.$transaction(async tx => {

                const existingByEmail = await tx.adminUser.findUnique({ where: { email: body.email } });
                if (existingByEmail) {
                    throw new DuplicateError("Admin user with this email already exists");
                }
                if (body.phoneNumber) {
                    const existingByPhone = await tx.adminUser.findFirst({ where: { phoneNumber: body.phoneNumber } });
                    if (existingByPhone) {
                        throw new DuplicateError("Admin user with this phone number already exists");
                    }
                }

                const role = await tx.role.findFirst({
                    where: {
                        name: { equals: body.role, mode: "insensitive" },
                        isActive: true,
                    },
                });

                if (!role) {
                    throw new NotFoundError(`Role '${body.role}' not found`);
                }

                const department = await tx.department.findFirst({
                    where: {
                        name: { equals: body.department, mode: "insensitive" },
                        isActive: true,
                    },
                });

                if (!department) {
                    throw new NotFoundError(`Department '${body.department}' not found`);
                }

                const user = await tx.adminUser.create({
                    data: {
                        email: body.email,
                        fullName: body.fullName,
                        phoneNumber: body.phoneNumber,
                        branch: body.branch,
                        position: body.position,
                        altPhoneNumber: body.altPhoneNumber,
                        roleId: role.id,
                        departmentId: department.id,
                    },
                });

                await tx.outboxEvent.create({
                    data: {
                        id: generateId(),
                        eventType: EventType.USER_REGISTERED,
                        source: ServiceName.ADMIN,
                        aggregateId: user.id,
                        payload: {
                            userId: user.id,
                            email: user.email,
                            fullName: user.fullName,
                        },
                    },
                });

            return user;
        });

        const rolePermissions = await this.getRolePermissions(result.roleId, "grouped");

        logger.info("Admin user created with outbox event", {
            adminUserId: result.id,
        });

        if (emailService.isReady()) {
            const resetPasswordUrl =
                `${process.env.ADMIN_FRONTEND_URL ?? "http://localhost:3000"}/reset-password`;

            emailService
                .sendAdminWelcomeEmail(result.email, result.fullName, resetPasswordUrl)
                .catch(err =>
                    logger.warn("Welcome email failed", {
                        userId: result.id,
                        message: err.message,
                    }),
                );
        }

        return { user: result, rolePermissions };
        } catch (error) {
            if ((error as any)?.code === "P2002") {
                const target = (error as any)?.meta?.target || "unique field";
                const message = `Admin user with this ${Array.isArray(target) ? target.join(", ") : target} already exists`;
                throw new DuplicateError(message);
            }
            logger.error("Failed to create admin user", { error });
            throw error;
        }
    };


    getProfile = async (userId: string) => {
        try {
            const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            const { password: _password, ...userWithoutPassword } = user;
            const rolePermissions = await this.getRolePermissions(user.roleId, "grouped");
            return { ...userWithoutPassword, rolePermissions };
        } catch (error) {
            logger.error("Failed to get admin profile", {
                userId,
                message: (error as Error).message,
            });
            throw error;
        }
    };

    getAllUsers = async (page: number = 1, limit: number = 10) => {
        try {
            return await paginate(
                this.prisma.adminUser,
                {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        role: { select: { name: true } },
                        department: { select: { name: true } },
                    },
                },
                { page, limit },
                async (users: any[]) => {
                    return users.map((user) => {
                        const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user;
                        const roleName = user.role?.name || null;
                        const departmentName = user.department?.name || null;
                        return { ...userWithoutPassword, roleName, departmentName };
                    });
                }
            );
        } catch (error) {
            logger.error("Failed to get all admin users", {
                message: (error as Error).message,
            });
            throw error;
        }
    };

    updateUser = async (id: string, data: import("../dto/user-management.dto").UpdateAdminUserDto) => {
        try {
            const existing = await this.prisma.adminUser.findUnique({ where: { id } });
            if (!existing) {
                throw new NotFoundError("User not found");
            }
            if (data.email && data.email !== existing.email) {
                const byEmail = await this.prisma.adminUser.findUnique({ where: { email: data.email } });
                if (byEmail) throw new DuplicateError("Admin user with this email already exists");
            }
            if (data.phoneNumber && data.phoneNumber !== existing.phoneNumber) {
                const byPhone = await this.prisma.adminUser.findFirst({ where: { phoneNumber: data.phoneNumber } });
                if (byPhone) throw new DuplicateError("Admin user with this phone number already exists");
            }
            let roleId: string | undefined = undefined;
            if (data.role) {
                const role = await this.prisma.role.findFirst({
                    where: { name: { equals: data.role, mode: "insensitive" }, isActive: true },
                });
                if (!role) throw new NotFoundError(`Role '${data.role}' not found`);
                roleId = role.id;
            }
            let departmentId: string | undefined = undefined;
            if (data.department) {
                const department = await this.prisma.department.findFirst({
                    where: { name: { equals: data.department, mode: "insensitive" }, isActive: true },
                });
                if (!department) throw new NotFoundError(`Department '${data.department}' not found`);
                departmentId = department.id;
            }
            const updated = await this.prisma.adminUser.update({
                where: { id },
                data: {
                    email: data.email ?? undefined,
                    fullName: data.fullName ?? undefined,
                    phoneNumber: data.phoneNumber ?? undefined,
                    branch: data.branch ?? undefined,
                    position: data.position ?? undefined,
                    altPhoneNumber: data.altPhoneNumber ?? undefined,
                    isActive: typeof data.isActive === "boolean" ? data.isActive : undefined,
                    roleId: roleId ?? undefined,
                    departmentId: departmentId ?? undefined,
                },
            });
            const rolePermissions = await this.getRolePermissions(updated.roleId, "grouped");
            const result: any = { user: updated, rolePermissions };
            return result;
        } catch (error) {
            logger.error("Failed to update admin user", { id, error });
            throw error;
        }
    };

    toggleUserActive = async (id: string, isActive: boolean) => {
        try {
            const existing = await this.prisma.adminUser.findUnique({ where: { id } });
            if (!existing) {
                throw new NotFoundError("User not found");
            }
            const updated = await this.prisma.adminUser.update({
                where: { id },
                data: { isActive },
            });
            const rolePermissions = await this.getRolePermissions(updated.roleId, "grouped");
            return { user: updated, rolePermissions };
        } catch (error) {
            logger.error("Failed to toggle admin user active status", { id, isActive, error });
            throw error;
        }
    };

    getUserStats = async () => {
        try {
            const [totalUsers, activeUsers, inactiveUsers] = await this.prisma.$transaction([
                this.prisma.adminUser.count(),
                this.prisma.adminUser.count({ where: { isActive: true } }),
                this.prisma.adminUser.count({ where: { isActive: false } }),
            ]);
            return {
                totalUsers,
                activeUsers,
                inactiveUsers,
            };
        } catch (error) {
            logger.error("Failed to get user summary", {
                message: (error as Error).message,
            });
            throw error;
        }
    };

    getUser = async (id: string) => {
        try {
            const user = await this.prisma.adminUser.findUnique({
                where: { id },
                include: {
                    role: { select: { name: true } },
                    department: { select: { name: true } },
                },
            });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user as any;
            const rolePermissions = await this.getRolePermissions(user.roleId, "grouped");
            const roleName = (user as any).role?.name || null;
            const departmentName = (user as any).department?.name || null;
            return { ...userWithoutPassword, roleName, departmentName, rolePermissions };
        } catch (error) {
            logger.error("Failed to get admin user", {
                id,
                message: (error as Error).message,
            });
            throw error;
        }
    };

    getLookups = async (type?: "role" | "department" | "branch") => {
        const roleWhere: any = { isActive: true };
        const deptWhere: any = { isActive: true };
        if (type === "role") {
            const roles = await this.prisma.role.findMany({ where: roleWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
            return { roles };
        }
        if (type === "department") {
            const departments = await this.prisma.department.findMany({ where: deptWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
            return { departments };
        }
        if (type === "branch") {
            const branches = await this.prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
            return { branches };
        }
        const [roles, departments] = await Promise.all([
            this.prisma.role.findMany({ where: roleWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
            this.prisma.department.findMany({ where: deptWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
        ]);
        const branches = await this.prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
        return { roles, departments, branches };
    };

    getAllPermissions = async (query: { search?: string; module?: string; featureKey?: string; action?: string; isActive?: any }) => {
        try {
            const { search, module, featureKey, action, isActive } = query || {};
            const where: any = {};
            if (search) {
                where.OR = [
                    { module: { contains: search, mode: "insensitive" } },
                    { featureKey: { contains: search, mode: "insensitive" } },
                    { action: { contains: search, mode: "insensitive" } },
                ];
            }
            if (module) where.module = { contains: module, mode: "insensitive" };
            if (featureKey) where.featureKey = { contains: featureKey, mode: "insensitive" };
            if (action) where.action = { contains: action, mode: "insensitive" };
            if (isActive !== undefined) {
                where.isActive = typeof isActive === "string" ? isActive === "true" : Boolean(isActive);
            }
            return await this.prisma.permission.findMany({
                where,
                orderBy: { createdAt: "desc" },
            });
        } catch (error) {
            logger.error("Failed to get all permissions", { error });
            throw error;
        }
    };

    exportUsers = async () => {
        const users = await this.prisma.adminUser.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                role: { select: { name: true } },
                department: { select: { name: true } },
            },
        });
        return (users || []).map((u: any) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phoneNumber: u.phoneNumber,
            roleName: u.role?.name || null,
            departmentName: u.department?.name || null,
            isActive: u.isActive,
            createdAt: u.createdAt,
        }));
    };

    exportRoles = async () => {
        const roles = await this.prisma.role.findMany({
            orderBy: { createdAt: "desc" },
            include: { department: { select: { name: true } } },
        });
        return (roles || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description || "",
            branch: r.branch || "",
            departmentName: r.department?.name || "",
            createdBy: r.createdBy || "",
            createdById: r.createdById || null,
            isDefault: !!r.isDefault,
            isActive: !!r.isActive,
            createdAt: r.createdAt,
        }));
    };

    exportDepartments = async () => {
        const depts = await this.prisma.department.findMany({
            orderBy: { createdAt: "desc" },
        });
        return (depts || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            departmentEmail: d.departmentEmail || "",
            description: d.description || "",
            branch: d.branch || "",
            createdBy: d.createdBy || "",
            createdById: d.createdById || null,
            isActive: !!d.isActive,
            createdAt: d.createdAt,
        }));
    };

    // --- Role Management ---

    createRole = async (data: CreateRoleDto, adminId: string) => {
        try {
            const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
            if (existing) {
                throw new DuplicateError("Role with this name already exists");
            }

            if (data.isDefault) {
                await this.prisma.role.updateMany({
                    where: { isDefault: true },
                    data: { isDefault: false },
                });
            }

            let departmentConnect: any = undefined;
            if (data.department) {
                const byId = await this.prisma.department.findUnique({ where: { id: data.department } });
                const dept = byId ?? await this.prisma.department.findUnique({ where: { name: data.department } });
                if (!dept) {
                    throw new NotFoundError("Department not found");
                }
                departmentConnect = { connect: { id: dept.id } };
            }

            const normalizePermissions = (perms?: string[]) => {
                const allowed = new Set(["view", "edit", "create", "update", "delete", "export"]);
                if (!perms) return {};
                if (Array.isArray(perms)) {
                    const result: Record<string, Record<string, string[]>> = {};
                    for (const p of perms) {
                        const s = (p || "").toString();
                        const parts = s.split(" - ").map(x => x.trim());
                        if (parts.length < 3) continue;
                        const module = parts[0];
                        const feature = parts[1];
                        const actionRaw = parts[2].toLowerCase();
                        const action = actionRaw.replace("can ", "");
                        if (!allowed.has(action)) continue;
                        result[module] = result[module] || {};
                        result[module][feature] = result[module][feature] || [];
                        if (!result[module][feature].includes(action)) {
                            result[module][feature].push(action);
                        }
                    }
                    return result;
                }
                const obj = perms as any;
                const result: Record<string, Record<string, string[]>> = {};
                for (const module of Object.keys(obj)) {
                    const features = obj[module] || {};
                    result[module] = {};
                    for (const feature of Object.keys(features)) {
                        const actions = Array.isArray(features[feature]) ? features[feature] : [];
                        const clean = actions
                            .map(a => a?.toString().toLowerCase())
                            .filter(a => a && allowed.has(a));
                        result[module][feature] = Array.from(new Set(clean));
                    }
                }
                return result;
            };

            const permissionsJson = normalizePermissions(data.permissions as any);

            const adminUser = await this.prisma.adminUser.findUnique({ where: { id: adminId } });

            const role = await this.prisma.$transaction(async (tx) => {
                const created = await tx.role.create({
                    data: ({
                        name: data.name,
                        description: data.description,
                        permissions: permissionsJson as any,
                        branch: data.branch,
                        createdBy: adminUser?.fullName,
                        createdById: adminId,
                        department: departmentConnect,
                        isDefault: data.isDefault,
                    } as any),
                });

                const map = permissionsJson as Record<string, Record<string, string[]>>;
                for (const mod of Object.keys(map)) {
                    const features = map[mod] || {};
                    for (const feat of Object.keys(features)) {
                        const actions = features[feat] || [];
                        for (const action of actions) {
                            const found = await tx.permission.findFirst({
                                where: { module: mod, featureKey: feat, action },
                            });
                            const perm = found || await tx.permission.create({
                                data: { module: mod, featureKey: feat, action, label: `${feat} ${action}` },
                            });
                            const exists = await tx.rolePermission.findUnique({
                                where: { roleId_permissionId: { roleId: created.id, permissionId: perm.id } },
                            });
                            if (!exists) {
                                await tx.rolePermission.create({
                                    data: { roleId: created.id, permissionId: perm.id },
                                });
                            }
                        }
                    }
                }

                return created;
            });

            return role;
        } catch (error) {
            logger.error("Failed to create role", { error });
            throw error;
        }
    };

    getAllRoles = async (query: RoleQueryDto) => {
        try {
            const { page = 1, limit = 10, search, isActive } = query;

            const where: Record<string, any> = {};

            if (search) {
                where.name = { contains: search, mode: "insensitive" };
            }

            if (isActive !== undefined) {
                where.isActive =
                    typeof isActive === "string"
                        ? isActive === "true"
                        : Boolean(isActive);
            }

            const countPermissions = (p: any) => {
                if (!p) return 0;
                if (Array.isArray(p)) return p.length;
                if (typeof p === "object") {
                    let count = 0;
                    for (const m of Object.keys(p)) {
                        const features = p[m] || {};
                        for (const f of Object.keys(features)) {
                            const actions = features[f] || [];
                            if (Array.isArray(actions)) count += actions.length;
                        }
                    }
                    return count;
                }
                return 0;
            };

            console.log("here")

            return await paginate(
                this.prisma.role,
                {
                    where,
                    include: {
                        _count: { select: { users: true, rolePermissions: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
                { page, limit },
                (roles) =>
                    roles.map((role: any) => ({
                        ...role,
                        permissionsCount: role?._count?.rolePermissions ?? countPermissions(role.permissions),
                    }))
            );
        } catch (error) {
            logger.error("Failed to get all roles", { error });
            throw error;
        }
    };



    getRole = async (id: string) => {
        try {
            const role = await this.prisma.role.findUnique({
                where: { id },
                include: { _count: { select: { users: true } } }
            });

            if (!role) {
                throw new NotFoundError("Role not found");
            }
            return role;
        } catch (error) {
            logger.error("Failed to get role", { id, error });
            throw error;
        }
    };


    updateRole = async (id: string, data: UpdateRoleDto) => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id } });
            if (!role) {
                throw new NotFoundError("Role not found");
            }

            if (data.name && data.name !== role.name) {
                const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
                if (existing) throw new DuplicateError("Role with this name already exists");
            }

            if (data.isDefault) {
                await this.prisma.role.updateMany({
                    where: { isDefault: true, id: { not: id } },
                    data: { isDefault: false },
                });
            }

            const normalizePermissions = (perms?: string[]) => {
                if (!Array.isArray(perms)) return undefined;
                return perms.map((p) => {
                    const name = (p || "").toString();
                    const lower = name.toLowerCase();
                    const canView = lower.includes("view");
                    const canEdit = lower.includes("edit");
                    return { name, canView, canEdit };
                });
            };

            const updated = await this.prisma.$transaction(async (tx) => {
                const normalized = normalizePermissions(data.permissions as any) as any;

                const roleRes = await tx.role.update({
                    where: { id },
                    data: {
                        ...data,
                        permissions: normalized as any,
                    },
                });

                await tx.rolePermission.deleteMany({ where: { roleId: id } });

                const map = normalized as Record<string, Record<string, string[]>>;
                for (const mod of Object.keys(map)) {
                    const features = map[mod] || {};
                    for (const feat of Object.keys(features)) {
                        const actions = features[feat] || [];
                        for (const action of actions) {
                            const found = await tx.permission.findFirst({
                                where: { module: mod, featureKey: feat, action },
                            });
                            const perm = found || await tx.permission.create({
                                data: { module: mod, featureKey: feat, action, label: `${feat} ${action}` },
                            });
                            await tx.rolePermission.create({
                                data: { roleId: id, permissionId: perm.id },
                            });
                        }
                    }
                }

                return roleRes;
            });

            return updated;
        } catch (error) {
            logger.error("Failed to update role", { id, error });
            throw error;
        }
    };

    deleteRole = async (id: string) => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id } });
            if (!role) {
                throw new NotFoundError("Role not found");
            }

            if (role.isDefault) {
                throw new BadRequestError("Cannot delete default role");
            }

            return await this.prisma.role.delete({ where: { id } });
        } catch (error) {
            logger.error("Failed to delete role", { id, error });
            throw error;
        }
    };

    getRoleStats = async () => {
        try {
            const [totalRoles, activeRoles, inactiveRoles] = await this.prisma.$transaction([
                this.prisma.role.count(),
                this.prisma.role.count({ where: { isActive: true } }),
                this.prisma.role.count({ where: { isActive: false } }),
            ]);

            return {
                totalRoles,
                activeRoles,
                inactiveRoles
            };
        } catch (error) {
            logger.error("Failed to get role summary", { error });
            throw error;
        }
    };

    getRolePermissions = async (roleId: string, format: "flat" | "grouped" = "grouped") => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id: roleId } });
            if (!role) throw new NotFoundError("Role not found");

            const links = await this.prisma.rolePermission.findMany({
                where: { roleId },
                include: { permission: true },
                orderBy: { permission: { module: "asc" } },
            });

            if (format === "flat") {
                return links.map(l => ({
                    module: l.permission.module,
                    featureKey: l.permission.featureKey,
                    action: l.permission.action,
                    label: l.permission.label || `${l.permission.featureKey} ${l.permission.action}`,
                }));
            }

            const grouped: Record<string, Record<string, string[]>> = {};
            for (const l of links) {
                const mod = l.permission.module;
                const feat = l.permission.featureKey;
                const action = l.permission.action.toLowerCase();
                grouped[mod] = grouped[mod] || {};
                grouped[mod][feat] = grouped[mod][feat] || [];
                if (!grouped[mod][feat].includes(action)) grouped[mod][feat].push(action);
            }
            return grouped;
        } catch (error) {
            logger.error("Failed to get role permissions", { roleId, error });
            throw error;
        }
    };

    // --- Department Management ---

    createDepartment = async (data: CreateDepartmentDto, adminId: string) => {
        try {
            const existing = await this.prisma.department.findUnique({ where: { name: data.name } });
            if (existing) {
                throw new DuplicateError("Department with this name already exists");
            }
            const branchName = (data.branch || "Head Office").trim();
            const branch = await this.prisma.branch.findFirst({
                where: { name: { equals: branchName, mode: "insensitive" } },
                select: { id: true },
            });
            if (!branch) {
                throw new NotFoundError("Branch not found");
            }

            const adminUser = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
            const createdBy = adminUser?.fullName || "System";

            return await this.prisma.department.create({
                data: {
                    name: data.name,
                    departmentEmail: data.departmentEmail,
                    description: data.description,
                    branch: branchName,
                    isDefault: data.isDefault,
                    createdBy,
                    createdById: adminId,
                },
            });
        } catch (error) {
            logger.error("Failed to create department", { error });
            throw error;
        }
    };

    getAllDepartments = async (query: DepartmentQueryDto) => {
        try {
            const { page = 1, limit = 10, search, isActive } = query;

            const where: Record<string, any> = {};

            if (search) {
                where.name = { contains: search, mode: "insensitive" };
            }

            if (isActive !== undefined) {
                where.isActive =
                    typeof isActive === "string"
                        ? isActive === "true"
                        : Boolean(isActive);
            }

            return await paginate(
                this.prisma.department,
                {
                    where,
                    include: {
                        _count: { select: { users: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
                { page, limit },
                (departments) =>
                    departments.map((department: any) => ({
                        ...department,
                        usersCount: department._count?.users || 0,
                    }))
            );
        } catch (error) {
            logger.error("Failed to get all departments", { error });
            throw error;
        }
    };

    getDepartment = async (id: string) => {
        try {
            const department = await this.prisma.department.findUnique({
                where: { id },
                include: { _count: { select: { users: true } } }
            });

            if (!department) {
                throw new NotFoundError("Department not found");
            }
            return department;
        } catch (error) {
            logger.error("Failed to get department", { id, error });
            throw error;
        }
    };

    updateDepartment = async (id: string, data: UpdateDepartmentDto) => {
        try {
            const department = await this.prisma.department.findUnique({ where: { id } });
            if (!department) {
                throw new NotFoundError("Department not found");
            }

            if (data.name && data.name !== department.name) {
                const existing = await this.prisma.department.findUnique({ where: { name: data.name } });
                if (existing) throw new DuplicateError("Department with this name already exists");
            }
            if (typeof data.branch === "string" && data.branch.trim()) {
                const branchName = data.branch.trim();
                const branch = await this.prisma.branch.findFirst({
                    where: { name: { equals: branchName, mode: "insensitive" } },
                    select: { id: true },
                });
                if (!branch) {
                    throw new NotFoundError("Branch not found");
                }
            }

            return await this.prisma.department.update({
                where: { id },
                data: {
                    name: data.name,
                    departmentEmail: data.departmentEmail,
                    description: data.description,
                    branch: data.branch,
                    isActive: data.isActive,
                    isDefault: data.isDefault,
                },
            });
        } catch (error) {
            logger.error("Failed to update department", { id, error });
            throw error;
        }
    };

    deleteDepartment = async (id: string) => {
        try {
            const department = await this.prisma.department.findUnique({ where: { id } });
            if (!department) {
                throw new NotFoundError("Department not found");
            }

            return await this.prisma.department.delete({ where: { id } });
        } catch (error) {
            logger.error("Failed to delete department", { id, error });
            throw error;
        }
    };

    toggleDepartmentActive = async (id: string, isActive: boolean) => {
        try {
            const existing = await this.prisma.department.findUnique({ where: { id } });
            if (!existing) {
                throw new NotFoundError("Department not found");
            }
            const updated = await this.prisma.department.update({
                where: { id },
                data: { isActive },
            });
            return updated;
        } catch (error) {
            logger.error("Failed to toggle department active status", { id, isActive, error });
            throw error;
        }
    };

    getDepartmentStats = async () => {
        try {
            const [totalDepartments, activeDepartments, inactiveDepartments] = await this.prisma.$transaction([
                this.prisma.department.count(),
                this.prisma.department.count({ where: { isActive: true } }),
                this.prisma.department.count({ where: { isActive: false } }),
            ]);

            return {
                totalDepartments,
                activeDepartments,
                inactiveDepartments
            };
        } catch (error) {
            logger.error("Failed to get department summary", { error });
            throw error;
        }
    };

}
export const userManagementService = new UserManagementService(prisma);
