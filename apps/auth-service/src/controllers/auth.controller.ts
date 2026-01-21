import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import passportService from '../services/passport.service';
import { successResponse } from '@fx-platform/shared-utils';
import {
  SignupRequest,
  LoginRequest,
  OtpRequest,
  OtpValidationRequest,
  KycVerificationRequest,
  NigerianSignupRequest,
  TouristSignupRequest
} from '@fx-platform/shared-types';
import { AuthRequest } from '@fx-platform/shared-middlewares';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const data: SignupRequest = req.body;
      const result = await authService.signup(data);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 1: Verify BVN
  async verifyBvn(req: Request, res: Response, next: NextFunction) {
    try {
      const { bvn } = req.body;
      if (!bvn) {
        throw new Error('BVN is required');
      }
      const result = await authService.verifyBvnForSignup(bvn);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 2: Send OTP
  async sendBvnOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.sendBvnVerificationOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 4: Create account with password
  async createNigerianAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.createNigerianAccount(data);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Tourist Flow - Step 1: Verify passport
  async verifyPassport(req: Request, res: Response, next: NextFunction) {
    try {
      const { passportDocumentUrl } = req.body;
      if (!passportDocumentUrl) {
        throw new Error('Passport document URL is required');
      }
      const result = await authService.verifyPassportForSignup(passportDocumentUrl);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Tourist Flow - Step 2: Send OTP
  async sendPassportOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.sendPassportVerificationOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Tourist Flow - Step 4: Create account with password
  async createTouristAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.createTouristAccount(data);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data: LoginRequest = req.body;
      const userAgent = req.get('user-agent');
      const ipAddress = req.ip;
      const result = await authService.login(data, userAgent, ipAddress);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data: OtpRequest = req.body;
      const result = await authService.sendOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async validateOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data: OtpValidationRequest = req.body;
      const result = await authService.validateOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = req.user?.sessionId;
      if (!sessionId) {
        throw new Error('Session ID not found');
      }
      const result = await authService.logout(sessionId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async verifyKyc(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }
      const data: KycVerificationRequest = { ...req.body, userId };
      const result = await authService.verifyKyc(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }
      // This would typically call a service method
      res.json(successResponse({ userId, message: 'Profile endpoint' }));
    } catch (error) {
      next(error);
    }
  }

  async uploadPassport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }
      const { passportDocumentUrl } = req.body;
      if (!passportDocumentUrl) {
        throw new Error('Passport document URL is required');
      }
      const result = await passportService.uploadPassportForVerification({ userId, passportDocumentUrl });
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getPassportVerificationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error('User ID not found');
      }
      const result = await passportService.getPassportVerificationStatus(userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async healthCheck(req: Request, res: Response) {
    res.json({
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new AuthController();
