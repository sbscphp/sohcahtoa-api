import { Router, Request, Response, NextFunction } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate, authRateLimiter } from '@fx-platform/shared-middlewares';

const router: Router = Router();

// Public routes
router.post('/signup', authRateLimiter, authController.signup);

// Nigerian signup flow (4 steps)
router.post('/signup/nigerian/verify-bvn', authRateLimiter, authController.verifyBvn); // Step 1
router.post('/signup/nigerian/send-otp', authRateLimiter, authController.sendBvnOtp); // Step 2
// Step 3: Use existing /otp/validate endpoint
router.post('/signup/nigerian/create-account', authRateLimiter, authController.createNigerianAccount); // Step 4

// Tourist signup flow (4 steps)
router.post('/signup/tourist/verify-passport', authRateLimiter, authController.verifyPassport); // Step 1
router.post('/signup/tourist/send-otp', authRateLimiter, authController.sendPassportOtp); // Step 2
// Step 3: Use existing /otp/validate endpoint
router.post('/signup/tourist/create-account', authRateLimiter, authController.createTouristAccount); // Step 4

router.post('/login', authRateLimiter, authController.login);
router.post('/otp/send', authRateLimiter, authController.sendOtp);
router.post('/otp/validate', authRateLimiter, authController.validateOtp);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/kyc/verify', authenticate, authController.verifyKyc);
router.post('/kyc/passport/upload', authenticate, authController.uploadPassport);
router.get('/kyc/passport/status', authenticate, authController.getPassportVerificationStatus);
router.get('/profile', authenticate, authController.getProfile);

// Health check
router.get('/health', authController.healthCheck);

export default router;