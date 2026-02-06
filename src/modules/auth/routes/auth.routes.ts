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
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *     responses:
 *       201:
 *         description: Account created successfully
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
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: tourist@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       201:
 *         description: Account created successfully
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
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
