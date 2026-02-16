import { Router } from "express";
import { adminAuthController } from "../controllers/admin-auth.controller";
import { addUserValidationStore, validate } from "../validations/user-management.validation";

export const AdminAuthRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin endpoints
 */

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Initiate admin login (OTP)
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 * /api/admin/auth/otp/validate:
 *   post:
 *     summary: Validate OTP for admin password reset and receive resetToken
 *     tags: [Admin]
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
 *     tags: [Admin]
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
