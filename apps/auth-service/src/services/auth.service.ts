import prisma from '../config/database';
import redis from '../config/redis';
import { publishEvent } from '../config/kafka';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateId,
  generateOtp,
  UnauthorizedError,
  ValidationError,
  DuplicateError,
  NotFoundError,
  validateEmail,
  validatePhoneNumber,
  validatePasswordStrength,
} from '@fx-platform/shared-utils';
import {
  SignupRequest,
  LoginRequest,
  LoginResponse,
  OtpRequest,
  OtpValidationRequest,
  KycVerificationRequest,
  NigerianSignupRequest,
  TouristSignupRequest,
  BvnVerificationResponse,
  UserRole,
  CustomerType,
  KycStatus,
  EventType,
  ServiceName,
} from '@fx-platform/shared-types';
import bvnService from './bvn.service';
import passportVerificationService from './passport-verification.service';
import { emailService } from '@fx-platform/shared-utils';

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

export class AuthService {
  async signup(data: SignupRequest): Promise<{ userId: string; message: string }> {
    // Validate input
    if (!validateEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    if (!validatePhoneNumber(data.phoneNumber)) {
      throw new ValidationError('Invalid phone number format');
    }

    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new DuplicateError('User with this email or phone number already exists');
    }

    // Create user
    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: UserRole.CUSTOMER,
        credentials: {
          create: {
            passwordHash,
          },
        },
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
        },
        kyc: {
          create: {
            status: KycStatus.NOT_STARTED,
          },
        },
      },
    });

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.USER_REGISTERED,
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: user.email,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    // Send OTP
    await this.sendOtp({
      email: user.email,
      phoneNumber: user.phoneNumber,
      purpose: 'EMAIL_VERIFICATION',
    });

    return {
      userId: user.id,
      message: 'User registered successfully. Please verify your email/phone with the OTP sent.',
    };
  }

  async login(data: LoginRequest, userAgent?: string, ipAddress?: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        credentials: true,
        profile: true,
        kyc: true,
      },
    });

    if (!user || !user.credentials) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is locked
    if (user.credentials.lockedUntil && user.credentials.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked. Please try again later.');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.credentials.passwordHash);

    if (!isPasswordValid) {
      // Increment failed attempts
      const failedAttempts = user.credentials.failedAttempts + 1;
      const updateData: any = { failedAttempts };

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      }

      await prisma.userCredential.update({
        where: { id: user.credentials.id },
        data: updateData,
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset failed attempts
    await prisma.userCredential.update({
      where: { id: user.credentials.id },
      data: { failedAttempts: 0, lockedUntil: null },
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

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        phoneNumber: user.phoneNumber,
        role: user.role as UserRole,
        customerType: user.customerType as CustomerType | undefined,
        kycStatus: user.kyc?.status as KycStatus || KycStatus.NOT_STARTED,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  // STEP 1: Verify BVN and return extracted data for user preview
  async verifyBvnForSignup(bvn: string): Promise<{
    bvn: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    address?: string;
    gender?: string;
  }> {
    // Verify BVN and extract all user data
    const bvnResult = await bvnService.verifyBvn(bvn);

    if (!bvnResult.success || !bvnResult.data) {
      throw new ValidationError(bvnResult.message || 'BVN verification failed');
    }

    // Check if user already exists with this BVN
    const existingKyc = await prisma.userKyc.findUnique({
      where: { bvn },
    });

    if (existingKyc) {
      throw new DuplicateError('An account with this BVN already exists');
    }

    // Return extracted data for user to preview and confirm
    return {
      bvn,
      firstName: bvnResult.data.firstName,
      lastName: bvnResult.data.lastName,
      email: bvnResult.data.email!,
      phoneNumber: bvnResult.data.phoneNumber,
      dateOfBirth: bvnResult.data.dateOfBirth,
      address: bvnResult.data.address,
      gender: bvnResult.data.gender,
    };
  }

  // STEP 2: Send OTP to user's chosen contact (email or phone)
  async sendBvnVerificationOtp(data: {
    bvn: string;
    verificationType: 'email' | 'phone';
    email?: string;
    phoneNumber?: string;
  }): Promise<{ message: string }> {
    const contactValue = data.verificationType === 'email' ? data.email! : data.phoneNumber!;

    // Send OTP
    await this.sendOtp({
      email: data.verificationType === 'email' ? contactValue : '',
      phoneNumber: data.verificationType === 'phone' ? contactValue : '',
      purpose: 'EMAIL_VERIFICATION',
    });

    return {
      message: `OTP sent successfully to your ${data.verificationType}`,
    };
  }

  // STEP 4: After OTP verification, create account with user's password
  async createNigerianAccount(data: {
    bvn: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    address?: string;
    password: string;
  }): Promise<{ userId: string; message: string }> {
    // Validate password
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new DuplicateError('User with this email or phone number already exists');
    }

    // Hash the user's password
    const passwordHash = await hashPassword(data.password);

    // Create user with BVN data
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: UserRole.CUSTOMER,
        customerType: CustomerType.NIGERIAN_CITIZEN,
        emailVerified: true, // Already verified via OTP
        credentials: {
          create: {
            passwordHash,
          },
        },
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            address: data.address,
          },
        },
        kyc: {
          create: {
            status: KycStatus.VERIFIED,
            bvn: data.bvn,
            bvnVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    // Send welcome email
    if (emailService.isReady()) {
      await emailService.sendWelcomeEmail(data.email, data.firstName);
    }

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.USER_REGISTERED,
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  // STEP 1: Verify passport and return extracted data for user preview
  async verifyPassportForSignup(passportDocumentUrl: string): Promise<{
    passportNumber: string;
    passportDocumentUrl: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    nationality: string;
  }> {
    // Verify passport document and extract all user data
    const passportResult = await passportVerificationService.verifyPassport(passportDocumentUrl);

    if (!passportResult.success || !passportResult.data) {
      throw new ValidationError(passportResult.message || 'Passport verification failed');
    }

    // Check if user already exists with this passport
    const existingKyc = await prisma.userKyc.findFirst({
      where: { passportNumber: passportResult.data.passportNumber },
    });

    if (existingKyc) {
      throw new DuplicateError('An account with this passport already exists');
    }

    // Return extracted data for user to preview and confirm
    return {
      passportNumber: passportResult.data.passportNumber,
      passportDocumentUrl: passportDocumentUrl,
      firstName: passportResult.data.firstName,
      lastName: passportResult.data.lastName,
      email: passportResult.data.email!,
      phoneNumber: passportResult.data.phoneNumber!,
      dateOfBirth: passportResult.data.dateOfBirth,
      nationality: passportResult.data.nationality,
    };
  }

  // STEP 2: Send OTP to user's chosen contact (email or phone)
  async sendPassportVerificationOtp(data: {
    passportNumber: string;
    verificationType: 'email' | 'phone';
    email?: string;
    phoneNumber?: string;
  }): Promise<{ message: string }> {
    const contactValue = data.verificationType === 'email' ? data.email! : data.phoneNumber!;

    // Send OTP
    await this.sendOtp({
      email: data.verificationType === 'email' ? contactValue : '',
      phoneNumber: data.verificationType === 'phone' ? contactValue : '',
      purpose: 'EMAIL_VERIFICATION',
    });

    return {
      message: `OTP sent successfully to your ${data.verificationType}`,
    };
  }

  // STEP 4: After OTP verification, create account with user's password
  async createTouristAccount(data: {
    passportNumber: string;
    passportDocumentUrl: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    nationality: string;
    password: string;
  }): Promise<{ userId: string; message: string }> {
    // Validate password
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new DuplicateError('User with this email or phone number already exists');
    }

    // Hash the user's password
    const passwordHash = await hashPassword(data.password);

    // Create user with passport data
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: UserRole.CUSTOMER,
        customerType: CustomerType.TOURIST,
        emailVerified: true, // Already verified via OTP
        credentials: {
          create: {
            passwordHash,
          },
        },
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            country: data.nationality,
          },
        },
        kyc: {
          create: {
            status: KycStatus.VERIFIED,
            passportNumber: data.passportNumber,
            passportDocumentUrl: data.passportDocumentUrl,
            passportVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    // Send welcome email
    if (emailService.isReady()) {
      await emailService.sendWelcomeEmail(data.email, data.firstName);
    }

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.USER_REGISTERED,
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  async sendOtp(data: OtpRequest): Promise<{ message: string }> {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await prisma.otpLog.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        otp,
        purpose: data.purpose,
        expiresAt,
      },
    });

    // Cache OTP in Redis for faster validation
    const cacheKey = `otp:${data.email || data.phoneNumber}:${data.purpose}`;
    await redis.setex(cacheKey, OTP_EXPIRY_MINUTES * 60, otp);

    // Send OTP via email if email service is configured
    if (emailService.isReady() && data.email) {
      await emailService.sendOtpEmail(data.email, otp, data.purpose);
    } else {
      // Log OTP for development
      console.log(`OTP for ${data.email || data.phoneNumber}: ${otp}`);
    }

    // TODO: Send OTP via SMS using Termii or similar service for phone verification

    return {
      message: 'OTP sent successfully',
    };
  }

  async validateOtp(data: OtpValidationRequest): Promise<{ valid: boolean; message: string }> {
    // Check Redis cache first
    const cacheKey = `otp:${data.email}:${data.purpose}`;
    const cachedOtp = await redis.get(cacheKey);

    if (cachedOtp && cachedOtp === data.otp) {
      // Mark OTP as used
      await redis.del(cacheKey);

      await prisma.otpLog.updateMany({
        where: {
          email: data.email,
          purpose: data.purpose,
          otp: data.otp,
          isUsed: false,
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      // Update user verification status if needed
      if (data.purpose === 'EMAIL_VERIFICATION') {
        const user = await prisma.user.update({
          where: { email: data.email },
          data: { emailVerified: true },
          include: { profile: true },
        });

        // Send welcome email after verification
        if (emailService.isReady() && user.profile) {
          await emailService.sendWelcomeEmail(user.email, user.profile.firstName);
        }
      }

      return { valid: true, message: 'OTP validated successfully' };
    }

    // Check database
    const otpLog = await prisma.otpLog.findFirst({
      where: {
        email: data.email,
        purpose: data.purpose,
        otp: data.otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpLog) {
      // Increment attempts
      await prisma.otpLog.updateMany({
        where: {
          email: data.email,
          purpose: data.purpose,
          otp: data.otp,
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      return { valid: false, message: 'Invalid or expired OTP' };
    }

    // Mark as used
    await prisma.otpLog.update({
      where: { id: otpLog.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return { valid: true, message: 'OTP validated successfully' };
  }

  async logout(sessionId: string): Promise<{ message: string }> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return { message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenPayload = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role as UserRole,
      sessionId: session.id,
    };

    const accessToken = generateAccessToken(tokenPayload);

    return { accessToken };
  }

  async verifyKyc(data: KycVerificationRequest): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { kyc: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update KYC data
    await prisma.userKyc.update({
      where: { userId: data.userId },
      data: {
        bvn: data.bvn,
        tin: data.tin,
        passportNumber: data.passportNumber,
        status: KycStatus.PENDING_VERIFICATION,
      },
    });

    // TODO: Call external verification APIs (CBN TRMS, BVN verification, etc.)
    // For now, we'll just update the status

    return {
      message: 'KYC verification initiated',
    };
  }
}

export default new AuthService();
