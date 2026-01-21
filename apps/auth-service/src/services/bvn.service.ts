import { ValidationError } from '@fx-platform/shared-utils';
import { validateBvn } from '@fx-platform/shared-utils';

export interface BvnVerificationResult {
  success: boolean;
  data?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
    phoneNumber: string;
    email?: string;
    address?: string;
    gender?: string;
    nationality?: string;
  };
  message: string;
  error?: string;
}

export class BvnService {
  async verifyBvn(bvn: string): Promise<BvnVerificationResult> {
    // Validate BVN format
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      // TODO: Replace with actual CBN TRMS API integration
      // This is a mock implementation for development
      const mockBvnData = await this.mockBvnVerification(bvn);

      if (!mockBvnData.success) {
        return {
          success: false,
          message: mockBvnData.message,
          error: mockBvnData.error,
        };
      }

      return {
        success: true,
        data: mockBvnData.data,
        message: 'BVN verified successfully',
      };
    } catch (error: any) {
      console.error('BVN verification error:', error);
      return {
        success: false,
        message: 'BVN verification failed',
        error: error.message,
      };
    }
  }

  private async mockBvnVerification(bvn: string): Promise<BvnVerificationResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock data - in production, this would come from CBN TRMS API
    const mockDatabase: Record<string, any> = {
      '12345678901': {
        firstName: 'Chinedu',
        lastName: 'Okafor',
        middleName: 'Emmanuel',
        dateOfBirth: '1990-05-15',
        phoneNumber: '+2348012345678',
        email: 'chinedu.okafor@example.com',
        address: '123 Lagos Street, Victoria Island, Lagos',
        gender: 'Male',
        nationality: 'Nigerian',
      },
      '23456789012': {
        firstName: 'Amina',
        lastName: 'Ibrahim',
        dateOfBirth: '1995-08-20',
        phoneNumber: '+2348023456789',
        email: 'amina.ibrahim@example.com',
        address: '45 Abuja Road, Wuse, Abuja',
        gender: 'Female',
        nationality: 'Nigerian',
      },
    };

    const bvnData = mockDatabase[bvn];

    if (!bvnData) {
      return {
        success: false,
        message: 'BVN not found in database',
        error: 'INVALID_BVN',
      };
    }

    return {
      success: true,
      data: bvnData,
      message: 'BVN verified successfully',
    };
  }

  /**
   * Production implementation would look like this:
   *
   * private async callCbnTrmsApi(bvn: string, phone: string): Promise<BvnVerificationResult> {
   *   const apiUrl = process.env.CBN_TRMS_API_URL;
   *   const apiKey = process.env.CBN_TRMS_API_KEY;
   *
   *   const response = await fetch(`${apiUrl}/verify-bvn`, {
   *     method: 'POST',
   *     headers: {
   *       'Content-Type': 'application/json',
   *       'Authorization': `Bearer ${apiKey}`,
   *     },
   *     body: JSON.stringify({ bvn, phone }),
   *   });
   *
   *   if (!response.ok) {
   *     throw new Error('BVN verification failed');
   *   }
   *
   *   const data = await response.json();
   *   return {
   *     success: data.verified,
   *     data: data.customerInfo,
   *     message: data.message,
   *   };
   * }
   */
}

export default new BvnService();
