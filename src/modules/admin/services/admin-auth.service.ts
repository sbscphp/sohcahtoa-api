import { createLogger, emailService, generateSecureOtp } from "../../../shared/utils";
import { ServiceName, UserRole } from "../../../shared/types";
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

const prisma: PrismaClient = getDatabase();
const logger = createLogger(ServiceName.ADMIN);

class AdminAuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async forgotPassword(email: string) {
  const user = await this.prisma.adminUser.findUnique({
    where: { email },
  });

  if (!user) {
    return { message: "If an account exists, an OTP has been sent." };
  }

  const now = new Date();

  const recentOtp = await this.prisma.token.findFirst({
    where: {
      userId: user.id,
      type: "OTP",
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });

  if (recentOtp) {
    return { message: "Please wait before requesting another OTP." };
  }

  const otp = generateSecureOtp();
  const hashedOtp = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const purpose = user.password ? "PASSWORD_RESET" : "WELCOME";

  await this.prisma.$transaction([
    // Invalidate previous unused OTPs
    this.prisma.token.updateMany({
      where: {
        userId: user.id,
        type: "OTP",
        isUsed: false,
      },
      data: {
        isUsed: true,
        usedAt: now,
      },
    }),

    // Create new OTP
    this.prisma.token.create({
      data: {
        userId: user.id,
        type: "OTP",
        token: hashedOtp,
        expiresAt,
        attempts: 0,
        metadata: { purpose },
      },
    }),
  ]);

  if (emailService.isReady()) {
    emailService
      .sendOtpEmail(user.email, otp, purpose)
      .catch(() => {});
  }

  return { message: "If an account exists, an OTP has been sent." };
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

  async validateResetOtp(otp: string) {
  const now = new Date();

  const activeTokens = await this.prisma.token.findMany({
    where: {
      type: "OTP",
      isUsed: false,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      token: true,
      metadata: true,
      attempts: true,
    },
  });

  let matchedToken: typeof activeTokens[number] | null = null;

  for (const record of activeTokens) {
    const isValid = await comparePassword(otp, record.token);

    if (!isValid) {
      // increment attempts safely
      await this.prisma.token.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      continue;
    }

    matchedToken = record;
    break;
  }

  if (!matchedToken) {
    throw new ValidationError("Invalid or expired OTP");
  }

  // Lock if too many attempts
  if (matchedToken.attempts >= 5) {
    await this.prisma.token.update({
      where: { id: matchedToken.id },
      data: { isUsed: true, usedAt: now },
    });

    throw new ValidationError("OTP locked due to multiple failed attempts");
  }

  const metadata = matchedToken.metadata as { purpose?: string };

  if (metadata?.purpose !== "PASSWORD_RESET") {
    throw new ValidationError("Invalid OTP purpose");
  }

  const resetToken = generateId();
  const hashedResetToken = await hashPassword(resetToken);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await this.prisma.$transaction([
    // Mark OTP as used
    this.prisma.token.update({
      where: { id: matchedToken.id },
      data: { isUsed: true, usedAt: now },
    }),

    // Invalidate previous reset tokens
    this.prisma.token.updateMany({
      where: {
        userId: matchedToken.userId,
        type: "PASSWORD_RESET",
        isUsed: false,
      },
      data: { isUsed: true, usedAt: now },
    }),

    // Create reset token
    this.prisma.token.create({
      data: {
        userId: matchedToken.userId,
        type: "PASSWORD_RESET",
        token: hashedResetToken,
        expiresAt,
      },
    }),
  ]);

  return {
    resetToken,
    message: "OTP validated. Use resetToken within 10 minutes.",
  };
}


async submitNewPassword(resetToken: string, newPassword: string) {
  const now = new Date();

  const activeTokens = await this.prisma.token.findMany({
    where: {
      type: "PASSWORD_RESET",
      isUsed: false,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      token: true,
    },
  });

  let matchedToken: typeof activeTokens[number] | null = null;

  for (const record of activeTokens) {
    const isValid = await comparePassword(resetToken, record.token);
    if (isValid) {
      matchedToken = record;
      break;
    }
  }

  if (!matchedToken) {
    throw new ValidationError("Invalid or expired reset token");
  }

  const hashedPassword = await hashPassword(newPassword);

  await this.prisma.$transaction([
    // Update user password
    this.prisma.adminUser.update({
      where: { id: matchedToken.userId },
      data: { password: hashedPassword },
    }),

    // Mark reset token as used
    this.prisma.token.update({
      where: { id: matchedToken.id },
      data: { isUsed: true, usedAt: now },
    }),

    // Optional: invalidate all remaining reset tokens for this user
    this.prisma.token.updateMany({
      where: {
        userId: matchedToken.userId,
        type: "PASSWORD_RESET",
        isUsed: false,
      },
      data: { isUsed: true, usedAt: now },
    }),
  ]);

  return { message: "Password updated successfully" };
}

  async initiateLogin(email: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");
    if (!user.password) throw new UnauthorizedError("Password not set. Please complete registration first.");

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedError("Invalid password");

    const otp = generateOtp();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 10);

    await this.prisma.token.updateMany({
      where: {
        userId: user.id,
        type: "OTP",
        isUsed: false,
        metadata: { path: ["purpose"], equals: "LOGIN" } as any,
      },
      data: { isUsed: true },
    });

    const tokenRecord = await this.prisma.token.create({
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

    return { otp: tokenRecord.token, message: "OTP sent to your email" };
  }

  async verifyLogin(email: string, otp: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email }
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
      role: UserRole.ADMIN,
      sessionId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { password: _password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, accessToken, refreshToken };
  }

  async resendLoginOtp(email: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");
    if (!user.password) throw new UnauthorizedError("Password not set. Please complete registration first.");

    const recent = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        type: "OTP",
        isUsed: false,
        metadata: { path: ["purpose"], equals: "LOGIN" } as any,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recent) {
      return { message: "Please wait before requesting another OTP." };
    }

    await this.prisma.token.updateMany({
      where: {
        userId: user.id,
        type: "OTP",
        isUsed: false,
        metadata: { path: ["purpose"], equals: "LOGIN" } as any,
      },
      data: { isUsed: true },
    });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const tokenRecord = await this.prisma.token.create({
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
        .catch((err: Error) => logger.warn("Resend login OTP email failed", { userId: user.id, message: err.message }));
    }

    return { message: "OTP resent to your email" };
  }

  async logout(userId: string, sessionId: string) {
    try {
      await (this.prisma as any).securityEvent.create({
        data: {
          eventType: "USER_LOGOUT",
          severity: "INFO",
          userId,
          description: "Admin user logout",
          details: { sessionId },
        },
      });
    } catch {}
    return { message: "Logged out successfully" };
  }

  async resendForgotOtp(email: string) {
    return this.forgotPassword(email);
  }
}

export const adminAuthService = new AdminAuthService(prisma);
