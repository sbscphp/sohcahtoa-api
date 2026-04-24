import { ValidationError } from '../../../shared/utils';
import { nibssClient } from '../../../integrations/nibss/nibss.client';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('TinService');

export interface TinVerificationResult {
  success: boolean;
  data?: {
    tin: string;
    taxPayerName: string;
    taxOffice?: string;
    taxPayerType?: string;
    status?: string;
  };
  message: string;
  error?: string;
}

export interface IndividualTinVerificationResult {
  success: boolean;
  data?: {
    tin: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    phoneNo?: string;
    email?: string;
    dateOfBirth?: string;
    dateOfRegistration?: string;
    taxAuthority?: string;
    taxOffice?: string | null;
  };
  message: string;
  error?: string;
}

export interface CorporateTinVerificationResult {
  success: boolean;
  data?: {
    tin: string;
    registeredName?: string;
    registrationNumber?: string;
    phoneNo?: string | null;
    email?: string | null;
    dateOfIncorporation?: string;
    dateOfRegistration?: string;
    taxAuthority?: string;
    taxOffice?: string | null;
  };
  message: string;
  error?: string;
}

export class TinService {
  /**
   * Verify TIN (Tax Identification Number) using NIBSS API
   *
   * @param tin - Tax Identification Number
   * @param fullName - Optional full name for verification
   */
  async verifyTin(tin: string, fullName?: string): Promise<TinVerificationResult> {
    // Validate TIN format (typically 8-14 digits in Nigeria)
    if (!this.validateTin(tin)) {
      throw new ValidationError('Invalid TIN format. TIN must be 8-14 digits');
    }

    try {
      logger.info('Initiating TIN verification via NIBSS', {
        tin: `***${tin.slice(-4)}`,
        hasFullName: !!fullName,
      });

      // Check if NIBSS is configured
      const isNibssConfigured = process.env.NIBSS_BIVS_CLIENT_ID && process.env.NIBSS_BIVS_CLIENT_SECRET;

      if (!isNibssConfigured) {
        logger.error('NIBSS credentials not configured. TIN verification unavailable.');
        throw new ValidationError('TIN verification service is not configured. Please contact support.');
      }

      // Call NIBSS API
      const nibssResponse = await nibssClient.verifyTin({
        TIN: tin,
        FullName: fullName,
      });

      if (!nibssResponse.verified) {
        logger.warn('TIN verification failed via NIBSS', {
          tin: `***${tin.slice(-4)}`,
          message: nibssResponse.message,
        });

        return {
          success: false,
          message: nibssResponse.message,
          error: nibssResponse.message,
        };
      }

      logger.info('TIN verified successfully via NIBSS', {
        tin: `***${tin.slice(-4)}`,
        taxPayerName: nibssResponse.data?.taxPayerName,
      });

      return {
        success: true,
        data: {
          tin: nibssResponse.data!.tin,
          taxPayerName: nibssResponse.data!.taxPayerName,
          taxOffice: nibssResponse.data!.taxOffice,
          taxPayerType: nibssResponse.data!.taxPayerType,
          status: nibssResponse.data!.status,
        },
        message: 'TIN verified successfully',
      };
    } catch (error: any) {
      logger.error('TIN verification error', {
        tin: `***${tin.slice(-4)}`,
        error: error.message,
        stack: error.stack,
      });

      // Don't fall back to mock - NIBSS is the only verification method
      // if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      //   logger.warn('Falling back to mock TIN verification due to error');
      //   return await this.mockTinVerification(tin, fullName);
      // }

      return {
        success: false,
        message: 'TIN verification failed',
        error: error.message,
      };
    }
  }

  /**
   * Validate TIN format
   * Nigerian TIN is typically 8-14 digits
   */
  private validateTin(tin: string): boolean {
    // Remove any hyphens or spaces
    const cleanTin = tin.replace(/[-\s]/g, '');

    // Check if it's 8-14 digits
    const tinRegex = /^\d{8,14}$/;
    return tinRegex.test(cleanTin);
  }

  /**
   * Mock TIN verification for development/testing
   *
   * NOTE: This is commented out - NIBSS is now the only verification method
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async mockTinVerification(tin: string, fullName?: string): Promise<TinVerificationResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    logger.info('Using mock TIN verification', {
      tin: `***${tin.slice(-4)}`,
    });

    // Generate consistent data based on TIN
    const tinHash = parseInt(tin.slice(-6));

    const companyNames = [
      'Acme Trading Limited',
      'Global Ventures Nigeria Ltd',
      'Excellence Enterprises',
      'Prime Investment Ltd',
      'Sunshine Holdings',
      'Royal Commerce Limited',
      'Elite Solutions Nigeria',
      'Summit Technologies Ltd',
      'Crown Business Group',
      'Diamond Enterprises Ltd',
    ];

    const taxOffices = [
      'Lagos Tax Office',
      'Abuja Tax Office',
      'Port Harcourt Tax Office',
      'Kano Tax Office',
      'Ibadan Tax Office',
    ];

    const taxPayerTypes = [
      'Corporate',
      'Individual',
      'Small Business',
      'Large Corporation',
      'Partnership',
    ];

    const companyIndex = tinHash % companyNames.length;
    const officeIndex = tinHash % taxOffices.length;
    const typeIndex = tinHash % taxPayerTypes.length;

    const taxPayerName = fullName || companyNames[companyIndex];
    const taxOffice = taxOffices[officeIndex];
    const taxPayerType = taxPayerTypes[typeIndex];

    logger.info('Mock TIN verification completed', {
      tin: `***${tin.slice(-4)}`,
      taxPayerName,
    });

    return {
      success: true,
      data: {
        tin,
        taxPayerName,
        taxOffice,
        taxPayerType,
        status: 'ACTIVE',
      },
      message: 'TIN verified successfully (mock)',
    };
  }

  /**
   * Verify Individual TIN using NIBSS Identity v2
   */
  async verifyIndividualTin(tin: string): Promise<IndividualTinVerificationResult> {
    if (!this.validateTin(tin)) {
      throw new ValidationError('Invalid TIN format. TIN must be 8-14 digits');
    }

    try {
      logger.info('Initiating Individual TIN verification via NIBSS Identity v2', {
        tin: `***${tin.slice(-4)}`,
      });

      if (!process.env.NIBSS_BIVS_CLIENT_ID || !process.env.NIBSS_BIVS_CLIENT_SECRET) {
        throw new ValidationError('TIN verification service is not configured. Please contact support.');
      }

      const result = await nibssClient.verifyIndividualTin(tin);

      if (!result.verified) {
        logger.warn('Individual TIN verification failed', { tin: `***${tin.slice(-4)}`, message: result.message });
        return { success: false, message: result.message, error: result.message };
      }

      logger.info('Individual TIN verified successfully', { tin: `***${tin.slice(-4)}` });
      return { success: true, data: result.data, message: result.message };
    } catch (error: any) {
      logger.error('Individual TIN verification error', { tin: `***${tin.slice(-4)}`, error: error.message });
      return { success: false, message: 'Individual TIN verification failed', error: error.message };
    }
  }

  /**
   * Verify Corporate TIN using NIBSS Identity v2
   */
  async verifyCorporateTin(tin: string): Promise<CorporateTinVerificationResult> {
    if (!this.validateTin(tin)) {
      throw new ValidationError('Invalid TIN format. TIN must be 8-14 digits');
    }

    try {
      logger.info('Initiating Corporate TIN verification via NIBSS Identity v2', {
        tin: `***${tin.slice(-4)}`,
      });

      if (!process.env.NIBSS_BIVS_CLIENT_ID || !process.env.NIBSS_BIVS_CLIENT_SECRET) {
        throw new ValidationError('TIN verification service is not configured. Please contact support.');
      }

      const result = await nibssClient.verifyCorporateTin(tin);

      if (!result.verified) {
        logger.warn('Corporate TIN verification failed', { tin: `***${tin.slice(-4)}`, message: result.message });
        return { success: false, message: result.message, error: result.message };
      }

      logger.info('Corporate TIN verified successfully', { tin: `***${tin.slice(-4)}` });
      return { success: true, data: result.data, message: result.message };
    } catch (error: any) {
      logger.error('Corporate TIN verification error', { tin: `***${tin.slice(-4)}`, error: error.message });
      return { success: false, message: 'Corporate TIN verification failed', error: error.message };
    }
  }

  /**
   * Verify TIN with consent management
   *
   * @param tin - Tax Identification Number
   * @param userId - User ID for consent tracking
   * @param purpose - Purpose of TIN verification
   * @param fullName - Optional full name for verification
   */
  async verifyTinWithConsent(
    tin: string,
    userId: string,
    purpose: string = 'Tax Compliance Verification',
    fullName?: string
  ): Promise<TinVerificationResult> {
    // Validate TIN format
    if (!this.validateTin(tin)) {
      throw new ValidationError('Invalid TIN format. TIN must be 8-14 digits');
    }

    try {
      logger.info('Initiating TIN verification with consent', {
        tin: `***${tin.slice(-4)}`,
        userId,
        purpose,
      });

      // Request consent via NIBSS Consent Hub
      const consentResponse = await nibssClient.initiateConsent(userId, 'YYYY', false);

      if (!consentResponse.success) {
        logger.warn('Consent request failed', {
          userId,
          message: consentResponse.message,
        });

        return {
          success: false,
          message: `Consent request failed: ${consentResponse.message}`,
          error: consentResponse.message,
        };
      }

      logger.info('Consent obtained successfully', {
        userId,
        sessionId: consentResponse.sessionId,
      });

      // Proceed with TIN verification
      return await this.verifyTin(tin, fullName);
    } catch (error: any) {
      logger.error('TIN verification with consent error', {
        tin: `***${tin.slice(-4)}`,
        userId,
        error: error.message,
      });

      return {
        success: false,
        message: 'TIN verification with consent failed',
        error: error.message,
      };
    }
  }
}

export default new TinService();
