import { Router, Request, Response, NextFunction } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authRateLimiter } from '../../../shared/middleware';

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Standard user registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phoneNumber:
 *                 type: string
 *                 example: +2348012345678
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// Public routes
router.post('/signup', authRateLimiter, authController.signup);

/**
 * @swagger
 * /api/auth/signup/nigerian/verify-bvn:
 *   post:
 *     summary: Step 1 - Verify Nigerian BVN for signup
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bvn
 *               - firstName
 *               - lastName
 *               - dateOfBirth
 *             properties:
 *               bvn:
 *                 type: string
 *                 example: "12345678901"
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *     responses:
 *       200:
 *         description: BVN verified successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// Nigerian signup flow (4 steps)
router.post('/signup/nigerian/verify-bvn', authRateLimiter, authController.verifyBvn); // Step 1
/**
 * @swagger
 * /api/auth/signup/nigerian/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for Nigerian signup
 *     description: Send OTP to phone or email for verification. Choose verification type based on preference.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bvn
 *               - verificationType
 *             properties:
 *               bvn:
 *                 type: string
 *                 description: BVN from step 1
 *                 example: "12345678901"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email)
 *                 example: phone
 *               phoneNumber:
 *                 type: string
 *                 description: Required if verificationType is 'phone'
 *                 example: "+2348012345678"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Required if verificationType is 'email'
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP sent successfully to your phone
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/send-otp', authRateLimiter, authController.sendBvnOtp); // Step 2
// Step 3: Use existing /otp/validate endpoint

/**
 * @swagger
 * /api/auth/signup/nigerian/create-account:
 *   post:
 *     summary: Step 4 - Create Nigerian user account
 *     description: Create account after BVN verification and OTP validation. Include all BVN data from step 1.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bvn
 *               - firstName
 *               - lastName
 *               - email
 *               - phoneNumber
 *               - dateOfBirth
 *               - password
 *             properties:
 *               bvn:
 *                 type: string
 *                 description: BVN from step 1 verification
 *                 example: "12345678901"
 *               firstName:
 *                 type: string
 *                 description: First name from BVN verification
 *                 example: Chinedu
 *               lastName:
 *                 type: string
 *                 description: Last name from BVN verification
 *                 example: Okafor
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number verified in step 3
 *                 example: "+2348012345678"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Date of birth from BVN verification
 *                 example: "1990-05-15"
 *               address:
 *                 type: string
 *                 description: Optional address from BVN verification
 *                 example: "123 Lagos Street, Victoria Island"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User's chosen password
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     message:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/create-account', authRateLimiter, authController.createNigerianAccount); // Step 4

/**
 * @swagger
 * /api/auth/signup/tourist/verify-passport:
 *   post:
 *     summary: Step 1 - Verify tourist passport for signup
 *     description: Upload and verify passport document. The system extracts passport information automatically.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passportDocumentUrl
 *             properties:
 *               passportDocumentUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL of the uploaded passport document (upload via /api/auth/kyc/passport/upload first)
 *                 example: "https://cloudinary.com/passport/abc123.jpg"
 *     responses:
 *       200:
 *         description: Passport verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     passportNumber:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                     nationality:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// Tourist signup flow (4 steps)
router.post('/signup/tourist/verify-passport', authRateLimiter, authController.verifyPassport); // Step 1
/**
 * @swagger
 * /api/auth/signup/tourist/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for tourist signup
 *     description: Send OTP to phone or email for verification. Choose verification type based on preference.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passportNumber
 *               - verificationType
 *             properties:
 *               passportNumber:
 *                 type: string
 *                 description: Passport number from step 1
 *                 example: "A12345678"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email)
 *                 example: phone
 *               phoneNumber:
 *                 type: string
 *                 description: Required if verificationType is 'phone'
 *                 example: "+447123456789"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Required if verificationType is 'email'
 *                 example: tourist@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP sent successfully to your phone
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/send-otp', authRateLimiter, authController.sendPassportOtp); // Step 2
// Step 3: Use existing /otp/validate endpoint

/**
 * @swagger
 * /api/auth/signup/tourist/create-account:
 *   post:
 *     summary: Step 4 - Create tourist user account
 *     description: Create account after passport verification and OTP validation. Include all passport data from step 1.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passportNumber
 *               - passportDocumentUrl
 *               - firstName
 *               - lastName
 *               - email
 *               - phoneNumber
 *               - dateOfBirth
 *               - nationality
 *               - password
 *             properties:
 *               passportNumber:
 *                 type: string
 *                 description: Passport number from step 1 verification
 *                 example: "A12345678"
 *               passportDocumentUrl:
 *                 type: string
 *                 format: uri
 *                 description: Passport document URL from step 1
 *                 example: "https://cloudinary.com/passport/abc123.jpg"
 *               firstName:
 *                 type: string
 *                 description: First name from passport verification
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Last name from passport verification
 *                 example: Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: tourist@example.com
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number verified in step 3
 *                 example: "+447123456789"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Date of birth from passport verification
 *                 example: "1985-03-15"
 *               nationality:
 *                 type: string
 *                 description: Nationality from passport
 *                 example: "United Kingdom"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User's chosen password
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     message:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/create-account', authRateLimiter, authController.createTouristAccount); // Step 4

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 */
router.post('/login', authRateLimiter, authController.login);

/**
 * @swagger
 * /api/auth/otp/send:
 *   post:
 *     summary: Send OTP to user
 *     description: Send OTP to phone or email. Provide either phoneNumber or email based on preference.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number to receive OTP via SMS
 *                 example: "+2348012345678"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to receive OTP
 *                 example: user@example.com
 *               purpose:
 *                 type: string
 *                 enum: [REGISTRATION, LOGIN, PASSWORD_RESET, TRANSACTION_VERIFICATION]
 *                 description: Purpose of the OTP
 *                 example: REGISTRATION
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP sent successfully
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       429:
 *         description: Too many requests
 */
router.post('/otp/send', authRateLimiter, authController.sendOtp);

/**
 * @swagger
 * /api/auth/otp/validate:
 *   post:
 *     summary: Validate OTP code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP validated successfully
 *       400:
 *         description: Invalid OTP
 *       429:
 *         description: Too many requests
 */
router.post('/otp/validate', authRateLimiter, authController.validateOtp);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/refresh', authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Protected routes
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/auth/kyc/verify:
 *   post:
 *     summary: Verify KYC information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [BVN, PASSPORT, DRIVERS_LICENSE, NATIONAL_ID]
 *               documentNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC verification initiated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/kyc/verify', authenticate, authController.verifyKyc);

/**
 * @swagger
 * /api/auth/kyc/passport/upload:
 *   post:
 *     summary: Upload passport for verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               passport:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Passport uploaded successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/kyc/passport/upload', authenticate, authController.uploadPassport);

/**
 * @swagger
 * /api/auth/kyc/passport/status:
 *   get:
 *     summary: Get passport verification status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [PENDING, APPROVED, REJECTED]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/kyc/passport/status', authenticate, authController.getPassportVerificationStatus);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
// Health check
router.get('/health', authController.healthCheck);

export default router;
