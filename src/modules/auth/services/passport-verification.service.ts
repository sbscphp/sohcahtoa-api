import { ValidationError } from '../../../shared/utils';
import { createLogger } from '../../../shared/utils/logger';
import qoreIDClient from '../../../integrations/qoreid/qoreid.client';

const logger = createLogger('PassportVerificationService');

export interface PassportVerificationResult {
  success: boolean;
  data?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    passportNumber: string;
    nationality: string;
    email?: string;
    phoneNumber?: string;
  };
  message: string;
  error?: string;
}

export class PassportVerificationService {
  /**
   * Verify a passport document.
   * When QoreID is configured (QOREID_CLIENT_ID + QOREID_SECRET set) and a
   * passportNumber is provided, the live QoreID API is called.
   * Otherwise falls back to a dev mock that generates plausible data.
   */
  async verifyPassport(
    passportDocumentUrl: string,
    passportNumber?: string
  ): Promise<PassportVerificationResult> {
    if (!passportDocumentUrl && !passportNumber) {
      throw new ValidationError('Passport document URL or passport number is required');
    }

    if (passportNumber && qoreIDClient.isConfigured) {
      return this.verifyWithQoreID(passportNumber);
    }

    logger.warn('QoreID not configured or passport number not provided — using mock passport verification');
    return this.mockPassportVerification(passportDocumentUrl);
  }

  private async verifyWithQoreID(passportNumber: string): Promise<PassportVerificationResult> {
    try {
      const result = await qoreIDClient.verifyPassport(passportNumber);

      const state = result.status?.state?.toUpperCase();
      if (state !== 'VERIFIED' && state !== 'ID_VERIFIED') {
        return {
          success: false,
          message: `Passport verification failed: ${result.status?.status || state}`,
        };
      }

      const p = result.passport;
      if (!p) {
        return { success: false, message: 'No passport data returned from verification service' };
      }

      return {
        success: true,
        message: 'Passport verified successfully',
        data: {
          firstName: p.firstname || '',
          lastName: p.lastname || '',
          dateOfBirth: p.birthdate || '',
          passportNumber: p.id || passportNumber,
          nationality: p.nationality || p.birthplace || '',
          email: p.email || undefined,
          phoneNumber: p.mobile || undefined,
        },
      };
    } catch (error: any) {
      logger.error('QoreID passport verification error', { error: error.message });
      return {
        success: false,
        message: 'Passport verification failed',
        error: error.message,
      };
    }
  }

  private async mockPassportVerification(documentUrl: string): Promise<PassportVerificationResult> {
    // Simulate verification delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const timestamp = Date.now();
    const urlHash = (documentUrl || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const firstNames = ['John', 'Maria', 'Wei', 'Ahmed', 'Sophie', 'Raj', 'Elena', 'Kwame', 'Yuki', 'Carlos'];
    const lastNames  = ['Smith', 'Garcia', 'Zhang', 'Al-Fayed', 'Dubois', 'Patel', 'Rossi', 'Osei', 'Tanaka', 'Silva'];
    const nationalities = [
      { name: 'United Kingdom', prefix: 'GB', phoneCode: '+44' },
      { name: 'Spain',          prefix: 'ES', phoneCode: '+34' },
      { name: 'China',          prefix: 'CN', phoneCode: '+86' },
      { name: 'France',         prefix: 'FR', phoneCode: '+33' },
      { name: 'India',          prefix: 'IN', phoneCode: '+91' },
      { name: 'Ghana',          prefix: 'GH', phoneCode: '+233' },
    ];

    const firstName   = firstNames[urlHash % firstNames.length];
    const lastName    = lastNames[(urlHash * 2) % lastNames.length];
    const nationality = nationalities[urlHash % nationalities.length];

    const emailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${String(timestamp).slice(-9)}`;
    const passportNumber = `${nationality.prefix}${String(timestamp).slice(-8)}`;
    const phoneNumber    = `${nationality.phoneCode}${String(timestamp).slice(-9)}`;

    const age  = 18 + (urlHash % 52);
    const year = new Date().getFullYear() - age;
    const month = String(1 + (urlHash % 12)).padStart(2, '0');
    const day   = String(1 + (urlHash % 28)).padStart(2, '0');

    return {
      success: true,
      message: 'Passport verified successfully',
      data: {
        firstName,
        lastName,
        dateOfBirth: `${year}-${month}-${day}`,
        passportNumber,
        nationality: nationality.name,
        email:       `${emailPrefix}@yopmail.com`,
        phoneNumber,
      },
    };
  }
}

export default new PassportVerificationService();
