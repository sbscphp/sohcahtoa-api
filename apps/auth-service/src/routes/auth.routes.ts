import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authRateLimiter } from '@fx-platform/shared-middlewares';

const router = Router();

// Public routes
router.post('/signup', authRateLimiter, authController.signup);
router.post('/login', authRateLimiter, authController.login);
router.post('/otp/send', authRateLimiter, authController.sendOtp);
router.post('/otp/validate', authRateLimiter, authController.validateOtp);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/kyc/verify', authenticate, authController.verifyKyc);
router.get('/profile', authenticate, authController.getProfile);

// Health check
router.get('/health', authController.healthCheck);

export default router;
