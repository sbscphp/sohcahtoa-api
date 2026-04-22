import { getDatabase } from '../../../config/database';
import redis from '../config/redis';
import { eventBus, EventTypes } from '../../../events/event-bus';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateId,
  generateOtp,
  getAccessTokenExpiry,
  UnauthorizedError,
  ValidationError,
  DuplicateError,
  NotFoundError,
  validateEmail,
  validatePhoneNumber,
  validatePasswordStrength,
  emailService,
  createLogger,
  redactSensitiveData,
  partiallyRedactField,
} from '../../../shared/utils';

const logger = createLogger('AuthService');
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
  OtpPurpose,
  CreateAgentPasswordRequest,
  AgentPasswordPromptResponse,
  AgentLoginOtpSentResponse,
  VerifyAgentLoginRequest,
} from '../../../shared/types';
import bvnService from './bvn.service';
import tinService from './tin.service';
import passportVerificationService from './passport-verification.service';
import auditService from '../../audit/services/audit.service';
import { smsClient } from '../../../integrations';

const prisma = getDatabase();

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
    eventBus.publish(EventType.USER_REGISTERED, {
      eventId: generateId(),
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

    // Audit trail
    auditService.logAuthEvent({ userId: user.id, action: 'REGISTER', success: true, metadata: { email: user.email } });

    // Send OTP
    await this.sendOtp({
      email: user.email,
      phoneNumber: user.phoneNumber,
      purpose: OtpPurpose.REGISTRATION,
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
        auditService.logAuthEvent({ userId: user.id, action: 'SESSION_EXPIRED', success: false, ipAddress, userAgent, metadata: { reason: 'account_locked', failedAttempts } });
      }

      await prisma.userCredential.update({
        where: { id: user.credentials.id },
        data: updateData,
      });

      auditService.logAuthEvent({ userId: user.id, action: 'LOGIN', success: false, ipAddress, userAgent, metadata: { reason: 'invalid_password', failedAttempts } });
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

    // Use longer expiration for mobile devices (1 hour instead of 15 minutes)
    const tokenExpiry = getAccessTokenExpiry(userAgent);
    const accessToken = generateAccessToken(tokenPayload, tokenExpiry);
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

    auditService.logAuthEvent({ userId: user.id, action: 'LOGIN', success: true, ipAddress, userAgent });

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

  async loginAgent(
    data: LoginRequest,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResponse | AgentPasswordPromptResponse | AgentLoginOtpSentResponse> {
    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: data.email },
    });

    if (!agent) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!agent.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    if (!agent.password) {
      const otpResult = await this.sendOtp({
        email: agent.email,
        phoneNumber: agent.phoneNumber || '',
        purpose: OtpPurpose.AGENT_SET_PASSWORD,
      });

      const response: AgentPasswordPromptResponse = {
        message: 'Please set your password before attempting to log in using the OTP sent to your email',
        requiresPasswordSet: true,
      };

      if (process.env.NODE_ENV !== 'production') {
        response.otp = otpResult.otp;
      }

      return response;
    }

    const isPasswordValid = await comparePassword(data.password, agent.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const otpResult = await this.sendOtp({
      email: agent.email,
      phoneNumber: agent.phoneNumber || '',
      purpose: OtpPurpose.LOGIN,
    });

    const response: AgentLoginOtpSentResponse = {
      message: 'OTP sent to your email',
      requiresVerification: true,
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otp = otpResult.otp;
    }

    return response;
  }

  async verifyAgentLogin(
    data: VerifyAgentLoginRequest,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResponse> {
    if (!data.email || !data.otp) {
      throw new ValidationError('email and otp are required');
    }

    const otpValidation = await this.validateOtp({
      email: data.email,
      otp: data.otp,
      purpose: OtpPurpose.LOGIN,
    });

    if (!otpValidation.valid) {
      throw new ValidationError(otpValidation.message || 'Invalid or expired OTP');
    }

    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: data.email },
    });

    if (!agent) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!agent.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true, kyc: true },
    });

    let sessionUser: NonNullable<typeof existingUser>;
    if (existingUser) {
      sessionUser = existingUser;
    } else {
      const nameParts = (agent.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || agent.name || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const created = await prisma.user.create({
        data: {
          email: agent.email,
          phoneNumber: agent.phoneNumber,
          role: UserRole.AGENT as any,
          isActive: agent.isActive,
          credentials: {
            create: {
              passwordHash: agent.password,
            },
          },
          profile: {
            create: {
              firstName,
              lastName,
            },
          },
        },
        include: { profile: true, kyc: true },
      });
      sessionUser = created as NonNullable<typeof existingUser>;
    }

    const sessionId = generateId();
    const tokenPayload = {
      userId: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role as UserRole,
      sessionId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: sessionUser.id,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    auditService.logAuthEvent({
      userId: sessionUser.id,
      action: 'LOGIN',
      success: true,
      ipAddress,
      userAgent,
      metadata: { agentLogin: true, verifiedViaOtp: true },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        firstName: sessionUser.profile?.firstName || '',
        lastName: sessionUser.profile?.lastName || '',
        phoneNumber: sessionUser.phoneNumber,
        role: sessionUser.role as UserRole,
        customerType: sessionUser.customerType as CustomerType | undefined,
        kycStatus: sessionUser.kyc?.status as KycStatus || KycStatus.NOT_STARTED,
        isActive: sessionUser.isActive,
        createdAt: sessionUser.createdAt.toISOString(),
      },
    };
  }

  async createAgentPassword(data: CreateAgentPasswordRequest): Promise<{ message: string }> {
    if (!data.email || !validateEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    if (!data.password || !data.confirmPassword) {
      throw new ValidationError('password and confirmPassword are required');
    }

    if (data.password !== data.confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }

    if (data.password.length < 8 || data.password.length > 12) {
      throw new ValidationError('Password must be between 8 and 12 characters long');
    }

    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    const client: any = prisma as any;

    const agent = await client.agent.findUnique({
      where: { email: data.email },
    });

    if (!agent) {
      throw new UnauthorizedError('Agent not found');
    }

    if (!agent.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    if (agent.password) {
      throw new ValidationError('Password has already been set. Please use the login flow.');
    }

    const otpValidation = await this.validateOtp({
      email: data.email,
      otp: data.otp,
      purpose: OtpPurpose.AGENT_SET_PASSWORD,
    });

    if (!otpValidation.valid) {
      throw new ValidationError(otpValidation.message || 'Invalid or expired OTP');
    }

    const hashed = await hashPassword(data.password);

    await client.agent.update({
      where: { id: agent.id },
      data: { password: hashed, isApproved: true },
    });

    const existingUser = await prisma.user.findUnique({
      where: { email: agent.email },
      include: { credentials: true },
    });

    if (existingUser) {
      if (existingUser.credentials) {
        await prisma.userCredential.update({
          where: { id: existingUser.credentials.id },
          data: { passwordHash: hashed },
        });
      } else {
        await prisma.userCredential.create({
          data: {
            userId: existingUser.id,
            passwordHash: hashed,
          },
        });
      }
    }

    return { message: 'Password set successfully' };
  }

  async changeAgentPassword(agentUserId: string, data: { currentPassword: string; newPassword: string; newPasswordConfirm: string }): Promise<{ message: string }> {
    if (!data.currentPassword || !data.newPassword || !data.newPasswordConfirm) {
      throw new ValidationError('currentPassword, newPassword and newPasswordConfirm are required');
    }

    if (data.newPassword !== data.newPasswordConfirm) {
      throw new ValidationError('New password and confirmation do not match');
    }

    const passwordValidation = validatePasswordStrength(data.newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    const user = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: { email: true, role: true },
    });

    if (!user || user.role !== UserRole.AGENT) {
      throw new UnauthorizedError('Only agents can change agent passwords');
    }

    const client = prisma as any;
    const agent = await client.agent.findUnique({
      where: { email: user.email },
    });

    if (!agent || !agent.password) {
      throw new ValidationError('Agent password not set');
    }

    const isCurrentValid = await comparePassword(data.currentPassword, agent.password);
    if (!isCurrentValid) {
      throw new ValidationError('current password not correct');
    }

    const hashed = await hashPassword(data.newPassword);

    await client.agent.update({
      where: { id: agent.id },
      data: { password: hashed },
    });

    await prisma.userCredential.upsert({
      where: { userId: agentUserId },
      update: { passwordHash: hashed, lastPasswordChange: new Date() },
      create: { userId: agentUserId, passwordHash: hashed },
    });

    await prisma.session.updateMany({
      where: { userId: agentUserId, isActive: true },
      data: { isActive: false },
    });

    return { message: 'Password updated successfully' };
  }

  // STEP 1: Verify BVN and return ONLY verification token
  async verifyBvnForSignup(bvn: string): Promise<{
    verificationToken: string;
    message: string;
  }> {
    // Check DB first — before any expensive external call
    const existingKyc = await prisma.userKyc.findFirst({
      where: { bvn },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            customerType: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                address: true,
              },
            },
          },
        },
      },
    });

    if (existingKyc) {
      // User completed full onboarding — hard block
      if (existingKyc.status === KycStatus.VERIFIED) {
        throw new DuplicateError('An account with this BVN already exists');
      }

      // User started but never finished — resume entirely from DB, no mock generation needed
      const storedUser = existingKyc.user;
      const verificationToken = generateId();
      const cacheKey = `bvn:verification:${verificationToken}`;
      const resumedBvnData = {
        bvn,
        firstName: storedUser.profile!.firstName,
        lastName: storedUser.profile!.lastName,
        email: storedUser.email,
        phoneNumber: storedUser.phoneNumber,
        dateOfBirth: storedUser.profile?.dateOfBirth
          ? storedUser.profile.dateOfBirth.toISOString().split('T')[0]
          : null,
        address: storedUser.profile?.address ?? null,
        gender: null,
      };
      await redis.setex(cacheKey, 30 * 60, JSON.stringify(resumedBvnData));

      return {
        verificationToken,
        message: 'BVN recognised. Your previous verification session has been restored. Use the verification token to continue.',
      };
    }

    // New BVN — call the verification service to generate/fetch user data
    const bvnResult = await bvnService.verifyBvn(bvn);

    if (!bvnResult.success || !bvnResult.data) {
      throw new ValidationError(bvnResult.message || 'BVN verification failed');
    }

    // Generate a verification token to track this BVN verification session
    const verificationToken = generateId();

    // Store full BVN data in Redis with 30-minute expiry for later verification steps
    // This keeps sensitive data server-side only
    const cacheKey = `bvn:verification:${verificationToken}`;
    const bvnData = {
      bvn,
      firstName: bvnResult.data.firstName,
      lastName: bvnResult.data.lastName,
      email: bvnResult.data.email!,
      phoneNumber: bvnResult.data.phoneNumber,
      dateOfBirth: bvnResult.data.dateOfBirth,
      address: bvnResult.data.address,
      gender: bvnResult.data.gender,
    };
    await redis.setex(cacheKey, 30 * 60, JSON.stringify(bvnData)); // 30 minutes

    // Return ONLY verification token to frontend
    // All sensitive data remains server-side in Redis
    return {
      verificationToken, // Client must send this token in subsequent steps
      message: 'BVN verified successfully. Use the verification token to proceed.',
    };
  }

  // STEP 2: Send OTP using verification token, return details from Redis
  async sendBvnVerificationOtp(data: {
    verificationToken: string;
    verificationType: 'email' | 'phone';
  }): Promise<{
    message: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    phoneNumber: string;
    gender?: string;
    otp?: string;
  }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    const bvnData = JSON.parse(cachedData);
    const contactValue = data.verificationType === 'email' ? bvnData.email : bvnData.phoneNumber;

    // Send OTP
    const otpResult = await this.sendOtp({
      email: data.verificationType === 'email' ? contactValue : '',
      phoneNumber: data.verificationType === 'phone' ? contactValue : '',
      purpose: OtpPurpose.REGISTRATION,
    });

    // Return user details retrieved from Redis for confirmation
    // Names are visible, email and phone are redacted for privacy
    const response: {
      message: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      email: string;
      phoneNumber: string;
      gender?: string;
      otp?: string;
    } = {
      message: `OTP sent successfully to your ${data.verificationType}`,
      firstName: bvnData.firstName,
      lastName: bvnData.lastName,
      dateOfBirth: bvnData.dateOfBirth,
      email: partiallyRedactField(bvnData.email, 'email'),
      phoneNumber: partiallyRedactField(bvnData.phoneNumber, 'phone'),
      gender: bvnData.gender,
    };

    // Include OTP in non-production environments
    if (otpResult.otp) {
      response.otp = otpResult.otp;
    }

    return response;
  }

  // STEP 3 (OTP Validation): Validate OTP and confirm user data
  async validateBvnOtp(data: {
    verificationToken: string;
    otp: string;
  }): Promise<{
    message: string;
    verificationToken: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    email?: string;
    phoneNumber?: string;
  }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    const bvnData = JSON.parse(cachedData);

    // Validate OTP (email not required, OTP code is sufficient)
    const otpValidation = await this.validateOtp({
      otp: data.otp,
      purpose: OtpPurpose.REGISTRATION,
    });

    if (!otpValidation.valid) {
      throw new ValidationError('OTP validation failed');
    }

    auditService.logAuthEvent({ action: 'OTP_VERIFIED', success: true, metadata: { purpose: 'BVN_REGISTRATION', channel: 'phone' } });

    // Return confirmed user data (only non-sensitive fields with names visible)
    return {
      message: 'OTP validated successfully. Please proceed to create your account.',
      verificationToken: data.verificationToken,
      firstName: bvnData.firstName,
      lastName: bvnData.lastName,
      email: partiallyRedactField(bvnData.email, 'email'),
      phoneNumber: partiallyRedactField(bvnData.phoneNumber, 'phone'),
      address: bvnData.address
    };
  }

  // STEP 3.5: Send OTP to email for Nigerian citizen (after phone OTP validation)
  async sendNigerianEmailOtp(data: {
    verificationToken: string;
  }): Promise<{
    message: string;
    email: string;
    otp?: string;
  }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    const bvnData = JSON.parse(cachedData);

    // Send OTP to email
    const otpResult = await this.sendOtp({
      email: bvnData.email,
      phoneNumber: '', // Email-only OTP
      purpose: OtpPurpose.REGISTRATION,
    });

    // Return redacted email and OTP (for dev/testing)
    return {
      message: 'OTP sent successfully to your email',
      email: partiallyRedactField(bvnData.email, 'email'),
      otp: otpResult.otp,
    };
  }

  // STEP 3.6: Validate email OTP for Nigerian citizen
  async validateNigerianEmailOtp(data: {
    verificationToken: string;
    otp: string;
  }): Promise<{
    message: string;
  }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    // Validate OTP (email not required, OTP code is sufficient)
    const otpValidation = await this.validateOtp({
      otp: data.otp,
      purpose: OtpPurpose.REGISTRATION,
    });

    if (!otpValidation.valid) {
      throw new ValidationError('OTP validation failed');
    }

    auditService.logAuthEvent({ action: 'OTP_VERIFIED', success: true, metadata: { purpose: 'BVN_REGISTRATION', channel: 'email' } });

    return {
      message: 'Email OTP validated successfully. Please proceed to create your account.',
    };
  }

  // STEP 4: After OTP verification, create account with user's password ONLY
  async createNigerianAccount(data: {
    verificationToken: string;
    password: string;
  }): Promise<{ userId: string; message: string }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    const bvnData = JSON.parse(cachedData);

    // Validate password
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user by email or phone
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: bvnData.email }, { phoneNumber: bvnData.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new DuplicateError('User with this email or phone number already exists');
    }

    // Check for existing BVN (this is where the BVN duplicate check should happen)
    const existingKyc = await prisma.userKyc.findUnique({
      where: { bvn: bvnData.bvn },
    });

    if (existingKyc) {
      throw new DuplicateError('An account with this BVN already exists');
    }

    // Hash the user's password
    const passwordHash = await hashPassword(data.password);

    // Create user with BVN data
    const user = await prisma.user.create({
      data: {
        email: bvnData.email,
        phoneNumber: bvnData.phoneNumber,
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
            firstName: bvnData.firstName,
            lastName: bvnData.lastName,
            dateOfBirth: new Date(bvnData.dateOfBirth),
            address: bvnData.address,
          },
        },
        kyc: {
          create: {
            status: KycStatus.VERIFIED,
            bvn: bvnData.bvn,
            bvnVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    // Delete the verification token from cache after successful account creation
    await redis.del(cacheKey);

    // Send welcome email
    if (emailService.isReady()) {
      await emailService.sendWelcomeEmail(bvnData.email, bvnData.firstName);
    }

    // Publish events
    eventBus.publish(EventType.USER_REGISTERED, {
      eventId: generateId(),
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: bvnData.email,
        firstName: bvnData.firstName,
        lastName: bvnData.lastName,
      },
    });

    // Publish BVN verified event for notifications
    eventBus.publish(EventTypes.BVN_VERIFIED, {
      userId: user.id,
      user: {
        id: user.id,
        email: bvnData.email,
        firstName: bvnData.firstName,
        lastName: bvnData.lastName,
      },
    });

    // Publish KYC submitted event (BVN verification counts as KYC submission)
    eventBus.publish(EventTypes.KYC_SUBMITTED, {
      userId: user.id,
      user: {
        id: user.id,
        email: bvnData.email,
        firstName: bvnData.firstName,
        lastName: bvnData.lastName,
      },
      kycType: 'BVN',
    });

    auditService.logAuthEvent({ userId: user.id, action: 'REGISTER', success: true, metadata: { customerType: 'NIGERIAN_CITIZEN', bvnVerified: true } });
    auditService.logAuthEvent({ userId: user.id, action: 'BVN_VERIFIED', success: true });

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  // STEP 1: Verify passport and return verification token with redacted user info
  async verifyPassportForSignup(
    passportDocumentUrl: string,
    passportNumber?: string,
    customerType: 'TOURIST' | 'EXPATRIATE' = 'TOURIST'
  ): Promise<{
    verificationToken: string;
    message: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    phoneNumber: string;
    nationality: string;
  }> {
    // If passport number is supplied, check DB before the expensive OCR call
    if (passportNumber) {
      const existingKyc = await prisma.userKyc.findFirst({
        where: { passportNumber },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              customerType: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  dateOfBirth: true,
                  country: true,
                },
              },
            },
          },
        },
      });

      if (existingKyc) {
        // User completed full onboarding — hard block, skip OCR entirely
        if (existingKyc.status === KycStatus.VERIFIED) {
          throw new DuplicateError('An account with this passport already exists');
        }

        // User started but never finished — resume entirely from DB, skip OCR
        const storedUser = existingKyc.user;
        const verificationToken = generateId();
        const cacheKey = `passport:verification:${verificationToken}`;
        const resumedPassportData = {
          passportNumber,
          passportDocumentUrl: existingKyc.passportDocumentUrl ?? passportDocumentUrl,
          customerType,
          firstName: storedUser.profile!.firstName,
          lastName: storedUser.profile!.lastName,
          email: storedUser.email,
          phoneNumber: storedUser.phoneNumber,
          dateOfBirth: storedUser.profile?.dateOfBirth
            ? storedUser.profile.dateOfBirth.toISOString().split('T')[0]
            : null,
          nationality: storedUser.profile?.country ?? null,
        };
        await redis.setex(cacheKey, 30 * 60, JSON.stringify(resumedPassportData));

        return {
          verificationToken,
          message: 'Passport recognised. Your previous verification session has been restored. Use the verification token to continue.',
          firstName: resumedPassportData.firstName,
          lastName: resumedPassportData.lastName,
          dateOfBirth: resumedPassportData.dateOfBirth ?? '',
          email: partiallyRedactField(resumedPassportData.email, 'email'),
          phoneNumber: partiallyRedactField(resumedPassportData.phoneNumber, 'phone'),
          nationality: resumedPassportData.nationality ?? '',
        };
      }
    }

    // New passport (or number not provided) — run OCR/verification to extract data
    const passportResult = await passportVerificationService.verifyPassport(passportDocumentUrl);

    if (!passportResult.success || !passportResult.data) {
      throw new ValidationError(passportResult.message || 'Passport verification failed');
    }

    // Use provided passport number or the one extracted from OCR
    const finalPassportNumber = passportNumber || passportResult.data.passportNumber;

    // If passport number came from OCR (wasn't supplied), do the DB check now
    if (!passportNumber && finalPassportNumber) {
      const existingKyc = await prisma.userKyc.findFirst({
        where: { passportNumber: finalPassportNumber },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  dateOfBirth: true,
                  country: true,
                },
              },
            },
          },
        },
      });

      if (existingKyc) {
        if (existingKyc.status === KycStatus.VERIFIED) {
          throw new DuplicateError('An account with this passport already exists');
        }

        const storedUser = existingKyc.user;
        const verificationToken = generateId();
        const cacheKey = `passport:verification:${verificationToken}`;
        const resumedPassportData = {
          passportNumber: finalPassportNumber,
          passportDocumentUrl: existingKyc.passportDocumentUrl ?? passportDocumentUrl,
          customerType,
          firstName: storedUser.profile!.firstName,
          lastName: storedUser.profile!.lastName,
          email: storedUser.email,
          phoneNumber: storedUser.phoneNumber,
          dateOfBirth: storedUser.profile?.dateOfBirth
            ? storedUser.profile.dateOfBirth.toISOString().split('T')[0]
            : null,
          nationality: storedUser.profile?.country ?? null,
        };
        await redis.setex(cacheKey, 30 * 60, JSON.stringify(resumedPassportData));

        return {
          verificationToken,
          message: 'Passport recognised. Your previous verification session has been restored. Use the verification token to continue.',
          firstName: resumedPassportData.firstName,
          lastName: resumedPassportData.lastName,
          dateOfBirth: resumedPassportData.dateOfBirth ?? '',
          email: partiallyRedactField(resumedPassportData.email, 'email'),
          phoneNumber: partiallyRedactField(resumedPassportData.phoneNumber, 'phone'),
          nationality: resumedPassportData.nationality ?? '',
        };
      }
    }

    // Generate a verification token to track this passport verification session
    const verificationToken = generateId();

    // Store full passport data in Redis with 30-minute expiry for later verification steps
    // This keeps sensitive data server-side only
    const cacheKey = `passport:verification:${verificationToken}`;
    const passportData = {
      passportNumber: finalPassportNumber,
      passportDocumentUrl,
      customerType,
      firstName: passportResult.data.firstName,
      lastName: passportResult.data.lastName,
      email: passportResult.data.email!,
      phoneNumber: passportResult.data.phoneNumber!,
      dateOfBirth: passportResult.data.dateOfBirth,
      nationality: passportResult.data.nationality,
    };
    await redis.setex(cacheKey, 30 * 60, JSON.stringify(passportData)); // 30 minutes

    // Return verification token with redacted user information
    // Full sensitive data remains server-side in Redis
    return {
      verificationToken, // Client must send this token in subsequent steps
      message: 'Passport verified successfully. Use the verification token to proceed.',
      firstName: passportData.firstName,
      lastName: passportData.lastName,
      dateOfBirth: passportData.dateOfBirth,
      email: partiallyRedactField(passportData.email, 'email'),
      phoneNumber: partiallyRedactField(passportData.phoneNumber, 'phone'),
      nationality: passportData.nationality,
    };
  }

  // STEP 2: Send OTP using verification token, return details from Redis
  async sendPassportVerificationOtp(data: {
    verificationToken: string;
    verificationType: 'email' | 'phone';
  }): Promise<{
    message: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    phoneNumber: string;
    nationality: string;
    otp?: string;
  }> {
    // Retrieve passport data from cache using verification token
    const cacheKey = `passport:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('Passport verification session expired. Please verify your passport again.');
    }

    const passportData = JSON.parse(cachedData);
    const contactValue = data.verificationType === 'email' ? passportData.email : passportData.phoneNumber;

    // Send OTP
    const otpResult = await this.sendOtp({
      email: data.verificationType === 'email' ? contactValue : '',
      phoneNumber: data.verificationType === 'phone' ? contactValue : '',
      purpose: OtpPurpose.REGISTRATION,
    });

    // Return user details retrieved from Redis for confirmation
    // Names are visible, email and phone are redacted for privacy
    const response: {
      message: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      email: string;
      phoneNumber: string;
      nationality: string;
      otp?: string;
    } = {
      message: `OTP sent successfully to your ${data.verificationType}`,
      firstName: passportData.firstName,
      lastName: passportData.lastName,
      dateOfBirth: passportData.dateOfBirth,
      email: partiallyRedactField(passportData.email, 'email'),
      phoneNumber: partiallyRedactField(passportData.phoneNumber, 'phone'),
      nationality: passportData.nationality,
    };

    // Include OTP in non-production environments
    if (otpResult.otp) {
      response.otp = otpResult.otp;
    }

    return response;
  }

  // STEP 3 (OTP Validation): Validate OTP and confirm user data
  async validatePassportOtp(data: {
    verificationToken: string;
    otp: string;
  }): Promise<{
    message: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
  }> {
    // Retrieve passport data from cache using verification token
    const cacheKey = `passport:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('Passport verification session expired. Please verify your passport again.');
    }

    const passportData = JSON.parse(cachedData);

    // Validate OTP (email not required, OTP code is sufficient)
    const otpValidation = await this.validateOtp({
      otp: data.otp,
      purpose: OtpPurpose.REGISTRATION,
    });

    if (!otpValidation.valid) {
      throw new ValidationError('OTP validation failed');
    }

    // Return confirmed user data (only non-sensitive fields with names visible)
    return {
      message: 'OTP validated successfully. Please proceed to create your account.',
      firstName: passportData.firstName,
      lastName: passportData.lastName,
      dateOfBirth: passportData.dateOfBirth,
      nationality: passportData.nationality,
    };
  }

  // STEP 4: After OTP verification, create account with user's password ONLY
  async createTouristAccount(data: {
    verificationToken: string;
    password: string;
  }): Promise<{ userId: string; message: string }> {
    // Retrieve passport data from cache using verification token
    const cacheKey = `passport:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('Passport verification session expired. Please verify your passport again.');
    }

    const passportData = JSON.parse(cachedData);

    // Validate password
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: passportData.email }, { phoneNumber: passportData.phoneNumber }],
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
        email: passportData.email,
        phoneNumber: passportData.phoneNumber,
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
            firstName: passportData.firstName,
            lastName: passportData.lastName,
            dateOfBirth: new Date(passportData.dateOfBirth),
            country: passportData.nationality,
          },
        },
        kyc: {
          create: {
            status: KycStatus.VERIFIED,
            passportNumber: passportData.passportNumber,
            passportDocumentUrl: passportData.passportDocumentUrl,
            passportVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    // Delete the verification token from cache after successful account creation
    await redis.del(cacheKey);

    // Send welcome email
    if (emailService.isReady()) {
      await emailService.sendWelcomeEmail(passportData.email, passportData.firstName);
    }

    // Publish events
    eventBus.publish(EventType.USER_REGISTERED, {
      eventId: generateId(),
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: passportData.email,
        firstName: passportData.firstName,
        lastName: passportData.lastName,
      },
    });

    // Publish KYC submitted event (Passport verification counts as KYC submission)
    eventBus.publish(EventTypes.KYC_SUBMITTED, {
      userId: user.id,
      user: {
        id: user.id,
        email: passportData.email,
        firstName: passportData.firstName,
        lastName: passportData.lastName,
      },
      kycType: 'PASSPORT',
    });

    auditService.logAuthEvent({ userId: user.id, action: 'REGISTER', success: true, metadata: { customerType: 'TOURIST', passportVerified: true } });

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  // STEP 4: Create expatriate account (same as tourist but different customer type)
  async createExpatriateAccount(data: {
    verificationToken: string;
    password: string;
  }): Promise<{ userId: string; message: string }> {
    // Retrieve passport data from cache using verification token
    const cacheKey = `passport:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('Passport verification session expired. Please verify your passport again.');
    }

    const passportData = JSON.parse(cachedData);

    // Validate password
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: passportData.email }, { phoneNumber: passportData.phoneNumber }],
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
        email: passportData.email,
        phoneNumber: passportData.phoneNumber,
        role: UserRole.CUSTOMER,
        customerType: CustomerType.EXPATRIATE,
        emailVerified: true, // Already verified via OTP
        credentials: {
          create: {
            passwordHash,
          },
        },
        profile: {
          create: {
            firstName: passportData.firstName,
            lastName: passportData.lastName,
            dateOfBirth: new Date(passportData.dateOfBirth),
            country: passportData.nationality,
          },
        },
        kyc: {
          create: {
            status: KycStatus.VERIFIED,
            passportNumber: passportData.passportNumber,
            passportDocumentUrl: passportData.passportDocumentUrl,
            passportVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    // Delete the verification token from cache after successful account creation
    await redis.del(cacheKey);

    // Send welcome email
    if (emailService.isReady()) {
      await emailService.sendWelcomeEmail(passportData.email, passportData.firstName);
    }

    // Publish events
    eventBus.publish(EventType.USER_REGISTERED, {
      eventId: generateId(),
      source: ServiceName.AUTH,
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        userId: user.id,
        email: passportData.email,
        firstName: passportData.firstName,
        lastName: passportData.lastName,
      },
    });

    // Publish KYC submitted event (Passport verification counts as KYC submission)
    eventBus.publish(EventTypes.KYC_SUBMITTED, {
      userId: user.id,
      user: {
        id: user.id,
        email: passportData.email,
        firstName: passportData.firstName,
        lastName: passportData.lastName,
      },
      kycType: 'PASSPORT',
    });

    auditService.logAuthEvent({ userId: user.id, action: 'REGISTER', success: true, metadata: { customerType: 'EXPATRIATE', passportVerified: true } });

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  async sendOtp(data: OtpRequest): Promise<{ message: string; otp?: string }> {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await prisma.otpLog.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        otp,
        purpose: data.purpose as any,
        expiresAt,
      },
    });

    // Cache OTP in Redis for faster validation
    // Store with both email/phone key and OTP-only key for flexible validation
    const cacheKey = `otp:${data.email || data.phoneNumber}:${data.purpose}`;
    await redis.setex(cacheKey, OTP_EXPIRY_MINUTES * 60, otp);

    // Also store with OTP code as key for validation without email/phone
    const otpOnlyKey = `otp:code:${otp}:${data.purpose}`;
    const otpData = JSON.stringify({
      email: data.email,
      phoneNumber: data.phoneNumber,
      otp,
      purpose: data.purpose,
    });
    await redis.setex(otpOnlyKey, OTP_EXPIRY_MINUTES * 60, otpData);

    // Send OTP via email if email service is configured
    if (emailService.isReady() && data.email) {
      if (data.purpose === OtpPurpose.AGENT_SET_PASSWORD) {
        // Special welcome email for new agents
        const client: any = prisma as any;
        const agent = await client.agent.findUnique({
          where: { email: data.email },
          select: { name: true },
        });
        await emailService.sendAgentWelcomeEmail(data.email, agent?.name || 'Agent', otp);
      } else {
        await emailService.sendOtpEmail(data.email, otp, data.purpose);
      }
    } else {
      // Log OTP for development
      logger.info('OTP generated for development', {
        recipient: data.email || data.phoneNumber,
        otp,
        purpose: data.purpose,
      });
    }

    // Send OTP via SMS (Termii) when phone number is available
    if (data.phoneNumber && process.env.SMS_API_KEY) {
      try {
        await smsClient.sendOtp(data.phoneNumber, otp, data.purpose);
        logger.info('OTP sent via SMS', { phoneNumber: data.phoneNumber, purpose: data.purpose });
      } catch (smsError: any) {
        logger.error('Failed to send OTP via SMS', { phoneNumber: data.phoneNumber, error: smsError.message });
        // Don't throw — OTP is still valid, email may have been sent
      }
    }

    return {
      message: 'OTP sent successfully',
      otp,
    };
  }

  async validateOtp(data: OtpValidationRequest): Promise<{ valid: boolean; message: string }> {
    let email = data.email;

    // If email not provided, look up by OTP code
    if (!email) {
      const otpOnlyKey = `otp:code:${data.otp}:${data.purpose}`;
      const otpDataStr = await redis.get(otpOnlyKey);

      if (otpDataStr) {
        const otpData = JSON.parse(otpDataStr);
        email = otpData.email;

        // Delete the OTP-only key
        await redis.del(otpOnlyKey);

        // Also delete the email/phone key if it exists
        if (email) {
          const cacheKey = `otp:${email}:${data.purpose}`;
          await redis.del(cacheKey);
        }

        // Mark OTP as used in database
        await prisma.otpLog.updateMany({
          where: {
            otp: data.otp,
            purpose: data.purpose as any,
            isUsed: false,
          },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });

        return { valid: true, message: 'OTP validated successfully' };
      }
    }

    // Check Redis cache with email if provided
    if (email) {
      const cacheKey = `otp:${email}:${data.purpose}`;
      const cachedOtp = await redis.get(cacheKey);

      if (cachedOtp && cachedOtp === data.otp) {
        // Mark OTP as used
        await redis.del(cacheKey);

        // Also delete OTP-only key
        const otpOnlyKey = `otp:code:${data.otp}:${data.purpose}`;
        await redis.del(otpOnlyKey);

        await prisma.otpLog.updateMany({
          where: {
            email: email,
            purpose: data.purpose as any,
            otp: data.otp,
            isUsed: false,
          },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });

        // Update user verification status if needed
        if (data.purpose === OtpPurpose.REGISTRATION && email) {
          const user = await prisma.user.update({
            where: { email: email },
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
    }

    // Check database - build where clause based on available data
    const whereClause: any = {
      purpose: data.purpose as any,
      otp: data.otp,
      isUsed: false,
      expiresAt: { gt: new Date() },
    };

    // Only filter by email if provided
    if (email) {
      whereClause.email = email;
    }

    const otpLog = await prisma.otpLog.findFirst({
      where: whereClause,
    });

    if (!otpLog) {
      // Increment attempts
      const updateWhereClause: any = {
        purpose: data.purpose as any,
        otp: data.otp,
      };
      if (email) {
        updateWhereClause.email = email;
      }

      await prisma.otpLog.updateMany({
        where: updateWhereClause,
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

    // Use longer expiration for mobile devices (1 hour instead of 15 minutes)
    const tokenExpiry = getAccessTokenExpiry(session.userAgent || undefined);
    const accessToken = generateAccessToken(tokenPayload, tokenExpiry);

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

    const kycUpdate: Record<string, any> = {
      passportNumber: data.passportNumber,
      status: KycStatus.PENDING_VERIFICATION,
    };

    // Verify BVN via NIBSS BIVS if provided
    if (data.bvn) {
      logger.info('Verifying BVN via NIBSS in verifyKyc', {
        userId: data.userId,
        bvn: `***${data.bvn.slice(-4)}`,
      });

      const bvnResult = await bvnService.verifyBvn(data.bvn);

      if (!bvnResult.success) {
        throw new ValidationError(bvnResult.message || 'BVN verification failed');
      }

      kycUpdate.bvn = data.bvn;
      kycUpdate.bvnVerified = true;

      logger.info('BVN verified successfully in verifyKyc', { userId: data.userId });
    }

    // Verify TIN via NIBSS BIVS if provided
    if (data.tin) {
      logger.info('Verifying TIN via NIBSS in verifyKyc', {
        userId: data.userId,
        tin: `***${data.tin.slice(-4)}`,
      });

      const tinResult = await tinService.verifyTin(data.tin);

      if (!tinResult.success) {
        throw new ValidationError(tinResult.message || 'TIN verification failed');
      }

      kycUpdate.tin = data.tin;
      kycUpdate.tinVerified = true;

      logger.info('TIN verified successfully in verifyKyc', { userId: data.userId });
    }

    await prisma.userKyc.update({
      where: { userId: data.userId },
      data: kycUpdate,
    });

    auditService.logAuthEvent({
      userId: data.userId,
      action: 'KYC_VERIFIED' as any,
      success: true,
      metadata: {
        bvnVerified: !!data.bvn,
        tinVerified: !!data.tin,
      },
    });

    return {
      message: 'KYC verification completed successfully',
    };
  }

  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        kyc: true,
        sessions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Redact sensitive information
    const userProfile = {
      id: user.id,
      email: user.email,
      phoneNumber: partiallyRedactField(user.phoneNumber, 'phone'),
      role: user.role,
      customerType: user.customerType,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile ? {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        dateOfBirth: user.profile.dateOfBirth,
        address: user.profile.address,
        city: user.profile.city,
        state: user.profile.state,
        country: user.profile.country,
        postalCode: user.profile.postalCode,
        avatar: user.profile.avatar,
      } : null,
      kyc: user.kyc ? {
        status: user.kyc.status,
        bvn: user.kyc.bvn ? partiallyRedactField(user.kyc.bvn, 'bvn') : null,
        nin: user.kyc.nin ? partiallyRedactField(user.kyc.nin, 'nin') : null,
        tin: user.kyc.tin,
        passportNumber: user.kyc.passportNumber,
        passportDocumentUrl: user.kyc.passportDocumentUrl,
        bvnVerified: user.kyc.bvnVerified,
        ninVerified: user.kyc.ninVerified,
        tinVerified: user.kyc.tinVerified,
        passportVerified: user.kyc.passportVerified,
        verifiedAt: user.kyc.verifiedAt,
        rejectedAt: user.kyc.rejectedAt,
        rejectionReason: user.kyc.rejectionReason,
      } : null,
      permissions: this.getUserPermissions(user.role),
      activeSessions: user.sessions,
    };

    return userProfile;
  }

  async forgotPassword(email: string): Promise<{ message: string; otp?: string }> {
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true, role: true },
    });

    // Always return the same message to prevent email enumeration
    if (!user || !user.isActive || user.role !== UserRole.CUSTOMER) {
      return {
        message: 'If an account with that email exists, a password reset OTP has been sent',
      };
    }

    const otpResult = await this.sendOtp({
      email,
      phoneNumber: '',
      purpose: OtpPurpose.PASSWORD_RESET,
    });

    // Publish password reset requested event for notifications
    eventBus.publish(EventTypes.PASSWORD_RESET_REQUESTED, {
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
      },
    });

    logger.info('Forgot password OTP sent', { userId: user.id });

    return {
      message: 'If an account with that email exists, a password reset OTP has been sent',
      otp: otpResult.otp,
    };
  }

  async verifyResetOtp(data: {
    email: string;
    otp: string;
  }): Promise<{ resetToken: string; message: string }> {
    if (!validateEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, isActive: true, role: true },
    });

    if (!user || !user.isActive || user.role !== UserRole.CUSTOMER) {
      throw new ValidationError('Invalid email or OTP');
    }

    const otpValidation = await this.validateOtp({
      email: data.email,
      otp: data.otp,
      purpose: OtpPurpose.PASSWORD_RESET,
    });

    if (!otpValidation.valid) {
      throw new ValidationError(otpValidation.message);
    }

    // Issue a short-lived reset token (10 minutes) so the client can set a new password
    const resetToken = generateId();
    const resetKey = `password:reset:${resetToken}`;
    await redis.setex(resetKey, 10 * 60, user.id);

    logger.info('Password reset OTP verified', { userId: user.id });

    return {
      resetToken,
      message: 'OTP verified successfully. Use the reset token to set your new password.',
    };
  }

  async resetPassword(data: {
    resetToken: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    const resetKey = `password:reset:${data.resetToken}`;
    const userId = await redis.get(resetKey);

    if (!userId) {
      throw new ValidationError('Invalid or expired reset token. Please restart the forgot password flow.');
    }

    const passwordValidation = validatePasswordStrength(data.newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Get user details for email notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            firstName: true
          }
        }
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Consume the token immediately to prevent reuse
    await redis.del(resetKey);

    const passwordHash = await hashPassword(data.newPassword);

    await prisma.userCredential.upsert({
      where: { userId },
      update: { passwordHash, lastPasswordChange: new Date() },
      create: { userId, passwordHash },
    });

    // Invalidate all active sessions for security
    await prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Send password reset confirmation email
    try {
      const firstName = user.profile?.firstName || 'User';
      await emailService.sendPasswordResetConfirmationEmail(user.email, firstName);
      logger.info('Password reset confirmation email sent', { userId });
    } catch (error) {
      logger.error('Failed to send password reset confirmation email', { userId, error });
      // Don't fail the password reset if email fails
    }

    // Publish password reset completed event for notifications
    eventBus.publish(EventTypes.PASSWORD_RESET_COMPLETED, {
      userId,
      user: {
        id: userId,
        email: user.email,
        firstName: user.profile?.firstName,
      },
    });

    logger.info('Password reset successfully', { userId });

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  private getUserPermissions(role: string): string[] {
    const permissionMap: Record<string, string[]> = {
      CUSTOMER: [
        'transactions.create',
        'transactions.view.own',
        'profile.view',
        'profile.update',
        'kyc.submit',
        'kyc.view.own',
        'documents.upload',
        'documents.view.own',
        'payments.initiate',
        'payments.view.own',
      ],
      ADMIN: [
        'transactions.view.all',
        'transactions.approve',
        'transactions.reject',
        'users.view.all',
        'users.manage',
        'kyc.review',
        'kyc.approve',
        'kyc.reject',
        'documents.view.all',
        'payments.view.all',
        'reports.view',
        'admin.actions.perform',
      ],
      COMPLIANCE_OFFICER: [
        'transactions.view.all',
        'transactions.review',
        'transactions.flag',
        'users.view.all',
        'kyc.review',
        'kyc.approve',
        'kyc.reject',
        'compliance.review',
        'compliance.flag',
        'documents.view.all',
        'reports.view',
        'audit.view',
      ],
      OPERATIONS: [
        'transactions.view.all',
        'transactions.process',
        'payments.process',
        'payments.view.all',
        'users.view.all',
        'kyc.view.all',
        'documents.view.all',
        'reports.view',
      ],
      SUPER_ADMIN: [
        'transactions.view.all',
        'transactions.approve',
        'transactions.reject',
        'transactions.delete',
        'users.view.all',
        'users.manage',
        'users.delete',
        'kyc.review',
        'kyc.approve',
        'kyc.reject',
        'documents.view.all',
        'documents.delete',
        'payments.view.all',
        'payments.process',
        'reports.view',
        'reports.generate',
        'admin.actions.perform',
        'admin.users.manage',
        'roles.manage',
        'departments.manage',
        'system.settings',
        'audit.view',
        'compliance.review',
        'compliance.flag',
      ],
    };

    return permissionMap[role] || [];
  }
}

export default new AuthService();
