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
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    nationality?: string;
    stateOfOrigin?: string;
    lgaOfOrigin?: string;
    stateOfResidence?: string;
    residentialAddress?: string;
    email?: string;
    phoneNumber?: string;
    enrollBankCode?: string;
    watchlisted?: boolean;
    faceImage?: string;
  };
  message: string;
  error?: string;
}

export interface BvnBooleanResult {
  success: boolean;
  matches?: {
    firstnameMatch?: boolean;
    lastnameMatch?: boolean;
    middlenameMatch?: boolean;
    dobMatch?: boolean;
    genderMatch?: boolean;
    phoneMatch?: boolean;
  };
  message: string;
  error?: string;
}

export class BvnService {
  /**
   * Initiate NIBSS Consent Hub session for BVN verification.
   * Returns a consentUrl the user must visit to authorise data access.
   * After the user authenticates, NIBSS will POST a retrievalToken to the configured callback URL.
   */
  async initiateConsentForBvn(bvn: string): Promise<{
    success: boolean;
    sessionId?: string;
    consentUrl?: string;
    message: string;
    error?: string;
  }> {
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    if (!process.env.NIBSS_CONSENT_CLIENT_ID || !process.env.NIBSS_CONSENT_CLIENT_SECRET) {
      logger.error('NIBSS Consent credentials not configured');
      throw new ValidationError('BVN verification service is not configured. Please contact support.');
    }

    try {
      logger.info('Initiating NIBSS consent for BVN', { bvn: `***${bvn.slice(-4)}` });

      const result = await nibssClient.initiateConsent(bvn, 'YYYY', true);

      if (!result.success) {
        logger.warn('NIBSS consent initiation failed', { message: result.message });
        return { success: false, message: result.message };
      }

      logger.info('NIBSS consent session created', { sessionId: result.sessionId });

      return {
        success: true,
        sessionId: result.sessionId,
        consentUrl: result.consentUrl,
        message: result.message,
      };
    } catch (error: any) {
      logger.error('BVN consent initiation error', {
        bvn: `***${bvn.slice(-4)}`,
        error: error.message,
      });
      return { success: false, message: 'BVN consent initiation failed', error: error.message };
    }
  }

  /**
   * iGree flow: build the IdP authorization URL for the user to consent.
   * Returns the URL to redirect to plus a state token used to correlate the callback.
   */
  initiateIGreeConsent(state: string): { authUrl: string } {
    const authUrl = nibssClient.iGreeGetAuthUrl(state);
    return { authUrl };
  }

  /**
   * iGree flow: exchange authorization code for access token, then fetch BVN details.
   */
  async verifyBvnWithIGreeCode(code: string): Promise<BvnVerificationResult> {
    try {
      logger.info('iGree: exchanging authorization code for access token');
      const { accessToken } = await nibssClient.iGreeExchangeCode(code);

      const result = await nibssClient.iGreeGetBvnDetails(accessToken);

      if (!result.verified || !result.data) {
        return { success: false, message: result.message };
      }

      return {
        success: true,
        data: {
          firstName:          result.data.firstName,
          lastName:           result.data.lastName,
          middleName:         result.data.middleName,
          dateOfBirth:        result.data.dateOfBirth,
          gender:             result.data.gender,
          maritalStatus:      result.data.maritalStatus,
          nationality:        result.data.nationality,
          stateOfOrigin:      result.data.stateOfOrigin,
          lgaOfOrigin:        result.data.lgaOfOrigin,
          watchlisted:        result.data.watchlisted,
          faceImage:          result.data.faceImage,
        },
        message: 'BVN verified via iGree successfully',
      };
    } catch (error: any) {
      logger.error('iGree BVN verification error', { error: error.message });
      return { success: false, message: 'iGree BVN verification failed', error: error.message };
    }
  }

  /**
   * Complete BVN verification using a retrievalToken obtained from the Consent Hub callback.
   * Calls FAS to extract full KYC data.
   */
  async verifyBvnWithRetrievalToken(bvn: string, retrievalToken: string): Promise<BvnVerificationResult> {
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      logger.info('Verifying BVN via FAS', { bvn: `***${bvn.slice(-4)}` });

      const result = await nibssClient.fasValidateBvnCore(bvn, retrievalToken);

      if (!result.verified || !result.data) {
        logger.warn('FAS BVN verification failed', { message: result.message });
        return { success: false, message: result.message || 'BVN verification failed' };
      }

      logger.info('BVN verified via FAS', {
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      });

      return {
        success: true,
        data: result.data,
        message: 'BVN verified successfully',
      };
    } catch (error: any) {
      logger.error('BVN FAS verification error', {
        bvn: `***${bvn.slice(-4)}`,
        error: error.message,
      });
      return { success: false, message: 'BVN verification failed', error: error.message };
    }
  }

  /**
   * Boolean BVN validation — verifies that a BVN matches the supplied user profile fields.
   * Used for post-signup KYC; does not require the Consent Hub flow.
   */
  async verifyBvnBoolean(bvn: string, profile: {
    firstname: string;
    lastname: string;
    middlename?: string;
    phone_no?: string;
    dob?: string;
    gender?: string;
  }): Promise<BvnBooleanResult> {
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      logger.info('FAS BVN boolean verification', { bvn: `***${bvn.slice(-4)}` });

      const result = await nibssClient.fasValidateBvnBoolean(bvn, {
        firstname:  profile.firstname,
        lastname:   profile.lastname,
        middlename: profile.middlename || '',
        phone_no:   profile.phone_no   || '',
        dob:        profile.dob        || '',
        gender:     profile.gender     || '',
      });

      return {
        success:  result.success,
        matches:  result.matches,
        message:  result.message,
      };
    } catch (error: any) {
      logger.error('BVN boolean verification error', { bvn: `***${bvn.slice(-4)}`, error: error.message });
      return { success: false, message: 'BVN boolean verification failed', error: error.message };
    }
  }
}

export default new BvnService();
