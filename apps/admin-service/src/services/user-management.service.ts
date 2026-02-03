import { createLogger } from "@fx-platform/shared-utils";
import { EventType, ServiceName, UserRole } from "@fx-platform/shared-types";
import { PrismaClient, AdminUser } from "@prisma/client";
import { CreateAdminUserDto, CreateRoleDto, UpdateRoleDto, RoleQueryDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from "../dto/user-management.dto";
import prisma from "../config/database";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, generateId, generateOtp, UnauthorizedError, ValidationError,
    DuplicateError, NotFoundError, BadRequestError, paginate} from '@fx-platform/shared-utils';
import { emailService } from '@fx-platform/shared-utils';


const logger = createLogger(ServiceName.ADMIN);

class AuthService {
    constructor(private readonly prisma: PrismaClient) { }

    addUser = async (body: CreateAdminUserDto) => {
        try {
            const result = await this.prisma.$transaction(async tx => {
                const user = await tx.adminUser.create({
                    data: body,
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

    forgotPassword = async (email: string) => {
        try {
            const user = await this.prisma.adminUser.findUnique({
                where: { email },
            });
            if (!user) {
                throw new NotFoundError("User not found");
            }

            const otp = generateOtp();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

            // Invalidate any existing OTP tokens for this user
            await this.prisma.token.updateMany({
                where: {
                    userId: user.id,
                    type: 'OTP',
                    isUsed: false,
                },
                data: {
                    isUsed: true,
                },
            });

            // Create new OTP token
            await this.prisma.token.create({
                data: {
                    userId: user.id,
                    type: 'OTP',
                    token: otp,
                    expiresAt,
                    metadata: {
                        purpose: user.password ? 'PASSWORD_RESET' : 'WELCOME'
                    },
                },
            });

            logger.info("Forgot password initiated", { email });

            if (emailService.isReady()) {
                const purpose = user.password ? 'PASSWORD_RESET' : 'REGISTRATION';
                emailService.sendOtpEmail(user.email, otp, purpose)
                    .catch((err: Error) =>
                        logger.warn("OTP email failed", {
                            userId: user.id,
                            message: err.message,
                        }),
                    );
            }

            return { message: "OTP sent to your email" };
        } catch (error) {
            logger.error("Forgot password failed", { email, error });
            throw error;
        }
    };

    resetPassword = async (otp: string, newPassword: string) => {
        try {
            // Find valid OTP token
            const tokenRecord = await this.prisma.token.findFirst({
                where: {
                    token: otp,
                    type: 'OTP',
                    isUsed: false,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                include: {
                    user: true,
                },
            });

            if (!tokenRecord) {
                throw new ValidationError("Invalid or expired OTP");
            }

            // Check max attempts
            if (tokenRecord.attempts >= tokenRecord.maxAttempts) {
                throw new ValidationError("Maximum OTP attempts exceeded");
            }

            // Hash the new password
            const hashedPassword = await hashPassword(newPassword);

            // Update password and mark token as used
            await this.prisma.$transaction([
                this.prisma.adminUser.update({
                    where: { id: tokenRecord.userId },
                    data: { password: hashedPassword },
                }),
                this.prisma.token.update({
                    where: { id: tokenRecord.id },
                    data: {
                        isUsed: true,
                        usedAt: new Date(),
                    },
                }),
            ]);

            logger.info("Password reset successful", { userId: tokenRecord.userId });
            return { message: "Password reset successful" };
        } catch (error) {
            logger.error("Password reset failed", { error });
            throw error;
        }
    };


    initiateLogin = async (email: string, password: string) => {
        try {
            const user = await this.prisma.adminUser.findUnique({ where: { email } });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            if (!user.password) {
                throw new UnauthorizedError("Password not set. Please complete registration first.");
            }
            const isPasswordValid = await comparePassword(password, user.password);
            if (!isPasswordValid) {
                throw new UnauthorizedError("Invalid password");
            }

            const otp = generateOtp();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

            // Invalidate any existing Login OTP tokens for this user
            await this.prisma.token.updateMany({
                where: {
                    userId: user.id,
                    type: 'OTP',
                    isUsed: false,
                    metadata: {
                        path: ['purpose'],
                        equals: 'LOGIN'
                    }
                },
                data: {
                    isUsed: true,
                },
            });

            // Create new OTP token
            await this.prisma.token.create({
                data: {
                    userId: user.id,
                    type: 'OTP',
                    token: otp,
                    expiresAt,
                    metadata: {
                        purpose: 'LOGIN'
                    },
                },
            });

            if (emailService.isReady()) {
                emailService.sendOtpEmail(user.email, otp, 'LOGIN')
                    .catch((err: Error) =>
                        logger.warn("Login OTP email failed", {
                            userId: user.id,
                            message: err.message,
                        }),
                    );
            }

            return { message: "OTP sent to your email" };
        } catch (error) {
            logger.error("Admin login initiation failed", { email, error });
            throw error;
        }
    };

    verifyLogin = async (email: string, otp: string) => {
        try {
            const user = await this.prisma.adminUser.findUnique({ where: { email } });
            if (!user) {
                throw new NotFoundError("User not found");
            }

            // Find valid OTP token
            const tokenRecord = await this.prisma.token.findFirst({
                where: {
                    userId: user.id,
                    token: otp,
                    type: 'OTP',
                    isUsed: false,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
            });

            if (!tokenRecord) {
                throw new ValidationError("Invalid or expired OTP");
            }

            // Check if purpose is LOGIN
            const metadata = tokenRecord.metadata as any;
            if (metadata?.purpose !== 'LOGIN') {
                throw new ValidationError("Invalid OTP purpose");
            }

            // Mark token as used
            await this.prisma.token.update({
                where: { id: tokenRecord.id },
                data: {
                    isUsed: true,
                    usedAt: new Date(),
                },
            });

            // Generate tokens
            const sessionId = generateId();
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role as UserRole,
                sessionId,
            };

            const accessToken = generateAccessToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);

            const { password: _password, ...userWithoutPassword } = user;

            return { ...userWithoutPassword, accessToken, refreshToken };
        } catch (error) {
            logger.error("Admin login verification failed", { email, error });
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
export const authService = new AuthService(prisma);