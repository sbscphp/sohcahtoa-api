import { createLogger } from "../../../shared/utils";
import { EventType, ServiceName, UserRole } from "../../../shared/types";
import { PrismaClient, AdminUser, Prisma } from "@prisma/client";
import { CreateAdminUserDto, CreateRoleDto, UpdateRoleDto, RoleQueryDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto, AdminUserQueryDto } from "../dto/user-management.dto";
import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { generateId, DuplicateError, NotFoundError, BadRequestError, paginate, hashPassword, generateSecureOtp } from '../../../shared/utils';
import { emailService } from '../../../shared/utils';
import { eventBus, EventTypes } from "../../../events/event-bus";


const logger = createLogger(ServiceName.ADMIN);

class UserManagementService {
    constructor(private readonly prisma: PrismaClient) { }

    addUser = async (body: CreateAdminUserDto) => {
        try {
            const cleanEmail = body.email.toLowerCase().trim();
            const result = await this.prisma.$transaction(async tx => {

                const existingByEmail = await tx.adminUser.findUnique({ where: { email: cleanEmail } });
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
                        isActive: false,
                    },
                    include: {
                        role: { select: { name: true } },
                        department: { select: { name: true } },
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

        try {
            const otp = generateSecureOtp();
            const hashedOtp = await hashPassword(otp);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            await this.prisma.$transaction([
                this.prisma.token.updateMany({
                    where: { userId: result.id, type: "OTP", isUsed: false },
                    data: { isUsed: true, usedAt: new Date() },
                }),
                this.prisma.token.create({
                    data: {
                        userId: result.id,
                        type: "OTP",
                        token: hashedOtp,
                        expiresAt,
                        attempts: 0,
                        metadata: { purpose: "PASSWORD_RESET" },
                    },
                }),
            ]);

            const baseUrl = process.env.ADMIN_FRONTEND_URL ?? "https://sohcahtoa-app.vercel.app/";
            const url = new URL("/admin/reset-password", baseUrl);
            url.searchParams.set("otp", otp);
            const resetPasswordUrl = url.toString();

            emailService
                .sendAdminWelcomeEmail(result.email, result.fullName, resetPasswordUrl)
                .catch(err =>
                    logger.warn("Welcome email failed", {
                        userId: result.id,
                        message: err.message,
                    }),
                );
        } catch (tokenErr: any) {
            logger.error("Failed to generate setup OTP / send welcome email for new admin user", {
                userId: result.id,
                error: tokenErr?.message || tokenErr,
            });
        }

        const computedStatus = !(result as any).password ? "PENDING" : (result as any).isActive ? "ACTIVE" : "DEACTIVATED";
        const { password: _password, role: _role, department: _department, ...userWithoutPassword } = result as any;
        const roleName = (result as any).role?.name || null;
        const departmentName = (result as any).department?.name || null;

        eventBus.publish(EventTypes.USER_CREATED, {
            userId: result.id,
            name: result.fullName,
            email: result.email,
            role: roleName,
            department: departmentName,
        });
        return {
            user: {
                ...userWithoutPassword,
                roleId: (result as any).roleId || null,
                departmentId: (result as any).departmentId || null,
                roleName,
                departmentName,
                status: computedStatus,
            },
            rolePermissions,
        };
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
            const user = await this.prisma.adminUser.findUnique({
                where: { id: userId },
                include: { 
                    role: { select: { name: true } },
                    department: { select: { name: true } }
                },
            });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            
            // Get last active time from most recent admin action
            const lastAction = await this.prisma.adminAction.findFirst({
                where: { adminId: userId },
                orderBy: { performedAt: 'desc' },
                select: { performedAt: true }
            });
            
            const roleName = (user as any).role?.name || null;
            const departmentName = (user as any).department?.name || null;
            const lastActive = lastAction?.performedAt || null;
            
            const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user as any;
            const rolePermissions = await this.getRolePermissions(user.roleId, "grouped");
            
            return { 
                ...userWithoutPassword, 
                roleName, 
                departmentName,
                lastActive,
                rolePermissions 
            };
        } catch (error) {
            logger.error("Failed to get admin profile", {
                userId,
                message: (error as Error).message,
            });
            throw error;
        }
    };

    private buildAdminUserWhereClause(query: AdminUserQueryDto): Prisma.AdminUserWhereInput {
        const { search, fullName, email, role, department, isActive, status, sequenceId } = query;
        const where: Prisma.AdminUserWhereInput = {};

        if (sequenceId) {
            where.sequenceId = Number(sequenceId);
        }

        if (search) {
            const searchOr: any[] = [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phoneNumber: { contains: search, mode: "insensitive" } },
            ];

            // If search is a number, try to match sequenceId
            const searchNum = Number(search);
            if (!isNaN(searchNum)) {
                searchOr.push({ sequenceId: searchNum });
            }

            where.OR = searchOr;
        }

        if (fullName) {
            where.fullName = { contains: fullName, mode: "insensitive" };
        }

        if (email) {
            where.email = { contains: email, mode: "insensitive" };
        }

        const statusVal = status || isActive;
        if (statusVal !== undefined && statusVal !== null && statusVal !== "") {
            const s = String(statusVal).trim().toLowerCase();
            if (s === "pending") {
                where.password = null;
            } else if (s === "active" || s === "activated" || s === "true" || s === "1") {
                where.isActive = true;
                where.password = { not: null };
            } else if (s === "deactivated" || s === "inactive" || s === "false" || s === "0") {
                where.isActive = false;
                where.password = { not: null };
            }
        }

        if (role) {
            where.OR = [
                ...(where.OR || []),
                { roleId: role },
                { role: { name: { equals: role, mode: "insensitive" } } }
            ];
        }

        if (department) {
            where.OR = [
                ...(where.OR || []),
                { departmentId: department },
                { department: { name: { equals: department, mode: "insensitive" } } }
            ];
        }

        return where;
    }

    getAllUsers = async (query: AdminUserQueryDto) => {
        try {
            const { page = 1, limit = 10 } = query;
            const where = this.buildAdminUserWhereClause(query);

            return await paginate(
                this.prisma.adminUser,
                {
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        role: { select: { name: true } },
                        department: { select: { name: true } },
                    },
                },
                { page, limit },
                async (users: any[]) => {
                    return users.map((user) => {
                        const computedStatus = !user.password ? "PENDING" : user.isActive ? "ACTIVE" : "DEACTIVATED";
                        const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user;
                        const roleName = user.role?.name || null;
                        const departmentName = user.department?.name || null;
                        return { ...userWithoutPassword, roleId: user.roleId || null, departmentId: user.departmentId || null, roleName, departmentName, status: computedStatus };
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

    listUsersAll = async (q?: string) => {
        const query = (q || "").toString().trim();
        const where: any = {};
        if (query.length > 0) {
            where.OR = [
                { email: { contains: query, mode: "insensitive" } },
                { phoneNumber: { contains: query, mode: "insensitive" } },
                { fullName: { contains: query, mode: "insensitive" } },
            ];
        }
        const users = await this.prisma.adminUser.findMany({
            where,
            orderBy: { fullName: "asc" },
            take: 10_000,
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                isActive: true,
                password: true,
                roleId: true,
                departmentId: true,
                role: { select: { name: true } },
                department: { select: { name: true } },
            },
        });
        return (users || []).map((u: any) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phoneNumber: u.phoneNumber,
            isActive: u.isActive,
            roleId: u.roleId || null,
            departmentId: u.departmentId || null,
            roleName: u.role?.name || null,
            departmentName: u.department?.name || null,
            status: !u.password ? "PENDING" : u.isActive ? "ACTIVE" : "DEACTIVATED",
        }));
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
                include: {
                    role: { select: { name: true } },
                    department: { select: { name: true } },
                },
            });
            const rolePermissions = await this.getRolePermissions(updated.roleId, "grouped");
            const { password: _password, role: _role, department: _department, ...userWithoutPassword } = updated as any;
            const roleName = (updated as any).role?.name || null;
            const departmentName = (updated as any).department?.name || null;
            return {
                user: {
                    ...userWithoutPassword,
                    roleId: (updated as any).roleId || null,
                    departmentId: (updated as any).departmentId || null,
                    roleName,
                    departmentName,
                },
                rolePermissions,
            };
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
                include: {
                    role: { select: { name: true } },
                    department: { select: { name: true } },
                },
            });
            const rolePermissions = await this.getRolePermissions(updated.roleId, "grouped");
            const { password: _password, role: _role, department: _department, ...userWithoutPassword } = updated as any;
            const roleName = (updated as any).role?.name || null;
            const departmentName = (updated as any).department?.name || null;
            return {
                user: {
                    ...userWithoutPassword,
                    roleId: (updated as any).roleId || null,
                    departmentId: (updated as any).departmentId || null,
                    roleName,
                    departmentName,
                },
                rolePermissions,
            };
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
            const computedStatus = !(user as any).password ? "PENDING" : (user as any).isActive ? "ACTIVE" : "DEACTIVATED";
            const { password: _password, role: _role, department: _department, ...userWithoutPassword } = user as any;
            const rolePermissions = await this.getRolePermissions(user.roleId, "grouped");
            const roleName = (user as any).role?.name || null;
            const departmentName = (user as any).department?.name || null;
            return { ...userWithoutPassword, roleId: (user as any).roleId || null, departmentId: (user as any).departmentId || null, roleName, departmentName, status: computedStatus, rolePermissions };
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

    exportUsers = async (query: AdminUserQueryDto) => {
        const where = this.buildAdminUserWhereClause(query);
        const users = await this.prisma.adminUser.findMany({
            where,
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
            status: !u.password ? "PENDING" : u.isActive ? "ACTIVE" : "DEACTIVATED",
            createdAt: u.createdAt,
        }));
    };

    exportRoles = async (query: RoleQueryDto) => {
        const where = this.buildRoleWhereClause(query);
        const roles = await this.prisma.role.findMany({
            where,
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

    private buildDepartmentWhereClause(query: DepartmentQueryDto): Prisma.DepartmentWhereInput {
        const { search, isActive } = query;
        const where: Prisma.DepartmentWhereInput = {};

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        if (isActive !== undefined && isActive !== null && isActive !== "") {
            const parseActiveFilter = (value: any): boolean | undefined => {
                const s = String(value).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "active" || s === "activated" || s === "enabled") return true;
                if (s === "false" || s === "0" || s === "deactivated" || s === "inactive" || s === "disabled" || s === "dectivated") return false;
                return undefined;
            };

            const parsed = parseActiveFilter(isActive);
            if (parsed !== undefined) {
                where.isActive = parsed;
            }
        }

        return where;
    }

    exportDepartments = async (query: DepartmentQueryDto) => {
        const where = this.buildDepartmentWhereClause(query);
        const depts = await this.prisma.department.findMany({
            where,
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

            const parseBool = (v: any): boolean | undefined => {
                if (v === undefined || v === null) return undefined;
                if (typeof v === "boolean") return v;
                const s = String(v).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
                if (s === "false" || s === "0" || s === "no" || s === "off") return false;
                return undefined;
            };
            const isDefaultRaw = (data as any).isDefault;
            const isDefaultParsed = parseBool(isDefaultRaw);
            if (isDefaultRaw !== undefined && isDefaultParsed === undefined) {
                throw new BadRequestError("isDefault must be boolean");
            }
            const isDefault = isDefaultParsed ?? false;

            if (isDefault) {
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

            const normalizePermissions = (perms?: string[] | Record<string, Record<string, string[]>>) => {
                const allowed = new Set(["view", "edit", "create", "update", "delete", "export"]);
                const sanitize = (value: string): string | null => {
                    const v = (value || "").toString().trim().toLowerCase()
                        .replace(/^can[ ._:-]?/g, ""); // supports 'can.view', 'can view', 'can_view'
                    const mapped = v === "update" ? "edit" : v; // treat update as edit
                    return allowed.has(mapped) ? mapped : null;
                };
                const norm = (s: string) => s.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
                if (!perms) return {};
                if (Array.isArray(perms)) {
                    const result: Record<string, Record<string, string[]>> = {};
                    for (const p of perms) {
                        const s = (p || "").toString();
                        const parts = s.split(" - ").map(x => x.trim());
                        if (parts.length < 3) continue;
                        const module = norm(parts[0]);
                        const feature = norm(parts[1]);
                        const action = sanitize(parts[2]);
                        if (!action) continue;
                        result[module] = result[module] || {};
                        result[module][feature] = result[module][feature] || [];
                        if (!result[module][feature].includes(action)) {
                            result[module][feature].push(action);
                        }
                    }
                    return result;
                }
                const obj = perms as Record<string, Record<string, string[]>>;
                const result: Record<string, Record<string, string[]>> = {};
                for (const module of Object.keys(obj)) {
                    const normalizedModule = norm(module);
                    const features = obj[module] || {};
                    result[normalizedModule] = {};
                    for (const feature of Object.keys(features)) {
                        const normalizedFeature = norm(feature);
                        const actions = Array.isArray(features[feature]) ? features[feature] : [];
                        const clean = Array.from(
                            new Set(
                                actions
                                    .map(a => sanitize(a as any))
                                    .filter((a): a is string => !!a)
                            )
                        );
                        result[normalizedModule][normalizedFeature] = clean;
                    }
                }
                return result;
            };

            const permissionsJson = normalizePermissions(data.permissions as any);
            const countPermissions = (p: any): number => {
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
            if (countPermissions(permissionsJson) < 1) {
                throw new BadRequestError("At least one permission is required");
            }

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
                        isDefault,
                    } as any),
                });

                const map = permissionsJson as Record<string, Record<string, string[]>>;
                for (const mod of Object.keys(map)) {
                    const features = map[mod] || {};
                    for (const feat of Object.keys(features)) {
                        const actions = features[feat] || [];
                        for (const action of actions) {
                            const perm = await tx.permission.upsert({
                                where: {
                                    module_featureKey_action: {
                                        module: mod,
                                        featureKey: feat,
                                        action,
                                    },
                                },
                                update: { isActive: true, label: `${feat} ${action}` },
                                create: { module: mod, featureKey: feat, action, label: `${feat} ${action}` },
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

            eventBus.publish(EventTypes.ROLE_CREATED, {
                roleId: role.id,
                name: role.name,
                createdById: adminId,
            });

            return role;
        } catch (error) {
            logger.error("Failed to create role", { error });
            throw error;
        }
    };

    private buildRoleWhereClause(query: RoleQueryDto): Prisma.RoleWhereInput {
        const { search, isActive } = query;
        const where: Prisma.RoleWhereInput = {};

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        if (isActive !== undefined && isActive !== null && isActive !== "") {
            const parseActiveFilter = (value: any): boolean | undefined => {
                const s = String(value).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "active" || s === "activated" || s === "enabled") return true;
                if (s === "false" || s === "0" || s === "deactivated" || s === "inactive" || s === "disabled" || s === "dectivated") return false;
                return undefined;
            };

            const parsed = parseActiveFilter(isActive);
            if (parsed !== undefined) {
                where.isActive = parsed;
            }
        }

        return where;
    }

    getAllRoles = async (query: RoleQueryDto) => {
        try {
            const { page = 1, limit = 10 } = query;
            const where = this.buildRoleWhereClause(query);

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

            const parseBool = (v: any): boolean | undefined => {
                if (v === undefined || v === null) return undefined;
                if (typeof v === "boolean") return v;
                const s = String(v).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
                if (s === "false" || s === "0" || s === "no" || s === "off") return false;
                return undefined;
            };
            const sanitized: any = { ...(data as any) };
            const hasIsDefault = Object.prototype.hasOwnProperty.call(sanitized, "isDefault");
            const hasIsActive = Object.prototype.hasOwnProperty.call(sanitized, "isActive");
            if (hasIsDefault) {
                const parsed = parseBool(sanitized.isDefault);
                if (parsed === undefined) throw new BadRequestError("isDefault must be boolean");
                sanitized.isDefault = parsed;
            }
            if (hasIsActive) {
                const parsed = parseBool(sanitized.isActive);
                if (parsed === undefined) throw new BadRequestError("isActive must be boolean");
                sanitized.isActive = parsed;
            }

            if (hasIsDefault && sanitized.isDefault === true) {
                await this.prisma.role.updateMany({
                    where: { isDefault: true, id: { not: id } },
                    data: { isDefault: false },
                });
            }

            let departmentId: string | undefined = undefined;
            if (sanitized.department) {
                const byId = await this.prisma.department.findUnique({ where: { id: sanitized.department } });
                const dept = byId ?? await this.prisma.department.findUnique({ where: { name: sanitized.department } });
                if (!dept) throw new NotFoundError(`Department '${sanitized.department}' not found`);
                departmentId = dept.id;
            }

            const normalizePermissions = (perms?: string[] | Record<string, Record<string, string[]>>) => {
                const allowed = new Set(["view", "edit", "create", "update", "delete", "export"]);
                const sanitize = (value: string): string | null => {
                    const v = (value || "").toString().trim().toLowerCase()
                        .replace(/^can[ ._:-]?/g, "");
                    const mapped = v === "update" ? "edit" : v;
                    return allowed.has(mapped) ? mapped : null;
                };
                const norm = (s: string) => s.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
                if (!perms) return undefined;
                if (Array.isArray(perms)) {
                    const result: Record<string, Record<string, string[]>> = {};
                    for (const p of perms) {
                        const s = (p || "").toString();
                        const parts = s.split(" - ").map(x => x.trim());
                        if (parts.length < 3) continue;
                        const module = norm(parts[0]);
                        const feature = norm(parts[1]);
                        const action = sanitize(parts[2]);
                        if (!action) continue;
                        result[module] = result[module] || {};
                        result[module][feature] = result[module][feature] || [];
                        if (!result[module][feature].includes(action)) {
                            result[module][feature].push(action);
                        }
                    }
                    return result;
                }
                const obj = perms as Record<string, Record<string, string[]>>;
                const result: Record<string, Record<string, string[]>> = {};
                for (const module of Object.keys(obj)) {
                    const normalizedModule = norm(module);
                    const features = obj[module] || {};
                    result[normalizedModule] = {};
                    for (const feature of Object.keys(features)) {
                        const normalizedFeature = norm(feature);
                        const actions = Array.isArray(features[feature]) ? features[feature] : [];
                        const clean = Array.from(
                            new Set(
                                actions
                                    .map(a => sanitize(a as any))
                                    .filter((a): a is string => !!a)
                            )
                        );
                        result[normalizedModule][normalizedFeature] = clean;
                    }
                }
                return result;
            };

            const updated = await this.prisma.$transaction(async (tx) => {
                const hasPermissions = Object.prototype.hasOwnProperty.call(sanitized as any, "permissions");
                const normalized = hasPermissions
                    ? ((normalizePermissions((sanitized as any).permissions) as any) ?? {})
                    : undefined;
                const countPermissions = (p: any): number => {
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
                if (hasPermissions && countPermissions(normalized) < 1) {
                    throw new BadRequestError("At least one permission is required");
                }
                const { permissions: _permissions, department: _dept, ...rest } = sanitized ?? {};
                
                // Whitelist only valid Role model fields for Prisma update
                const roleData: any = {};
                const validFields = ["name", "description", "branch", "isActive", "isDefault"];
                for (const field of validFields) {
                    if (Object.prototype.hasOwnProperty.call(rest, field)) {
                        roleData[field] = (rest as any)[field];
                    }
                }
                if (departmentId) {
                    roleData.departmentId = departmentId;
                }

                const roleRes = await tx.role.update({
                    where: { id },
                    data: {
                        ...roleData,
                        ...(normalized !== undefined ? { permissions: normalized as any } : {}),
                    },
                });

                if (normalized !== undefined) {
                    await tx.rolePermission.deleteMany({ where: { roleId: id } });

                    const map = normalized as Record<string, Record<string, string[]>>;
                    for (const mod of Object.keys(map)) {
                        const features = map[mod] || {};
                        for (const feat of Object.keys(features)) {
                            const actions = features[feat] || [];
                            for (const action of actions) {
                                const perm = await tx.permission.upsert({
                                    where: {
                                        module_featureKey_action: {
                                            module: mod,
                                            featureKey: feat,
                                            action,
                                        },
                                    },
                                    update: { isActive: true, label: `${feat} ${action}` },
                                    create: { module: mod, featureKey: feat, action, label: `${feat} ${action}` },
                                });
                                await tx.rolePermission.create({
                                    data: { roleId: id, permissionId: perm.id },
                                });
                            }
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

    setDefaultRole = async (id: string) => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id } });
            if (!role) {
                throw new NotFoundError("Role not found");
            }
            if (!role.isActive) {
                throw new BadRequestError("Cannot set an inactive role as default");
            }

            const result = await this.prisma.$transaction(async (tx) => {
                await tx.role.updateMany({
                    where: { isDefault: true },
                    data: { isDefault: false },
                });

                return await tx.role.update({
                    where: { id },
                    data: { isDefault: true },
                });
            });

            return result;
        } catch (error) {
            logger.error("Failed to set default role", { id, error });
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

    toggleRoleActive = async (id: string, isActive: boolean) => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id } });
            if (!role) {
                throw new NotFoundError("Role not found");
            }
            const updated = await this.prisma.role.update({
                where: { id },
                data: { isActive },
            });
            return updated;
        } catch (error) {
            logger.error("Failed to toggle role active status", { id, isActive, error });
            throw error;
        }
    };

    getRolePermissions = async (roleId: string, format: "flat" | "grouped" = "grouped") => {
        try {
            const role = await this.prisma.role.findUnique({ where: { id: roleId } });
            if (!role) throw new NotFoundError("Role not found");

            const norm = (s: string) => s.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

            if (role.name === "SUPER_ADMIN") {
                const allPermissions = await this.prisma.permission.findMany({
                    where: { isActive: true },
                    orderBy: { module: "asc" }
                });

                if (format === "flat") {
                    return allPermissions.map(p => ({
                        module: norm(p.module),
                        featureKey: norm(p.featureKey),
                        action: p.action,
                        label: p.label || `${p.featureKey} ${p.action}`,
                    }));
                }

                const grouped: Record<string, Record<string, string[]>> = {};
                for (const p of allPermissions) {
                    const mod = norm(p.module);
                    const feat = norm(p.featureKey);
                    const action = p.action.toLowerCase();
                    grouped[mod] = grouped[mod] || {};
                    grouped[mod][feat] = grouped[mod][feat] || [];
                    if (!grouped[mod][feat].includes(action)) grouped[mod][feat].push(action);
                }
                return grouped;
            }

            const links = await this.prisma.rolePermission.findMany({
                where: { roleId },
                include: { permission: true },
                orderBy: { permission: { module: "asc" } },
            });

            if (format === "flat") {
                return links.map(l => ({
                    module: norm(l.permission.module),
                    featureKey: norm(l.permission.featureKey),
                    action: l.permission.action,
                    label: l.permission.label || `${l.permission.featureKey} ${l.permission.action}`,
                }));
            }

            const grouped: Record<string, Record<string, string[]>> = {};
            for (const l of links) {
                const mod = norm(l.permission.module);
                const feat = norm(l.permission.featureKey);
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

            const rawEmail = typeof data.departmentEmail === "string" ? data.departmentEmail.trim() : "";
            const departmentEmail = rawEmail ? rawEmail : null;
            if (departmentEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(departmentEmail)) {
                    throw new BadRequestError("Enter a valid email address");
                }
            }

            const parseBool = (v: any): boolean | undefined => {
                if (v === undefined || v === null) return undefined;
                if (typeof v === "boolean") return v;
                const s = String(v).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
                if (s === "false" || s === "0" || s === "no" || s === "off") return false;
                return undefined;
            };
            const isDefaultRaw = (data as any).isDefault;
            const isDefaultParsed = parseBool(isDefaultRaw);
            if (isDefaultRaw !== undefined && isDefaultParsed === undefined) {
                throw new BadRequestError("isDefault must be boolean");
            }
            const isDefault = isDefaultParsed ?? false;

            if (isDefault) {
                await this.prisma.department.updateMany({
                    where: { isDefault: true },
                    data: { isDefault: false },
                });
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

            const created = await this.prisma.department.create({
                data: {
                    name: data.name,
                    departmentEmail,
                    description: data.description,
                    branch: branchName,
                    isDefault,
                    createdBy,
                    createdById: adminId,
                },
            });

            eventBus.publish(EventTypes.DEPARTMENT_CREATED, {
                departmentId: created.id,
                name: created.name,
                departmentEmail: created.departmentEmail,
                branch: created.branch,
                createdById: adminId,
            });

            return created;
        } catch (error) {
            logger.error("Failed to create department", { error });
            throw error;
        }
    };

    getAllDepartments = async (query: DepartmentQueryDto) => {
        try {
            const { page = 1, limit = 10 } = query;
            const where = this.buildDepartmentWhereClause(query);

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

            const parseBool = (v: any): boolean | undefined => {
                if (v === undefined || v === null) return undefined;
                if (typeof v === "boolean") return v;
                const s = String(v).trim().toLowerCase();
                if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
                if (s === "false" || s === "0" || s === "no" || s === "off") return false;
                return undefined;
            };
            const hasIsDefault = Object.prototype.hasOwnProperty.call(data as any, "isDefault");
            const isDefaultRaw = (data as any).isDefault;
            const isDefaultParsed = hasIsDefault ? parseBool(isDefaultRaw) : undefined;
            if (hasIsDefault && isDefaultParsed === undefined) {
                throw new BadRequestError("isDefault must be boolean");
            }

            if (hasIsDefault && isDefaultParsed === true) {
                await this.prisma.department.updateMany({
                    where: { isDefault: true, id: { not: id } },
                    data: { isDefault: false },
                });
            }

            const hasEmail = Object.prototype.hasOwnProperty.call(data as any, "departmentEmail");
            const rawEmail = typeof data.departmentEmail === "string" ? data.departmentEmail.trim() : "";
            const departmentEmail = rawEmail ? rawEmail : null;
            if (hasEmail && departmentEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(departmentEmail)) {
                    throw new BadRequestError("Enter a valid email address");
                }
            }

            return await this.prisma.department.update({
                where: { id },
                data: {
                    name: data.name,
                    ...(hasEmail ? { departmentEmail } : {}),
                    description: data.description,
                    branch: data.branch,
                    isActive: data.isActive,
                    ...(hasIsDefault ? { isDefault: isDefaultParsed } : {}),
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
