import { Router } from 'express';
import authController from '../controllers/auth.controller';
import agentAuthController from '../../agents/controllers/agent-auth.controller';
import { authenticate, uploadPassport } from '../../../shared/middleware';

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
router.post('/signup', authController.signup);

/**
 * @swagger
 * /api/auth/signup/nigerian/verify-bvn:
 *   post:
 *     summary: "Nigerian signup — Step 1a: Initiate BVN consent"
 *     description: |
 *       Initiates the NIBSS Consent Hub flow for BVN verification.
 *
 *       **Important:** This endpoint does NOT return a `verificationToken`. It returns a
 *       `sessionId` and a `consentUrl`. The frontend must:
 *       1. Redirect or open `consentUrl` so the user can authenticate on the NIBSS portal.
 *       2. Poll **Step 1b** (`POST /api/auth/signup/nigerian/bvn-consent-status`) with the
 *          returned `sessionId` until `status` becomes `"COMPLETED"`.
 *       3. Save the `verificationToken` from the Step 1b response — this is what all
 *          subsequent steps (send-otp, validate-otp, create-account) require.
 *
 *       **Do NOT call send-otp before Step 1b returns `COMPLETED`.**
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bvn
 *             properties:
 *               bvn:
 *                 type: string
 *                 description: 11-digit BVN number
 *                 example: "12345678901"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Optional — used as fallback if BVN has no email on record
 *                 example: "user@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: Optional — used as fallback if BVN has no phone on record
 *                 example: "+2348012345678"
 *     responses:
 *       200:
 *         description: Consent initiated — redirect user to consentUrl, then poll bvn-consent-status
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
 *                     sessionId:
 *                       type: string
 *                       description: Use this in Step 1b (bvn-consent-status) to poll for completion
 *                       example: "202615269624757096223712376916"
 *                     consentUrl:
 *                       type: string
 *                       description: Open this URL so the user can authenticate on the NIBSS portal
 *                       example: "https://consent.nibss-plc.com.ng/auth?session=abc123"
 *                     message:
 *                       type: string
 *                       example: "BVN consent initiated. Please authenticate on the NIBSS portal to continue."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
/**
 * @swagger
 * /api/auth/signup/nigerian/bvn-consent-status:
 *   post:
 *     summary: "Nigerian signup — Step 1b: Poll BVN consent status"
 *     description: |
 *       Polls the status of the NIBSS consent initiated in Step 1a. The frontend must call
 *       this endpoint repeatedly (e.g. every 2–3 seconds) until `status` is `"COMPLETED"`
 *       or `"FAILED"`.
 *
 *       - **PENDING** — user has not yet authenticated on the NIBSS portal. Keep polling.
 *       - **COMPLETED** — NIBSS callback received and BVN data verified. The response includes
 *         a `verificationToken` — **save this token**. It is required for all subsequent steps
 *         (send-otp, validate-otp, create-account). Valid for 30 minutes.
 *       - **FAILED** — verification failed (e.g. user denied consent, NIBSS error). Restart
 *         from Step 1a.
 *
 *       **Do NOT call send-otp before this endpoint returns `status: "COMPLETED"`.**
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: The sessionId returned from Step 1a (verify-bvn)
 *                 example: "202615269624757096223712376916"
 *     responses:
 *       200:
 *         description: Consent status response
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
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, FAILED]
 *                       description: |
 *                         PENDING = still waiting for user to authenticate on NIBSS portal.
 *                         COMPLETED = BVN verified, verificationToken is available.
 *                         FAILED = verification failed, must restart from Step 1a.
 *                       example: "COMPLETED"
 *                     verificationToken:
 *                       type: string
 *                       description: |
 *                         Only present when status is COMPLETED. Use this token in all
 *                         subsequent steps (send-otp, validate-otp, create-account).
 *                         Valid for 30 minutes.
 *                       example: "abc123xyz789"
 *                     message:
 *                       type: string
 *                       example: "BVN verified successfully. Use the verification token to proceed."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// iGree callback — NIBSS redirects here with ?code=...&state=... after user authenticates
router.get('/nibss/igree/callback', authController.iGreeCallback);
router.post('/nibss/igree/callback', authController.iGreeCallback);

// NIBSS Consent Hub callback is mounted at /callback (top-level) in app.ts

// Nigerian signup flow (4 steps)
router.post('/signup/nigerian/verify-bvn', authController.verifyBvn); // Step 1a: initiates consent, returns sessionId + consentUrl
router.post('/signup/nigerian/bvn-consent-status', authController.checkBvnConsentStatus); // Step 1b: poll until COMPLETED, returns verificationToken
/**
 * @swagger
 * /api/auth/signup/nigerian/send-otp:
 *   post:
 *     summary: "Nigerian signup — Step 2: Send OTP"
 *     description: |
 *       Sends an OTP to the user's phone or email address retrieved from the verified BVN data.
 *
 *       **Prerequisite:** The `verificationToken` must come from Step 1b
 *       (`POST /api/auth/signup/nigerian/bvn-consent-status`) **after** it returns
 *       `status: "COMPLETED"`. Calling this endpoint with a token from a previous session,
 *       or before Step 1b completes, will result in a 400 "BVN verification session expired" error.
 *
 *       The contact details (phone/email) are looked up server-side from the token — the
 *       frontend does not need to supply them.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: |
 *                   Token from Step 1b (bvn-consent-status) once status is COMPLETED.
 *                   Valid for 30 minutes.
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Whether to send the OTP to the BVN-registered phone or email
 *                 example: phone
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
 *                     firstName:
 *                       type: string
 *                       description: First name from BVN data (for display purposes)
 *                       example: "Chinedu"
 *                     lastName:
 *                       type: string
 *                       description: Last name from BVN data
 *                       example: "Okafor"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       description: Date of birth from BVN data
 *                       example: "1990-05-15"
 *                     email:
 *                       type: string
 *                       description: Partially redacted email from BVN data
 *                       example: "c***@example.com"
 *                     phoneNumber:
 *                       type: string
 *                       description: Partially redacted phone from BVN data
 *                       example: "+234****5678"
 *                     gender:
 *                       type: string
 *                       description: Gender from BVN data
 *                       example: "Male"
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       400:
 *         description: |
 *           Invalid or expired verificationToken. This usually means Step 1b was not
 *           completed before calling this endpoint, or the 30-minute session has expired.
 *           Restart from Step 1a (verify-bvn).
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/send-otp', authController.sendBvnOtp); // Step 2

/**
 * @swagger
 * /api/auth/signup/nigerian/resend-otp:
 *   post:
 *     summary: Resend OTP for Nigerian signup
 *     description: Resend OTP to phone or email during the Nigerian signup flow. Uses the same verification token from step 1.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email)
 *                 example: phone
 *     responses:
 *       200:
 *         description: OTP resent successfully
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
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/resend-otp', authController.sendBvnOtp);

/**
 * @swagger
 * /api/auth/signup/nigerian/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for Nigerian signup
 *     description: Validate the OTP sent to email or phone. Email is retrieved from the verification token stored server-side. Returns confirmed user data after successful validation.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - otp
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains email server-side)
 *                 example: "abc123xyz789"
 *               otp:
 *                 type: string
 *                 description: OTP received via email or phone
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP validated successfully
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
 *                       example: "OTP validated successfully. Please proceed to create your account."
 *                     firstName:
 *                       type: string
 *                       example: "Chinedu"
 *                     lastName:
 *                       type: string
 *                       example: "Okafor"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1990-05-15"
 *                     gender:
 *                       type: string
 *                       example: "Male"
 *       400:
 *         description: Invalid OTP or verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/validate-otp', authController.validateBvnOtp); // Step 3

/**
 * @swagger
 * /api/auth/signup/nigerian/send-email-otp:
 *   post:
 *     summary: Step 3.5 - Send OTP to email for Nigerian citizen
 *     description: After validating the phone OTP from BVN, send an additional OTP to the user's email for verification.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (BVN verification)
 *                 example: "abc123xyz789"
 *     responses:
 *       200:
 *         description: OTP sent successfully to email
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
 *                       example: "OTP sent successfully to your email"
 *                     email:
 *                       type: string
 *                       description: Redacted email address
 *                       example: "c***@example.com"
 *                     otp:
 *                       type: string
 *                       description: OTP code (only in development)
 *                       example: "123456"
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/send-email-otp', authController.sendNigerianEmailOtp); // Step 3.5

/**
 * @swagger
 * /api/auth/signup/nigerian/resend-email-otp:
 *   post:
 *     summary: Resend email OTP for Nigerian signup
 *     description: Resend OTP to email during step 3.5 of the Nigerian signup flow. Uses the same verification token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *     responses:
 *       200:
 *         description: Email OTP resent successfully
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
 *                       example: OTP sent successfully to your email
 *                     email:
 *                       type: string
 *                       example: "c***@example.com"
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/resend-email-otp', authController.sendNigerianEmailOtp);

/**
 * @swagger
 * /api/auth/signup/nigerian/validate-email-otp:
 *   post:
 *     summary: Step 3.6 - Validate email OTP for Nigerian citizen
 *     description: Validate the OTP sent to the user's email address.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - otp
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (BVN verification)
 *                 example: "abc123xyz789"
 *               otp:
 *                 type: string
 *                 description: OTP code received via email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email OTP validated successfully
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
 *                       example: "Email OTP validated successfully. Please proceed to create your account."
 *       400:
 *         description: Invalid OTP or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/validate-email-otp', authController.validateNigerianEmailOtp); // Step 3.6

/**
 * @swagger
 * /api/auth/signup/nigerian/create-account:
 *   post:
 *     summary: Step 4 - Create Nigerian user account with password only
 *     description: Create account after BVN verification and OTP validation. Only password and verification token are required - all user information (email, name, DOB, phone, address) is retrieved server-side from the verification token for security.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - password
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains all BVN data server-side including email)
 *                 example: "abc123xyz789"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User's chosen password. All other information (email, name, DOB, phone, address) comes from BVN data stored server-side.
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
 *                       example: "user_abc123"
 *                     message:
 *                       type: string
 *                       example: "Account created successfully. You can now login with your email and password."
 *       400:
 *         description: Invalid or expired verification token, or validation error
 *       429:
 *         description: Too many requests
 */
router.post('/signup/nigerian/create-account', authController.createNigerianAccount); // Step 4

/**
 * @swagger
 * /api/auth/signup/tourist/verify-passport:
 *   post:
 *     summary: "Tourist signup — Step 1: Verify passport"
 *     description: |
 *       Verifies the tourist's passport via the QoreID API and starts a 30-minute verification session.
 *
 *       **Identity source:** QoreID passport verification (requires `passportNumber`).
 *       When QoreID credentials are not configured, the server falls back to a dev mock.
 *
 *       **Contact info:** QoreID does not return email or phone number. The frontend **must**
 *       supply `email` and `phoneNumber` in this request — they are stored server-side and used
 *       to send the OTP in Step 2.
 *
 *       **At least one of** `passportNumber` or `passportDocumentUrl` is required.
 *       Providing `passportNumber` enables live QoreID verification. `passportDocumentUrl`
 *       is only used as a fallback identifier when a passport number is not available.
 *
 *       On success a `verificationToken` is returned. All sensitive data is stored server-side
 *       in Redis (30-minute TTL) — the frontend only holds the token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passportNumber:
 *                 type: string
 *                 description: |
 *                   Passport document number. Required for QoreID verification.
 *                   At least one of passportNumber or passportDocumentUrl must be provided.
 *                 example: "A12345678"
 *               passportDocumentUrl:
 *                 type: string
 *                 format: uri
 *                 description: |
 *                   URL of the uploaded passport image (upload via POST /api/auth/kyc/passport/upload first).
 *                   Used as a fallback reference when passportNumber is not provided.
 *                 example: "https://res.cloudinary.com/demo/image/upload/passport/abc123.jpg"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: |
 *                   User's email address. Required — QoreID does not return contact details.
 *                   Stored server-side and used to deliver the OTP in Step 2.
 *                 example: "john.doe@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: |
 *                   User's phone number (international format). Required — QoreID does not return contact details.
 *                   Stored server-side and used to deliver the OTP in Step 2.
 *                 example: "+447911123456"
 *     responses:
 *       200:
 *         description: Passport verified — use the verificationToken in all subsequent steps
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
 *                     verificationToken:
 *                       type: string
 *                       description: Use this in Steps 2, 3, and 4. Valid for 30 minutes.
 *                       example: "xyz789abc123"
 *                     message:
 *                       type: string
 *                       example: "Passport verified successfully. Use the verification token to proceed."
 *                     firstName:
 *                       type: string
 *                       example: "John"
 *                     lastName:
 *                       type: string
 *                       example: "Doe"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1990-01-15"
 *                     email:
 *                       type: string
 *                       description: Partially redacted — for display only
 *                       example: "j***@example.com"
 *                     phoneNumber:
 *                       type: string
 *                       description: Partially redacted — for display only
 *                       example: "+44****3456"
 *                     nationality:
 *                       type: string
 *                       example: "United Kingdom"
 *       400:
 *         description: |
 *           Validation error, passport not found, or an account with this passport already exists.
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// Tourist signup flow (4 steps)
router.post('/signup/tourist/verify-passport', authController.verifyPassport); // Step 1
/**
 * @swagger
 * /api/auth/signup/tourist/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for tourist signup
 *     description: Send OTP to phone or email for verification. The contact info is retrieved from the passport verification session using the token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email from passport data)
 *                 example: phone
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
 *                     firstName:
 *                       type: string
 *                       example: John
 *                     lastName:
 *                       type: string
 *                       example: Smith
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1985-03-15"
 *                     nationality:
 *                       type: string
 *                       example: "United Kingdom"
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/send-otp', authController.sendPassportOtp); // Step 2

/**
 * @swagger
 * /api/auth/signup/tourist/resend-otp:
 *   post:
 *     summary: Resend OTP for tourist signup
 *     description: Resend OTP to phone or email during the tourist signup flow. Uses the same verification token from step 1.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email from passport data)
 *                 example: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
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
 *                       example: OTP sent successfully to your email
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/resend-otp', authController.sendPassportOtp);

/**
 * @swagger
 * /api/auth/signup/tourist/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for tourist signup
 *     description: Validate the OTP sent to email or phone. Email is retrieved from the verification token stored server-side. Returns confirmed user data after successful validation.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - otp
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains email server-side)
 *                 example: "abc123xyz789"
 *               otp:
 *                 type: string
 *                 description: OTP received via email or phone
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP validated successfully
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
 *                       example: "OTP validated successfully. Please proceed to create your account."
 *                     firstName:
 *                       type: string
 *                       example: John
 *                     lastName:
 *                       type: string
 *                       example: Smith
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1985-03-15"
 *                     nationality:
 *                       type: string
 *                       example: "United Kingdom"
 *       400:
 *         description: Invalid OTP or verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/validate-otp', authController.validatePassportOtp); // Step 3

/**
 * @swagger
 * /api/auth/signup/tourist/create-account:
 *   post:
 *     summary: Step 4 - Create tourist user account with password only
 *     description: Create account after passport verification and OTP validation. Only password and verification token are required - all user information (email, name, DOB, nationality, phone, passport) is retrieved server-side from the verification token for security.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - password
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains all passport data server-side including email)
 *                 example: "abc123xyz789"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User's chosen password. All other information (email, name, DOB, nationality, phone, passport) comes from passport data stored server-side.
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
 *                       example: "user_abc123"
 *                     message:
 *                       type: string
 *                       example: "Account created successfully. You can now login with your email and password."
 *       400:
 *         description: Invalid or expired verification token, or validation error
 *       429:
 *         description: Too many requests
 */
router.post('/signup/tourist/create-account', authController.createTouristAccount); // Step 4

/**
 * @swagger
 * /api/auth/signup/expatriate/verify-passport:
 *   post:
 *     summary: "Expatriate signup — Step 1: Verify passport"
 *     description: |
 *       Verifies the expatriate's passport via the QoreID API and starts a 30-minute verification session.
 *       Identical to the tourist flow but sets `customerType` to `EXPATRIATE` on account creation.
 *
 *       **Identity source:** QoreID passport verification (requires `passportNumber`).
 *       When QoreID credentials are not configured, the server falls back to a dev mock.
 *
 *       **Contact info:** QoreID does not return email or phone number. The frontend **must**
 *       supply `email` and `phoneNumber` in this request — they are stored server-side and used
 *       to send the OTP in Step 2.
 *
 *       **At least one of** `passportNumber` or `passportDocumentUrl` is required.
 *       Providing `passportNumber` enables live QoreID verification. `passportDocumentUrl`
 *       is only used as a fallback identifier when a passport number is not available.
 *
 *       On success a `verificationToken` is returned. All sensitive data is stored server-side
 *       in Redis (30-minute TTL) — the frontend only holds the token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passportNumber:
 *                 type: string
 *                 description: |
 *                   Passport document number. Required for QoreID verification.
 *                   At least one of passportNumber or passportDocumentUrl must be provided.
 *                 example: "ES987654321"
 *               passportDocumentUrl:
 *                 type: string
 *                 format: uri
 *                 description: |
 *                   URL of the uploaded passport image (upload via POST /api/auth/kyc/passport/upload first).
 *                   Used as a fallback reference when passportNumber is not provided.
 *                 example: "https://res.cloudinary.com/demo/image/upload/passport/xyz789.jpg"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: |
 *                   User's email address. Required — QoreID does not return contact details.
 *                   Stored server-side and used to deliver the OTP in Step 2.
 *                 example: "maria.garcia@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: |
 *                   User's phone number (international format). Required — QoreID does not return contact details.
 *                   Stored server-side and used to deliver the OTP in Step 2.
 *                 example: "+34612345678"
 *     responses:
 *       200:
 *         description: Passport verified — use the verificationToken in all subsequent steps
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
 *                     verificationToken:
 *                       type: string
 *                       description: Use this in Steps 2, 3, and 4. Valid for 30 minutes.
 *                       example: "xyz789abc123"
 *                     message:
 *                       type: string
 *                       example: "Passport verified successfully. Use the verification token to proceed."
 *                     firstName:
 *                       type: string
 *                       example: "Maria"
 *                     lastName:
 *                       type: string
 *                       example: "Garcia"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1988-05-15"
 *                     email:
 *                       type: string
 *                       description: Partially redacted — for display only
 *                       example: "m***@example.com"
 *                     phoneNumber:
 *                       type: string
 *                       description: Partially redacted — for display only
 *                       example: "+34****5678"
 *                     nationality:
 *                       type: string
 *                       example: "Spain"
 *       400:
 *         description: |
 *           Validation error, passport not found, or an account with this passport already exists.
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
// Expatriate signup flow (4 steps - same as tourist)
router.post('/signup/expatriate/verify-passport', authController.verifyExpatriatePassport); // Step 1
/**
 * @swagger
 * /api/auth/signup/expatriate/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for expatriate signup
 *     description: Send OTP to phone or email for verification. The contact info is retrieved from the passport verification session using the token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email from passport data)
 *                 example: phone
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
 *                     firstName:
 *                       type: string
 *                       example: Maria
 *                     lastName:
 *                       type: string
 *                       example: Garcia
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1988-08-12"
 *                     nationality:
 *                       type: string
 *                       example: "Spain"
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       429:
 *         description: Too many requests
 */
router.post('/signup/expatriate/send-otp', authController.sendExpatriateOtp); // Step 2

/**
 * @swagger
 * /api/auth/signup/expatriate/resend-otp:
 *   post:
 *     summary: Resend OTP for expatriate signup
 *     description: Resend OTP to phone or email during the expatriate signup flow. Uses the same verification token from step 1.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - verificationType
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *                 description: Method to receive OTP (phone or email from passport data)
 *                 example: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
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
 *                       example: OTP sent successfully to your email
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/expatriate/resend-otp', authController.sendExpatriateOtp);

/**
 * @swagger
 * /api/auth/signup/expatriate/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for expatriate signup
 *     description: Validate the OTP sent to email or phone. Email is retrieved from the verification token stored server-side. Returns confirmed user data after successful validation.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - otp
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains email server-side)
 *                 example: "abc123xyz789"
 *               otp:
 *                 type: string
 *                 description: OTP received via email or phone
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP validated successfully
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
 *                       example: "OTP validated successfully. Please proceed to create your account."
 *                     firstName:
 *                       type: string
 *                       example: Maria
 *                     lastName:
 *                       type: string
 *                       example: Garcia
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "1988-08-12"
 *                     nationality:
 *                       type: string
 *                       example: "Spain"
 *       400:
 *         description: Invalid OTP or verification token
 *       429:
 *         description: Too many requests
 */
router.post('/signup/expatriate/validate-otp', authController.validateExpatriateOtp); // Step 3

/**
 * @swagger
 * /api/auth/signup/expatriate/create-account:
 *   post:
 *     summary: Step 4 - Create expatriate user account with password only
 *     description: Create account after passport verification and OTP validation. Only password and verification token are required - all user information (email, name, DOB, nationality, phone, passport) is retrieved server-side from the verification token for security.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *               - password
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (contains all passport data server-side including email)
 *                 example: "abc123xyz789"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User's chosen password. All other information (email, name, DOB, nationality, phone, passport) comes from passport data stored server-side.
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
 *                       example: "user_abc123"
 *                     message:
 *                       type: string
 *                       example: "Account created successfully. You can now login with your email and password."
 *       400:
 *         description: Invalid or expired verification token, or validation error
 *       429:
 *         description: Too many requests
 */
router.post('/signup/expatriate/create-account', authController.createExpatriateAccount); // Step 4

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
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/agent/login:
 *   post:
 *     summary: Agent login
 *     description: Login endpoint specifically for agents (users with customerType = AGENT).
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
 *                 example: agent@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful (agent)
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
 *         description: Invalid credentials or user is not an agent
 *       429:
 *         description: Too many requests
 */
router.post('/agent/login', authController.loginAgent);

/**
 * @swagger
 * /api/auth/agent/verify-login:
 *   post:
 *     summary: Verify OTP and complete agent login (2FA)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns accessToken, refreshToken, and user
 *       400:
 *         description: Invalid or expired OTP
 *       401:
 *         description: Unauthorized
 */
router.post('/agent/verify-login', authController.verifyAgentLogin);

router.post('/agent/forgot-password', agentAuthController.forgotPassword);
router.post('/agent/forgot-password/verify', agentAuthController.verifyForgotPasswordOtp);
router.post('/agent/reset-password', agentAuthController.resetPassword);

/**
 * @swagger
 * /api/auth/agent/create-password:
 *   post:
 *     summary: Create or set password for an agent using OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - password
 *               - confirmPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password set successfully
 *       400:
 *         description: Validation error
 */
router.post('/agent/create-password', authController.createAgentPassword);

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
 *                 enum: [REGISTRATION, LOGIN, PASSWORD_RESET, TRANSACTION_VERIFICATION, AGENT_SET_PASSWORD]
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
router.post('/otp/send', authController.sendOtp);

/**
 * @swagger
 * /api/auth/otp/validate:
 *   post:
 *     summary: Validate OTP code
 *     description: Validates an OTP code. Email is optional - OTP code alone is sufficient for validation.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *               - purpose
 *             properties:
 *               otp:
 *                 type: string
 *                 description: The OTP code to validate
 *                 example: "123456"
 *               purpose:
 *                 type: string
 *                 enum: [REGISTRATION, LOGIN, PASSWORD_RESET, TRANSACTION_VERIFICATION]
 *                 description: Purpose of the OTP
 *                 example: REGISTRATION
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Optional - Email address (not required, OTP code is sufficient)
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP validated successfully
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
 *                     valid:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: OTP validated successfully
 *       400:
 *         description: Invalid or expired OTP
 *       429:
 *         description: Too many requests
 */
router.post('/otp/validate', authController.validateOtp);

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
router.post('/kyc/verify', authController.verifyKyc);

/**
 * @swagger
 * /api/auth/kyc/passport/upload:
 *   post:
 *     summary: Upload passport for verification
 *     description: Public endpoint for tourists to upload passport during signup (Step 1). No authentication required.
 *     tags: [Authentication]
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
 *                     passportDocumentUrl:
 *                       type: string
 *                       format: uri
 *                       description: URL of the uploaded passport to use in verify-passport endpoint
 *                       example: "https://cloudinary.com/passport/abc123.jpg"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
router.post('/kyc/passport/upload', uploadPassport, authController.uploadPassport);

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
 *     summary: Get user profile with roles and permissions
 *     description: Retrieve complete user profile including personal details, KYC status, role, permissions, and active sessions
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_abc123"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     phoneNumber:
 *                       type: string
 *                       description: Partially redacted for security
 *                       example: "+234****5678"
 *                     role:
 *                       type: string
 *                       enum: [CUSTOMER, ADMIN, COMPLIANCE_OFFICER, OPERATIONS, SUPER_ADMIN]
 *                       example: "CUSTOMER"
 *                     customerType:
 *                       type: string
 *                       enum: [NIGERIAN_CITIZEN, TOURIST, AGENT]
 *                       example: "NIGERIAN_CITIZEN"
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     emailVerified:
 *                       type: boolean
 *                       example: true
 *                     phoneVerified:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     profile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         firstName:
 *                           type: string
 *                           example: "John"
 *                         lastName:
 *                           type: string
 *                           example: "Doe"
 *                         dateOfBirth:
 *                           type: string
 *                           format: date
 *                         address:
 *                           type: string
 *                         city:
 *                           type: string
 *                         state:
 *                           type: string
 *                         country:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         avatar:
 *                           type: string
 *                           format: uri
 *                     kyc:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [NOT_STARTED, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED]
 *                           example: "VERIFIED"
 *                         bvn:
 *                           type: string
 *                           description: Partially redacted for security
 *                           example: "*******8901"
 *                         tin:
 *                           type: string
 *                         passportNumber:
 *                           type: string
 *                         passportDocumentUrl:
 *                           type: string
 *                           format: uri
 *                         bvnVerified:
 *                           type: boolean
 *                         tinVerified:
 *                           type: boolean
 *                         passportVerified:
 *                           type: boolean
 *                         verifiedAt:
 *                           type: string
 *                           format: date-time
 *                         rejectedAt:
 *                           type: string
 *                           format: date-time
 *                         rejectionReason:
 *                           type: string
 *                     permissions:
 *                       type: array
 *                       description: List of permissions based on user role
 *                       items:
 *                         type: string
 *                       example: ["transactions.create", "transactions.view.own", "profile.view", "profile.update"]
 *                     activeSessions:
 *                       type: array
 *                       description: List of active user sessions (up to 5 most recent)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           userAgent:
 *                             type: string
 *                           ipAddress:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           expiresAt:
 *                             type: string
 *                             format: date-time
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
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     description: Sends a password reset OTP to the customer's registered email address. Always returns success to prevent email enumeration.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: customer@example.com
 *                 description: The email address associated with the customer account
 *     responses:
 *       200:
 *         description: OTP sent if account exists
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
 *                       example: If an account with that email exists, a password reset OTP has been sent
 *                     otp:
 *                       type: string
 *                       example: "123456"
 *                       description: OTP code (only returned in development mode)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/verify-reset-otp:
 *   post:
 *     summary: Step 2 - Verify password reset OTP
 *     description: Validates the OTP received by email. On success returns a short-lived reset token (5 min) to be used in the next step.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: customer@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *                 description: The OTP received via email
 *     responses:
 *       200:
 *         description: OTP verified, reset token issued
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
 *                     resetToken:
 *                       type: string
 *                       description: Short-lived token (5 min) to authorise the password reset
 *                     message:
 *                       type: string
 *                       example: OTP verified successfully. Use the reset token to set your new password.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/verify-reset-otp', authController.verifyResetOtp);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Step 3 - Set new password
 *     description: Sets a new password using the reset token obtained from /verify-reset-otp. Invalidates all active sessions.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: The reset token received from /verify-reset-otp
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePass@123
 *                 description: "New password (min 8 chars, must include uppercase, lowercase, number, and special character)"
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                       example: Password reset successfully. Please log in with your new password.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/auth/otp/change-password:
 *   post:
 *     summary: Step 1 - Validate current password and send OTP
 *     description: Verifies the user's current password, then sends a CHANGE_PASSWORD OTP to their email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, oldPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               oldPassword:
 *                 type: string
 *                 description: The user's current password
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/otp/change-password', authController.initiateChangePassword);

/**
 * @swagger
 * /api/auth/otp/verify-change-password:
 *   post:
 *     summary: Step 2 - Validate OTP and receive reset token
 *     description: Validates the CHANGE_PASSWORD OTP. Returns a short-lived reset token to use with POST /api/auth/reset-password.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified — use resetToken with POST /api/auth/reset-password
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
 *                     resetToken:
 *                       type: string
 *                       description: Short-lived token (5 min) to set the new password
 *                     message:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/otp/verify-change-password', authController.verifyChangePasswordOtp);

/**
 * @swagger
 * /api/auth/otp/change-password/resend:
 *   post:
 *     summary: Resend change-password OTP
 *     description: |
 *       Resends the CHANGE_PASSWORD OTP to the customer's email without requiring the old password again.
 *       Use this when the previously sent OTP has expired. The new OTP is valid for 5 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/otp/change-password/resend', authController.resendChangePasswordOtp);

/**
 * @swagger
 * /api/auth/tin/verify-individual:
 *   post:
 *     summary: Verify an individual's Tax Identification Number (TIN)
 *     tags: [Authentication]
 *     description: >
 *       Validates an individual's TIN against the NIBSS Identity v2 API and returns
 *       the taxpayer's full profile (name, DOB, tax authority, etc.).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tin
 *             properties:
 *               tin:
 *                 type: string
 *                 description: 8–14 digit Tax Identification Number
 *                 example: "1003123575"
 *     responses:
 *       200:
 *         description: TIN verification result
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
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     data:
 *                       type: object
 *                       properties:
 *                         tin:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         middleName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         phoneNo:
 *                           type: string
 *                         email:
 *                           type: string
 *                         dateOfBirth:
 *                           type: string
 *                         dateOfRegistration:
 *                           type: string
 *                         taxAuthority:
 *                           type: string
 *                         taxOffice:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/tin/verify-individual', authController.verifyIndividualTin.bind(authController));

/**
 * @swagger
 * /api/auth/tin/verify-corporate:
 *   post:
 *     summary: Verify a corporate entity's Tax Identification Number (TIN)
 *     tags: [Authentication]
 *     description: >
 *       Validates a corporate TIN against the NIBSS Identity v2 API and returns
 *       the entity's registration details (name, RC number, incorporation date, etc.).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tin
 *             properties:
 *               tin:
 *                 type: string
 *                 description: 8–14 digit Tax Identification Number
 *                 example: "1000001311"
 *     responses:
 *       200:
 *         description: TIN verification result
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
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     data:
 *                       type: object
 *                       properties:
 *                         tin:
 *                           type: string
 *                         registeredName:
 *                           type: string
 *                         registrationNumber:
 *                           type: string
 *                         phoneNo:
 *                           type: string
 *                         email:
 *                           type: string
 *                         dateOfIncorporation:
 *                           type: string
 *                         dateOfRegistration:
 *                           type: string
 *                         taxAuthority:
 *                           type: string
 *                         taxOffice:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/tin/verify-corporate', authController.verifyCorporateTin.bind(authController));

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change customer password
 *     description: Allows authenticated customers to change their password by providing the current password and a new password.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password for verification
 *                 example: "CurrentPass123!"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (must meet strength requirements)
 *                 example: "NewSecurePass123!"
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                       example: "Password updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/change-password', authenticate, authController.changePassword);

// Health check
router.get('/health', authController.healthCheck);

export default router;
