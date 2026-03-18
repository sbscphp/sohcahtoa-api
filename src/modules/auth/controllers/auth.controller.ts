import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import passportService from '../services/passport.service';
import { successResponse, uploadToCloudinary, ValidationError } from '../../../shared/utils';
import {
  SignupRequest,
  LoginRequest,
  OtpRequest,
  OtpValidationRequest,
  KycVerificationRequest,
  NigerianSignupRequest,
  TouristSignupRequest,
  CreateAgentPasswordRequest,
  VerifyAgentLoginRequest,
} from '../../../shared/types';
import { AuthRequest } from '../../../shared/middleware';

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

  // Nigerian Flow - Step 3: Validate OTP and confirm user data
  async validateBvnOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.validateBvnOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 3.5: Send email OTP
  async sendNigerianEmailOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.sendNigerianEmailOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 3.6: Validate email OTP
  async validateNigerianEmailOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.validateNigerianEmailOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Nigerian Flow - Step 4: Create account with password ONLY
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
      const { passportDocumentUrl, passportNumber } = req.body;
      if (!passportDocumentUrl) {
        throw new Error('Passport document URL is required');
      }
      const result = await authService.verifyPassportForSignup(passportDocumentUrl, passportNumber, 'TOURIST');
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

  // Tourist Flow - Step 3: Validate OTP and confirm user data
  async validatePassportOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.validatePassportOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Tourist Flow - Step 4: Create account with password ONLY
  async createTouristAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.createTouristAccount(data);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Expatriate Flow - Step 1: Verify passport (same as tourist but different customer type)
  async verifyExpatriatePassport(req: Request, res: Response, next: NextFunction) {
    try {
      const { passportDocumentUrl, passportNumber } = req.body;
      if (!passportDocumentUrl) {
        throw new Error('Passport document URL is required');
      }
      const result = await authService.verifyPassportForSignup(passportDocumentUrl, passportNumber, 'EXPATRIATE');
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Expatriate Flow - Step 2: Send OTP
  async sendExpatriateOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.sendPassportVerificationOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Expatriate Flow - Step 3: Validate OTP and confirm user data
  async validateExpatriateOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.validatePassportOtp(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // Expatriate Flow - Step 4: Create account with password ONLY
  async createExpatriateAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.createExpatriateAccount(data);
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

  async loginAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data: LoginRequest = req.body;
      const userAgent = req.get('user-agent');
      const ipAddress = req.ip;
      const result = await authService.loginAgent(data, userAgent, ipAddress);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async createAgentPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateAgentPasswordRequest = req.body;
      const result = await authService.createAgentPassword(data);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async verifyAgentLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data: VerifyAgentLoginRequest = req.body;
      const userAgent = req.get('user-agent');
      const ipAddress = req.ip;
      const result = await authService.verifyAgentLogin(data, userAgent, ipAddress);
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
      const profile = await authService.getUserProfile(userId);
      res.json(successResponse(profile, 'Profile retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async uploadPassport(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if file was uploaded
      const file = req.file;

      if (!file) {
        throw new ValidationError('Passport file is required');
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new ValidationError('Invalid file type. Allowed types: JPEG, PNG, PDF');
      }

      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file.buffer, {
        folder: 'passports',
        resourceType: 'auto',
        allowedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
      });

      const result = {
        passportDocumentUrl: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
        size: uploadResult.bytes,
        message: 'Passport uploaded successfully. Use this URL in the verify-passport endpoint.',
      };

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

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async verifyResetOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyResetOtp(req.body);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async changeAgentPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ValidationError('Authentication required');
      }

      const { currentPassword, newPassword, newPasswordConfirm } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        newPasswordConfirm?: string;
      };

      const result = await authService.changeAgentPassword(userId, {
        currentPassword: currentPassword || '',
        newPassword: newPassword || '',
        newPasswordConfirm: newPasswordConfirm || '',
      });

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
