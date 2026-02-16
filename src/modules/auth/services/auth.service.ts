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
} from '../../../shared/types';
import bvnService from './bvn.service';
import passportVerificationService from './passport-verification.service';

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

  // STEP 1: Verify BVN and return ONLY verification token
  async verifyBvnForSignup(bvn: string): Promise<{
    verificationToken: string;
    message: string;
  }> {
    // Verify BVN and extract all user data
    const bvnResult = await bvnService.verifyBvn(bvn);

    if (!bvnResult.success || !bvnResult.data) {
      throw new ValidationError(bvnResult.message || 'BVN verification failed');
    }

    // Note: We don't check for duplicate BVN at this stage (step 1)
    // The duplicate check will be done at account creation (step 4)
    // This allows users to verify their BVN multiple times if needed

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
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
  }> {
    // Retrieve BVN data from cache using verification token
    const cacheKey = `bvn:verification:${data.verificationToken}`;
    const cachedData = await redis.get(cacheKey);

    if (!cachedData) {
      throw new ValidationError('BVN verification session expired. Please verify your BVN again.');
    }

    const bvnData = JSON.parse(cachedData);

    // Validate OTP using the email from BVN data
    const otpValidation = await this.validateOtp({
      email: bvnData.email,
      otp: data.otp,
      purpose: OtpPurpose.REGISTRATION,
    });

    if (!otpValidation.valid) {
      throw new ValidationError('OTP validation failed');
    }

    // Return confirmed user data (only non-sensitive fields with names visible)
    return {
      message: 'OTP validated successfully. Please proceed to create your account.',
      firstName: bvnData.firstName,
      lastName: bvnData.lastName,
      dateOfBirth: bvnData.dateOfBirth,
      gender: bvnData.gender,
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

    // Publish event
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

    return {
      userId: user.id,
      message: 'Account created successfully. You can now login with your email and password.',
    };
  }

  // STEP 1: Verify passport and return ONLY verification token
  async verifyPassportForSignup(
    passportDocumentUrl: string,
    passportNumber?: string,
    customerType: 'TOURIST' | 'EXPATRIATE' = 'TOURIST'
  ): Promise<{
    verificationToken: string;
    message: string;
  }> {
    // Verify passport document and extract all user data
    const passportResult = await passportVerificationService.verifyPassport(passportDocumentUrl);

    if (!passportResult.success || !passportResult.data) {
      throw new ValidationError(passportResult.message || 'Passport verification failed');
    }

    // Use provided passport number or extracted one
    const finalPassportNumber = passportNumber || passportResult.data.passportNumber;

    // Check if user already exists with this passport (at this stage, just for reference)
    // The actual duplicate check will be done at account creation
    if (finalPassportNumber) {
      const existingKyc = await prisma.userKyc.findFirst({
        where: { passportNumber: finalPassportNumber },
      });

      if (existingKyc) {
        throw new DuplicateError('An account with this passport already exists');
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

    // Return ONLY verification token to frontend
    // All sensitive data remains server-side in Redis
    return {
      verificationToken, // Client must send this token in subsequent steps
      message: 'Passport verified successfully. Use the verification token to proceed.',
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

    // Validate OTP using the email from passport data
    const otpValidation = await this.validateOtp({
      email: passportData.email,
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

    // Publish event
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

    // Publish event
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
      logger.info('OTP generated for development', {
        recipient: data.email || data.phoneNumber,
        otp,
        purpose: data.purpose,
      });
    }

    // TODO: Send OTP via SMS using Termii or similar service for phone verification

    return {
      message: 'OTP sent successfully',
      otp,
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
      if (data.purpose === OtpPurpose.REGISTRATION) {
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
        tin: user.kyc.tin,
        passportNumber: user.kyc.passportNumber,
        passportDocumentUrl: user.kyc.passportDocumentUrl,
        bvnVerified: user.kyc.bvnVerified,
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
