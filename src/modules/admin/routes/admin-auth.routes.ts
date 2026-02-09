import { Router } from "express";
import { adminAuthController } from "../controllers/admin-auth.controller";
import { addUserValidationStore, validate } from "../validations/user-management.validation";
import { authRateLimiter } from "../../../shared/middleware";

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
AdminAuthRouter.post("/login", authRateLimiter, adminAuthController.login);

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
AdminAuthRouter.post("/verify-login", authRateLimiter, adminAuthController.verifyLogin);

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
AdminAuthRouter.post("/forgot-password", authRateLimiter, adminAuthController.forgotPassword);

/**
 * @swagger
 * /api/admin/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp, password]
 *             properties:
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
AdminAuthRouter.post("/reset-password", authRateLimiter, adminAuthController.resetPassword);
