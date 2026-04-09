import { ValidationError, validateBvn } from '../../../shared/utils';
import { nibssClient } from '../../../integrations/nibss/nibss.client';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('BvnService');

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
    stateOfOrigin?: string;
    watchListed?: boolean;
    enrollmentBank?: string;
  };
  message: string;
  error?: string;
}

export class BvnService {
  /**
   * Verify BVN using NIBSS BIVS API
   *
   * @param bvn - Bank Verification Number (11 digits)
   * @param phoneNumber - Optional phone number for additional verification
   * @param dateOfBirth - Optional date of birth in YYYY-MM-DD format
   * @param firstName - Optional first name for verification
   * @param lastName - Optional last name for verification
   */
  async verifyBvn(
    bvn: string,
    phoneNumber?: string,
    dateOfBirth?: string,
    firstName?: string,
    lastName?: string
  ): Promise<BvnVerificationResult> {
    // Validate BVN format
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      logger.info('Initiating BVN verification via NIBSS', {
        bvn: `***${bvn.slice(-4)}`,
        hasPhoneNumber: !!phoneNumber,
        hasDoB: !!dateOfBirth,
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
      });

      // Check if NIBSS is configured
      const isNibssConfigured = process.env.NIBSS_BIVS_CLIENT_ID && process.env.NIBSS_BIVS_CLIENT_SECRET;

      if (!isNibssConfigured) {
        logger.error('NIBSS credentials not configured. BVN verification unavailable.');
        throw new ValidationError('BVN verification service is not configured. Please contact support.');
      }

      // Call NIBSS BIVS API
      const nibssResponse = await nibssClient.verifyBvn({
        BVN: bvn,
        PhoneNumber: phoneNumber,
        DoB: dateOfBirth,
        FirstName: firstName,
        LastName: lastName,
      });

      if (!nibssResponse.verified) {
        logger.warn('BVN verification failed via NIBSS', {
          bvn: `***${bvn.slice(-4)}`,
          message: nibssResponse.message,
        });

        return {
          success: false,
          message: nibssResponse.message,
          error: nibssResponse.message,
        };
      }

      logger.info('BVN verified successfully via NIBSS', {
        bvn: `***${bvn.slice(-4)}`,
        firstName: nibssResponse.data?.firstName,
        lastName: nibssResponse.data?.lastName,
      });

      return {
        success: true,
        data: {
          firstName: nibssResponse.data!.firstName,
          lastName: nibssResponse.data!.lastName,
          middleName: nibssResponse.data!.middleName,
          dateOfBirth: nibssResponse.data!.dateOfBirth,
          phoneNumber: nibssResponse.data!.phoneNumber,
          email: nibssResponse.data!.email,
          gender: nibssResponse.data!.gender,
          stateOfOrigin: nibssResponse.data!.stateOfOrigin,
          nationality: nibssResponse.data!.nationality,
          watchListed: nibssResponse.data!.watchListed,
          enrollmentBank: nibssResponse.data!.enrollmentBank,
          address: undefined, // NIBSS doesn't provide full address in BIVS response
        },
        message: 'BVN verified successfully',
      };
    } catch (error: any) {
      logger.error('BVN verification error', {
        bvn: `***${bvn.slice(-4)}`,
        error: error.message,
        stack: error.stack,
      });

      // Don't fall back to mock - NIBSS is the only verification method
      // if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      //   logger.warn('Falling back to mock BVN verification due to error');
      //   return await this.mockBvnVerification(bvn);
      // }

      return {
        success: false,
        message: 'BVN verification failed',
        error: error.message,
      };
    }
  }

  /**
   * Mock BVN verification for development/testing
   * This generates consistent data based on the BVN input
   *
   * NOTE: This is commented out - NIBSS is now the only verification method
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async mockBvnVerification(bvn: string): Promise<BvnVerificationResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info('Using mock BVN verification', {
      bvn: `***${bvn.slice(-4)}`,
    });

    // Generate dynamic user data based on BVN
    // This ensures each BVN generates consistent but unique data
    const timestamp = Date.now();
    const bvnHash = parseInt(bvn.slice(-6)); // Use last 6 digits for variation

    const firstNames = ['Chinedu', 'Amina', 'Tunde', 'Aisha', 'Oluwaseun', 'Fatima', 'Emeka', 'Zainab', 'Adebayo', 'Hauwa'];
    const lastNames = ['Okafor', 'Ibrahim', 'Adeyemi', 'Bello', 'Eze', 'Musa', 'Nwosu', 'Yusuf', 'Okoro', 'Sani'];
    const middleNames = ['Emmanuel', 'Mohammed', 'Oluwaseun', 'Ahmed', 'Chukwuemeka', 'Abubakar', 'Oluwakemi', 'Hassan'];
    const genders = ['Male', 'Female'];
    const cities = [
      { city: 'Lagos', street: 'Victoria Island', state: 'Lagos' },
      { city: 'Abuja', street: 'Wuse', state: 'FCT' },
      { city: 'Port Harcourt', street: 'GRA', state: 'Rivers' },
      { city: 'Kano', street: 'Sabon Gari', state: 'Kano' },
      { city: 'Ibadan', street: 'Bodija', state: 'Oyo' },
    ];

    const firstNameIndex = bvnHash % firstNames.length;
    const lastNameIndex = (bvnHash * 2) % lastNames.length;
    const middleNameIndex = (bvnHash * 3) % middleNames.length;
    const genderIndex = bvnHash % genders.length;
    const cityIndex = bvnHash % cities.length;

    const firstName = firstNames[firstNameIndex];
    const lastName = lastNames[lastNameIndex];
    const middleName = middleNames[middleNameIndex];
    const gender = genders[genderIndex];
    const location = cities[cityIndex];

    // Generate unique email using timestamp
    const emailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${bvn}`;
    const email = `${emailPrefix}@yopmail.com`;

    // Generate unique phone number
    const phoneNumber = `+234${800 + (bvnHash % 100)}${String(timestamp).slice(-7)}`;

    // Generate date of birth (between 18 and 65 years old)
    const age = 18 + (bvnHash % 47);
    const year = new Date().getFullYear() - age;
    const month = String(1 + (bvnHash % 12)).padStart(2, '0');
    const day = String(1 + (bvnHash % 28)).padStart(2, '0');
    const dateOfBirth = `${year}-${month}-${day}`;

    // Generate address
    const streetNumber = 1 + (bvnHash % 999);
    const address = `${streetNumber} ${location.street} Street, ${location.city}`;

    const bvnData = {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      phoneNumber,
      email,
      address,
      gender,
      nationality: 'Nigerian',
      stateOfOrigin: location.state,
      watchListed: false,
      enrollmentBank: 'First Bank of Nigeria',
    };

    logger.info('Mock BVN verification completed', {
      bvn: `***${bvn.slice(-4)}`,
      firstName,
      lastName,
    });

    return {
      success: true,
      data: bvnData,
      message: 'BVN verified successfully (mock)',
    };
  }

  /**
   * Verify BVN with consent management
   * This method requests consent before verification
   *
   * @param bvn - Bank Verification Number
   * @param userId - User ID for consent tracking
   * @param purpose - Purpose of BVN verification
   */
  async verifyBvnWithConsent(
    bvn: string,
    userId: string,
    purpose: string = 'KYC Verification'
  ): Promise<BvnVerificationResult> {
    // Validate BVN format
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      logger.info('Initiating BVN verification with consent', {
        bvn: `***${bvn.slice(-4)}`,
        userId,
        purpose,
      });

      // Request consent via NIBSS ConsentMgmt
      const consentResponse = await nibssClient.requestConsent({
        customerId: userId,
        serviceType: 'BVN_VERIFICATION',
        duration: 30, // 30 days
        purpose,
      });

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
        consentId: consentResponse.consentId,
      });

      // Proceed with BVN verification
      return await this.verifyBvn(bvn);
    } catch (error: any) {
      logger.error('BVN verification with consent error', {
        bvn: `***${bvn.slice(-4)}`,
        userId,
        error: error.message,
      });

      return {
        success: false,
        message: 'BVN verification with consent failed',
        error: error.message,
      };
    }
  }
}

export default new BvnService();
