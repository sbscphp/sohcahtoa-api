import { Router } from "express";
import { adminAuthController } from "../controllers/admin-auth.controller";
import { addUserValidationStore, validate } from "../validations/user-management.validation";
import { authenticate } from "../../../shared/middleware";

export const AdminAuthRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: admin-auth
 *   description: Admin authentication endpoints
 */

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Initiate admin login (OTP)
 *     tags: [admin-auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminAuthRouter.post("/login", adminAuthController.login);

/**
 * @swagger
 * /api/admin/auth/verify-login:
 *   post:
 *     summary: Verify OTP and complete login
 *     tags: [admin-auth]
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
 *         description: Login successful, returns tokens
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminAuthRouter.post("/verify-login",  adminAuthController.verifyLogin);

/**
 * @swagger
 * /api/admin/auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [admin-auth]
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
 *         description: OTP sent to email
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AdminAuthRouter.post("/forgot-password",  adminAuthController.forgotPassword);

/**
 * @swagger
 * /api/admin/auth/forgot-password/resend:
 *   post:
 *     summary: Resend password reset OTP
 *     tags: [admin-auth]
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
 *         description: OTP resent if account exists
 */

/**
 * @swagger
 * /api/admin/auth/otp/validate:
 *   post:
 *     summary: Validate OTP for admin password reset and receive resetToken
 *     tags: [admin-auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP validated; resetToken issued
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AdminAuthRouter.post("/otp/validate",  adminAuthController.validateResetOtp);

/**
 * @swagger
 * /api/admin/auth/reset-password:
 *   post:
 *     summary: Submit new admin password using resetToken
 *     tags: [admin-auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resetToken, password]
 *             properties:
 *               resetToken:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AdminAuthRouter.post("/reset-password",  adminAuthController.submitNewPassword);
AdminAuthRouter.post("/forgot-password/resend", adminAuthController.resendForgotPassword);

/**
 * @swagger
 * /api/admin/auth/resend-otp:
 *   post:
 *     summary: Resend login OTP to admin email
 *     tags: [admin-auth]
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
 *         description: OTP resent
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AdminAuthRouter.post("/resend-otp", adminAuthController.resendOtp);

/**
 * @swagger
 * /api/admin/auth/logout:
 *   post:
 *     summary: Logout current admin session
 *     tags: [admin-auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminAuthRouter.post("/logout", authenticate, adminAuthController.logout);
