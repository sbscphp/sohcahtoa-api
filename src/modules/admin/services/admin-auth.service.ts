import { createLogger, emailService } from "../../../shared/utils";
import { EventType, ServiceName, UserRole } from "../../../shared/types";
import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateId,
  generateOtp,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from "../../../shared/utils";
import { CreateAdminUserDto } from "../dto/user-management.dto";

const prisma: PrismaClient = getDatabase();
const logger = createLogger(ServiceName.ADMIN);

class AdminAuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async forgotPassword(email: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    const otp = generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.prisma.token.updateMany({
      where: { userId: user.id, type: "OTP", isUsed: false },
      data: { isUsed: true },
    });

    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: "OTP",
        token: otp,
        expiresAt,
        metadata: { purpose: user.password ? "PASSWORD_RESET" : "WELCOME" },
      },
    });

    logger.info("Forgot password initiated", { email });

    if (emailService.isReady()) {
      const purpose = user.password ? "PASSWORD_RESET" : "REGISTRATION";
      emailService
        .sendOtpEmail(user.email, otp, purpose)
        .catch((err: Error) => logger.warn("OTP email failed", { userId: user.id, message: err.message }));
    }

    return { message: "OTP sent to your email" };
  }

  async resetPassword(otp: string, newPassword: string) {
    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        token: otp,
        type: "OTP",
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!tokenRecord) throw new ValidationError("Invalid or expired OTP");
    if (tokenRecord.attempts >= tokenRecord.maxAttempts)
      throw new ValidationError("Maximum OTP attempts exceeded");

    const hashedPassword = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: tokenRecord.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.token.update({
        where: { id: tokenRecord.id },
        data: { isUsed: true, usedAt: new Date() },
      }),
    ]);

    logger.info("Password reset successful", { userId: tokenRecord.userId });
    return { message: "Password reset successful" };
  }

  async initiateLogin(email: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");
    if (!user.password) throw new UnauthorizedError("Password not set. Please complete registration first.");

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedError("Invalid password");

    const otp = generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.prisma.token.updateMany({
      where: {
        userId: user.id,
        type: "OTP",
        isUsed: false,
        metadata: { path: ["purpose"], equals: "LOGIN" } as any,
      },
      data: { isUsed: true },
    });

    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: "OTP",
        token: otp,
        expiresAt,
        metadata: { purpose: "LOGIN" },
      },
    });

    if (emailService.isReady()) {
      emailService
        .sendOtpEmail(user.email, otp, "LOGIN")
        .catch((err: Error) => logger.warn("Login OTP email failed", { userId: user.id, message: err.message }));
    }

    return { message: "OTP sent to your email" };
  }

  async verifyLogin(email: string, otp: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email },
      include: { role: true }
    });
    if (!user) throw new NotFoundError("User not found");

    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        token: otp,
        type: "OTP",
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!tokenRecord) throw new ValidationError("Invalid or expired OTP");

    const metadata = tokenRecord.metadata as any;
    if (metadata?.purpose !== "LOGIN") throw new ValidationError("Invalid OTP purpose");

    await this.prisma.token.update({
      where: { id: tokenRecord.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    const sessionId = generateId();
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: UserRole.ADMIN, // Admin users always have ADMIN role
      sessionId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { password: _password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, accessToken, refreshToken };
  }
}

export const adminAuthService = new AdminAuthService(prisma);
