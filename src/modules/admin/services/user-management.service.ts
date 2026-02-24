import { createLogger } from "../../../shared/utils";
import { EventType, ServiceName, UserRole } from "../../../shared/types";
import { PrismaClient, AdminUser, Prisma } from "@prisma/client";
import { CreateAdminUserDto, CreateRoleDto, UpdateRoleDto, RoleQueryDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from "../dto/user-management.dto";
import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import {
    hashPassword, comparePassword, generateAccessToken, generateRefreshToken, generateId, generateOtp, UnauthorizedError, ValidationError,
    DuplicateError, NotFoundError, BadRequestError, paginate
} from '../../../shared/utils';
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
            return { user: userWithoutPassword, rolePermissions };
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
                    const enriched = await Promise.all(users.map(async (user) => {
                        const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user;
                        const rolePermissions = await this.getRolePermissions(user.roleId, "grouped");
                        const roleName = user.role?.name || null;
                        const departmentName = user.department?.name || null;
                        return { user: { ...userWithoutPassword, roleName, departmentName }, rolePermissions };
                    }));
                    return enriched;
                }
            );
        } catch (error) {
            logger.error("Failed to get all admin users", {
                message: (error as Error).message,
            });
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
            return { user: { ...userWithoutPassword, roleName, departmentName }, rolePermissions };
        } catch (error) {
            logger.error("Failed to get admin user", {
                id,
                message: (error as Error).message,
            });
            throw error;
        }
    };

    getLookups = async (type?: "role" | "department") => {
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
        const [roles, departments] = await Promise.all([
            this.prisma.role.findMany({ where: roleWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
            this.prisma.department.findMany({ where: deptWhere, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
        ]);
        return { roles, departments };
    };

    // --- Role Management ---

    createRole = async (data: CreateRoleDto) => {
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

            const role = await this.prisma.$transaction(async (tx) => {
                const created = await tx.role.create({
                    data: ({
                        name: data.name,
                        description: data.description,
                        permissions: permissionsJson as any,
                        branch: data.branch,
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

    createDepartment = async (data: CreateDepartmentDto) => {
        try {
            const existing = await this.prisma.department.findUnique({ where: { name: data.name } });
            if (existing) {
                throw new DuplicateError("Department with this name already exists");
            }

            return await this.prisma.department.create({
                data: {
                    ...data,
                    branch: data.branch || "Head Office",
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

            return await this.prisma.department.update({
                where: { id },
                data,
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
