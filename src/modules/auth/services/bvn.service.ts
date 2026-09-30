import { ValidationError, validateBvn } from '../../../shared/utils';
import { nibssClient } from '../../../integrations/nibss/nibss.client';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('BvnService');

export interface BvnVerificationResult {
  success: boolean;
  data?: {
    bvn?: string;
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
    nin?: string;
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
   * iGree flow: build the IdP authorization URL for the user to consent.
   * Returns the URL to redirect to plus a state token used to correlate the callback.
   */
  initiateIGreeConsent(state: string): { authUrl: string } {
    const authUrl = nibssClient.iGreeGetAuthUrl(state);
    return { authUrl };
  }

  /**
   * iGree Step 2 (consent callback): exchange the authorization code for the consent-phase
   * token — proving the customer completed OTP consent on NIBSS's portal — then immediately
   * obtain the retrieval-phase client_credentials token. Deliberately does NOT fetch full BVN
   * details — that's `getIGreeBvnDetails`, a separate frontend-triggered step — so a flaky
   * NIBSS data endpoint can't undo a consent that already succeeded.
   *
   * The bvn to look up in Step 3 comes from the customer's self-reported value at Step 1, NOT
   * from this exchange — NIBSS's oxAuth server doesn't release a bvn claim for this client
   * registration either way (see nibss.client.ts's iGreeExchangeCode). Step 1b's cross-check of
   * self-reported name/DOB against NIBSS's record for that bvn is the real integrity guarantee.
   */
  async exchangeIGreeConsentCode(code: string): Promise<{ retrievalToken: string }> {
    logger.info('iGree: exchanging authorization code for access token');
    // accessToken from the consent-phase exchange is not used for retrieval — that phase
    // authenticates with its own client_credentials token (see nibss.client.ts).
    await nibssClient.iGreeExchangeCode(code);
    const retrievalToken = await nibssClient.getIGreeRetrievalToken();
    return { retrievalToken };
  }

  /**
   * iGree Step 3 (frontend-triggered retrieval): fetch full BVN details for a bvn already
   * verified in Step 2. The retrieval token itself is managed/cached inside nibssClient.
   */
  async getIGreeBvnDetails(bvn: string, sessionId?: string): Promise<BvnVerificationResult> {
    try {
      const result = await nibssClient.iGreeGetBvnDetails(bvn, sessionId);

      if (!result.verified || !result.data) {
        return { success: false, message: result.message };
      }

      return {
        success: true,
        data: {
          bvn,
          firstName:          result.data.firstName,
          lastName:           result.data.lastName,
          middleName:         result.data.middleName,
          dateOfBirth:        result.data.dateOfBirth,
          gender:             result.data.gender,
          maritalStatus:      result.data.maritalStatus,
          nationality:        result.data.nationality,
          stateOfOrigin:      result.data.stateOfOrigin,
          lgaOfOrigin:        result.data.lgaOfOrigin,
          nin:                result.data.nin,
          watchlisted:        result.data.watchlisted,
          faceImage:          result.data.faceImage,
        },
        message: 'BVN verified via iGree successfully',
      };
    } catch (error: any) {
      logger.error('iGree BVN details retrieval error', { error: error.message });
      return { success: false, message: 'iGree BVN retrieval failed', error: error.message };
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
