import { createLogger } from "../../../shared/utils";
import { EventType, ServiceName, UserRole } from "../../../shared/types";
import { PrismaClient, AdminUser } from "@prisma/client";
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
                const { department, ...userData } = body;
                const user = await tx.adminUser.create({
                    data: {
                        ...userData,
                        departmentName: department,
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
                            firstName: user.fullName,
                            lastName: user.fullName,
                        },
                    },
                });

                return user;
            });

            logger.info("Admin user created with outbox event", {
                adminUserId: result.id,
            });

            /**
             * Fire-and-forget email
             */
            if (emailService.isReady()) {
                const resetPasswordUrl = `${process.env.ADMIN_FRONTEND_URL || 'http://localhost:3000'}/reset-password`;

                emailService.sendAdminWelcomeEmail(result.email, result.fullName, resetPasswordUrl)
                    .catch((err: Error) =>
                        logger.warn("Welcome email failed", {
                            userId: result.id,
                            message: err.message,
                        }),
                    );
            }

            return result;
        } catch (error) {
            logger.error("Failed to create admin user", {
                message: (error as Error).message,
            });
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
            return userWithoutPassword;
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
                { orderBy: { createdAt: 'desc' } },
                { page, limit },
                (users: AdminUser[]) => users.map(user => {
                    const { password: _password, ...userWithoutPassword } = user;
                    return userWithoutPassword;
                })
            );
        } catch (error) {
            logger.error("Failed to get all admin users", {
                message: (error as Error).message,
            });
            throw error;
        }
    };

    getUserSummary = async () => {
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

            return await this.prisma.role.create({
                data: {
                    ...data,
                    permissions: data.permissions ? (data.permissions as any) : [],
                },
            });
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

            return await paginate(
                this.prisma.role,
                {
                    where,
                    include: {
                        _count: { select: { users: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
                { page, limit },
                (roles) =>
                    roles.map((role: any) => ({
                        ...role,
                        permissionsCount: Array.isArray(role.permissions)
                            ? role.permissions.length
                            : 0,
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

            return await this.prisma.role.update({
                where: { id },
                data: {
                    ...data,
                    permissions: data.permissions ? (data.permissions as any) : undefined,
                },
            });
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

    getRoleSummary = async () => {
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

    getDepartmentSummary = async () => {
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
