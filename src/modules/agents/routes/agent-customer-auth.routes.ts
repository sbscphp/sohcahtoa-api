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
 * /api/agent/auth/change-password:
 *   post:
 *     summary: Change agent password
 *     description: >
 *       Allows an authenticated agent to change their own password by providing the current password,
 *       a new password, and a confirmation of the new password.
 *     tags: [Agent Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - newPasswordConfirm
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Agent's current password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password (must meet existing password strength requirements)
 *               newPasswordConfirm:
 *                 type: string
 *                 format: password
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password updated successfully
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
 *                       example: Password updated successfully
 *       400:
 *         description: Validation error (incorrect current password, mismatch, or weak password)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentCustomerAuthRouter.post('/change-password', authController.changeAgentPassword);
/**
 * @swagger
 * /api/agent/customer-auth/verify-bvn:
 *   post:
 *     summary: Step 1 - Verify Nigerian BVN for agent-created customer
 *     description: >
 *       Verifies BVN for a customer being onboarded by an agent and returns a verification token.
 *       Sensitive data (BVN, email, phone, address) is stored server-side for security.
 *       This mirrors the standard Nigerian signup BVN verification flow.
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
 *               - bvn
 *             properties:
 *               bvn:
 *                 type: string
 *                 description: 11-digit BVN number
 *                 example: "12345678901"
 *     responses:
 *       200:
 *         description: BVN verified successfully for agent-created customer
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
 *                       description: Token to use in subsequent steps (valid for 30 minutes). All sensitive data is stored server-side in Redis.
 *                       example: "abc123xyz789"
 *                     message:
 *                       type: string
 *                       example: "BVN verified successfully. Use the verification token to proceed."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Too many requests
 */
AgentCustomerAuthRouter.post('/verify-bvn', authController.verifyBvn);

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
 *                 description: Method to receive OTP (phone or email from BVN data)
 *                 example: phone
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
 *                 description: Method to receive OTP (phone or email)
 *                 example: phone
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
 * /api/agent/customer-auth/send-email-otp:
 *   post:
 *     summary: Step 3.5 - Send email OTP for agent-created Nigerian customer
 *     description: >
 *       After validating the phone OTP from BVN, send an additional OTP to the customer's email for verification.
 *       This mirrors the standard Nigerian email OTP sending step.
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
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1 (BVN verification)
 *                 example: "abc123xyz789"
 *     responses:
 *       200:
 *         description: Email OTP sent successfully for agent-created customer
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
AgentCustomerAuthRouter.post('/send-email-otp', authController.sendNigerianEmailOtp);

/**
 * @swagger
 * /api/agent/customer-auth/resend-email-otp:
 *   post:
 *     summary: Resend email OTP for agent-created Nigerian customer
 *     description: >
 *       Resend OTP to email during step 3.5 of the agent-managed Nigerian customer signup flow.
 *       Uses the same verification token and mirrors the standard Nigerian resend email OTP behavior.
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
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Verification token from step 1
 *                 example: "abc123xyz789"
 *     responses:
 *       200:
 *         description: Email OTP resent successfully for agent-created customer
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
AgentCustomerAuthRouter.post('/resend-email-otp', authController.sendNigerianEmailOtp);

/**
 * @swagger
 * /api/agent/customer-auth/validate-email-otp:
 *   post:
 *     summary: Step 3.6 - Validate email OTP for agent-created Nigerian customer
 *     description: >
 *       Validate the OTP sent to the customer's email address.
 *       This mirrors the standard Nigerian email OTP validation step and prepares for account creation under the agent.
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
 *                 description: Verification token from step 1 (BVN verification)
 *                 example: "abc123xyz789"
 *               otp:
 *                 type: string
 *                 description: OTP code received via email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email OTP validated successfully for agent-created customer
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
 *                       example: "Email OTP validated successfully. Please proceed to create the customer account under the agent."
 *       400:
 *         description: Invalid OTP or expired verification token
 *       429:
 *         description: Too many requests
 */
AgentCustomerAuthRouter.post('/validate-email-otp', authController.validateNigerianEmailOtp);

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

export default AgentCustomerAuthRouter;
