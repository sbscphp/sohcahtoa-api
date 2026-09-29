import { Router } from 'express';
import authController from '../../auth/controllers/auth.controller';
import agentCustomerController from '../controllers/agent-customer.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const AgentCustomerAuthRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Agent Customer Authentication
 *   description: BVN and OTP verification flow for agent-managed customer signup
 */
// All routes require authenticated agent
AgentCustomerAuthRouter.use(authenticate, authorize(UserRole.AGENT));
/**
 * @swagger
 * /api/agent/customer-auth/igree/initiate:
 *   post:
 *     summary: Step 1 - Initiate BVN consent (iGree) for agent-created customer
 *     description: |
 *       Agent submits the customer's bvn, firstName, lastName, dateOfBirth, phoneNumber
 *       (and optionally email) up front, then the customer (or agent, on their behalf)
 *       authenticates on NIBSS's iGree portal via the returned authUrl. Once NIBSS redirects
 *       back to the iGree callback (Step 1a, verifies consent only), the frontend polls
 *       igree/retrieve (Step 1b) directly, which cross-checks these submitted fields against
 *       NIBSS's verified BVN record — any mismatch fails the session. There is no separate
 *       consent-status polling step. The customer is linked to this agent later, at
 *       account-creation time.
 *
 *       **Recommended flow after this step:** poll igree/retrieve (Step 1b) until COMPLETED,
 *       then call send-otp with `verificationType: "email"` once and validate-otp — no phone
 *       OTP needed.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bvn, firstName, lastName, dateOfBirth, phoneNumber]
 *             properties:
 *               bvn: { type: string, example: "22222222248" }
 *               firstName: { type: string, example: "John" }
 *               lastName: { type: string, example: "Smith" }
 *               dateOfBirth: { type: string, example: "1990-01-01" }
 *               phoneNumber: { type: string, example: "+2348000000000" }
 *               email: { type: string, example: "john@example.com" }
 *     responses:
 *       200:
 *         description: Consent initiated — redirect to authUrl, then poll igree/retrieve with the returned state
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
 *                     state:
 *                       type: string
 *                       description: Use this in igree/retrieve (as sessionId) to poll for completion
 *                       example: "a1b2c3d4e5f6"
 *                     authUrl:
 *                       type: string
 *                       description: Redirect here to authenticate and consent on the NIBSS iGree portal
 *                     message:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: An account with this BVN already exists (KYC already verified)
 */
AgentCustomerAuthRouter.post('/igree/initiate', authController.iGreeInitiate);

/**
 * @swagger
 * /api/agent/customer-auth/igree/retrieve:
 *   post:
 *     summary: Step 1b - Poll/retrieve BVN details for agent-created customer
 *     description: |
 *       The only status/retrieval endpoint needed after Step 1 — there is no separate
 *       consent-status polling step. Call repeatedly (e.g. every 2–3 seconds) with the
 *       `sessionId` (the `state` from Step 1) until `status` is `COMPLETED` or `FAILED`:
 *
 *       - **PENDING** — the iGree callback hasn't verified consent yet. Keep polling.
 *       - **CONSENT_VERIFIED** — consent verified but the BVN-details fetch failed transiently
 *         (NIBSS's data endpoint can be flaky); just call this endpoint again.
 *       - **COMPLETED** — returns `verificationToken` — save it, required for
 *         send-otp/validate-otp/create-account — plus a `customer` object with the verified
 *         name/DOB/gender for display, and contact details/bvn partially redacted.
 *       - **FAILED** — identity mismatch or NIBSS error; restart from Step 1.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: The state returned from Step 1 (igree/initiate)
 *     responses:
 *       200:
 *         description: Retrieval outcome
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [PENDING, CONSENT_VERIFIED, COMPLETED, FAILED]
 *                     verificationToken:
 *                       type: string
 *                       description: Only present when status is COMPLETED. Valid for 30 minutes.
 *                     customer:
 *                       type: object
 *                       description: Only present when status is COMPLETED. Contact details and bvn are partially redacted.
 *                       properties:
 *                         firstName: { type: string, example: "Chinedu" }
 *                         lastName: { type: string, example: "Okafor" }
 *                         dateOfBirth: { type: string, format: date, nullable: true, example: "1990-05-15" }
 *                         gender: { type: string, nullable: true, example: "Male" }
 *                         email: { type: string, description: Partially redacted, example: "ch***@example.com" }
 *                         phoneNumber: { type: string, description: Partially redacted, example: "*******5678" }
 *                         bvn: { type: string, description: Partially redacted, example: "*******8901" }
 *                     message: { type: string }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
AgentCustomerAuthRouter.post('/igree/retrieve', authController.retrieveIGreeBvnDetails);

/**
 * @swagger
 * /api/agent/customer-auth/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for agent-created Nigerian customer
 *     description: >
 *       Send OTP to phone or email for verification. Retrieves customer details from Redis cache using the verification token from step 1.
 *       This mirrors the standard Nigerian signup OTP sending step.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: |
 *                   Use "email" — email is the only NIBSS-verified channel for this flow.
 *                 example: email
 *     responses:
 *       200:
 *         description: OTP sent successfully for agent-created customer
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
 *                       description: First name from cached BVN data
 *                       example: "Chinedu"
 *                     lastName:
 *                       type: string
 *                       description: Last name from cached BVN data
 *                       example: "Okafor"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       description: Date of birth from cached BVN data
 *                       example: "1990-05-15"
 *                     gender:
 *                       type: string
 *                       description: Gender from cached BVN data
 *                       example: "Male"
 *                     otp:
 *                       type: string
 *                       description: Only included in non-production environments
 *                       example: "123456"
 *       400:
 *         description: Invalid or expired verification token
 *       429:
 *         description: Too many requests
 */
AgentCustomerAuthRouter.post('/send-otp', authController.sendBvnOtp);

/**
 * @swagger
 * /api/agent/customer-auth/resend-otp:
 *   post:
 *     summary: Resend OTP for agent-created Nigerian customer
 *     description: >
 *       Resend OTP to phone or email during the agent-managed Nigerian customer signup flow.
 *       Uses the same verification token from step 1 and mirrors the standard Nigerian resend-OTP behavior.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Use "email" — email is the only NIBSS-verified channel for this flow.
 *                 example: email
 *     responses:
 *       200:
 *         description: OTP resent successfully for agent-created customer
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
AgentCustomerAuthRouter.post('/resend-otp', authController.sendBvnOtp);

/**
 * @swagger
 * /api/agent/customer-auth/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for agent-created Nigerian customer
 *     description: >
 *       Validate the OTP sent to email or phone. Email is retrieved from the verification token stored server-side.
 *       Returns confirmed customer data after successful validation, mirroring the standard Nigerian OTP validation step.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *         description: OTP validated successfully for agent-created customer
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
 *                       example: "OTP validated successfully. Please proceed to create the customer account under the agent."
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
AgentCustomerAuthRouter.post('/validate-otp', authController.validateBvnOtp);

/**
 * @swagger
 * /api/agent/customer-auth/create-account:
 *   post:
 *     summary: Create Nigerian customer account under an agent
 *     description: |
 *       Agent-initiated account creation after BVN verification and OTP validation.
 *       Uses the same verification token from the Nigerian signup flow but links
 *       the created customer to the authenticated agent.
 *     tags: [Agent Customers]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Verification token from BVN verification (Step 1)
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Customer's chosen password
 *               customerType:
 *                 type: string
 *                 enum: [NIGERIAN_CITIZEN, TOURIST, EXPATRIATE]
 *                 description: Optional customer type override (defaults to NIGERIAN_CITIZEN)
 *     responses:
 *       201:
 *         description: Customer account created successfully under the agent
 *       400:
 *         description: Validation error or expired verification token
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 */
AgentCustomerAuthRouter.post(
  '/create-account',
  agentCustomerController.createCustomerAccount,
);

// ─── Tourist passport flow ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/customer-auth/tourist/verify-passport:
 *   post:
 *     summary: Step 1 - Verify tourist passport for agent-created customer
 *     description: >
 *       Upload and OCR a passport document to start the tourist onboarding flow
 *       under an agent. Returns a verification token valid for 30 minutes.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: URL of the uploaded passport document (upload via /api/auth/kyc/passport/upload first)
 *                 example: "https://cloudinary.com/passport/abc123.jpg"
 *               passportNumber:
 *                 type: string
 *                 description: Optional passport number for faster lookup
 *                 example: "A12345678"
 *     responses:
 *       200:
 *         description: Passport verified successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
AgentCustomerAuthRouter.post('/tourist/verify-passport', authController.verifyPassport);

/**
 * @swagger
 * /api/agent/customer-auth/tourist/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for agent-created tourist customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
AgentCustomerAuthRouter.post('/tourist/send-otp', authController.sendPassportOtp);

/**
 * @swagger
 * /api/agent/customer-auth/tourist/resend-otp:
 *   post:
 *     summary: Resend OTP for agent-created tourist customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *     responses:
 *       200:
 *         description: OTP resent successfully
 */
AgentCustomerAuthRouter.post('/tourist/resend-otp', authController.sendPassportOtp);

/**
 * @swagger
 * /api/agent/customer-auth/tourist/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for agent-created tourist customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP validated successfully
 */
AgentCustomerAuthRouter.post('/tourist/validate-otp', authController.validatePassportOtp);

/**
 * @swagger
 * /api/agent/customer-auth/tourist/create-account:
 *   post:
 *     summary: Step 4 - Create tourist customer account under an agent
 *     description: >
 *       Creates a tourist account using the passport verification token and links
 *       it to the authenticated agent.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Verification token from Step 1
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Tourist customer account created and linked to agent
 */
AgentCustomerAuthRouter.post('/tourist/create-account', agentCustomerController.createTouristCustomerAccount);

// ─── Expatriate passport flow ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/customer-auth/expatriate/verify-passport:
 *   post:
 *     summary: Step 1 - Verify expatriate passport for agent-created customer
 *     description: >
 *       Upload and OCR a passport document to start the expatriate onboarding flow
 *       under an agent. Returns a verification token valid for 30 minutes.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: URL of the uploaded passport document (upload via /api/auth/kyc/passport/upload first)
 *                 example: "https://cloudinary.com/passport/abc123.jpg"
 *               passportNumber:
 *                 type: string
 *                 description: Optional passport number for faster lookup
 *                 example: "A12345678"
 *     responses:
 *       200:
 *         description: Passport verified successfully
 */
AgentCustomerAuthRouter.post('/expatriate/verify-passport', authController.verifyExpatriatePassport);

/**
 * @swagger
 * /api/agent/customer-auth/expatriate/send-otp:
 *   post:
 *     summary: Step 2 - Send OTP for agent-created expatriate customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
AgentCustomerAuthRouter.post('/expatriate/send-otp', authController.sendExpatriateOtp);

/**
 * @swagger
 * /api/agent/customer-auth/expatriate/resend-otp:
 *   post:
 *     summary: Resend OTP for agent-created expatriate customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               verificationType:
 *                 type: string
 *                 enum: [phone, email]
 *     responses:
 *       200:
 *         description: OTP resent successfully
 */
AgentCustomerAuthRouter.post('/expatriate/resend-otp', authController.sendExpatriateOtp);

/**
 * @swagger
 * /api/agent/customer-auth/expatriate/validate-otp:
 *   post:
 *     summary: Step 3 - Validate OTP for agent-created expatriate customer
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP validated successfully
 */
AgentCustomerAuthRouter.post('/expatriate/validate-otp', authController.validateExpatriateOtp);

/**
 * @swagger
 * /api/agent/customer-auth/expatriate/create-account:
 *   post:
 *     summary: Step 4 - Create expatriate customer account under an agent
 *     description: >
 *       Creates an expatriate account using the passport verification token and links
 *       it to the authenticated agent.
 *     tags: [Agent Customer Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Verification token from Step 1
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Expatriate customer account created and linked to agent
 */
AgentCustomerAuthRouter.post('/expatriate/create-account', agentCustomerController.createExpatriateCustomerAccount);

export default AgentCustomerAuthRouter;
