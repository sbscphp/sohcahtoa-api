import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('NIBSSClient');

// ─── Token ───────────────────────────────────────────────────────────────────

interface NIBSSTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ─── FAS (Financial Authentication Service) ──────────────────────────────────

interface FASBvnCoreRequest {
  number: string;
  type: 'bvn';
  retrievalToken: string;
}

interface FASBvnBooleanRequest {
  number: string;
  type: 'bvn';
  firstname: string;
  lastname: string;
  middlename: string;
  phone_no: string;
  dob: string;
  gender: string;
}

interface FASNinSharecodeRequest {
  number: string;
  type: 'ninauth_sharecode';
  requestReason: string;
}

interface FASNinInPersonRequest {
  number: string;
  type: 'ninauth_inperson';
  requestReason: string;
  biometric: string; // base64 selfie
}

interface FASCoreOptionalRequest {
  number: string;       // BVN
  type: 'bvn';
  optionA: string;      // NIN ShareCode
  optionB: 'ninauth_sharecode';
  requestReason: string;
}

interface FASBvnCoreData {
  first_name?: string;
  middle_name?: string;
  surname?: string;
  date_of_birth?: string;
  DateOfBirth?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  state_of_origin?: string;
  lga_of_origin?: string;
  state_of_residence?: string;
  lga_of_residence?: string;
  residential_address?: string;
  email?: string;
  Phone_number1?: string;
  phone_number2?: string;
  enroll_bank_code?: string;
  watchlisted?: number;
  face_image?: string;
  match?: string;
}

interface FASNinCoreData {
  biographicData?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    gender?: string;
    phone1?: string;
  };
  biometricData?: Array<{ image?: string; biometricSubType?: string }>;
  contactData?: { phone1?: string };
}

interface FASCoreResponse {
  data?: FASBvnCoreData | { data?: FASNinCoreData; [key: string]: any };
  targeturl?: string;
  targetUrl?: string;
  valRequestId?: number;
  match?: string;
}

interface FASBooleanData {
  firstnameMatch?: boolean;
  lastnameMatch?: boolean;
  middlenameMatch?: boolean;
  dobMatch?: boolean;
  genderMatch?: boolean;
  phoneMatch?: boolean;
}

interface FASComparisonData {
  firstNameMatch?: boolean;
  lastNameMatch?: boolean;
  middleNameMatch?: boolean;
  dobMatch?: boolean;
  genderMatch?: boolean;
  phoneMatch?: boolean;
}

// ─── Consent Hub ─────────────────────────────────────────────────────────────

interface ConsentInitiateRequest {
  dataControllerId: string;
  dataProcessorId: string;
  dataOwnerID: string;
  requestType: string;      // e.g. "YYYY"
  consentType: 'RedirectLink' | 'OfflineConsent';
  dataSubjectPresent: boolean;
  authenticationDate: string; // YYYY-MM-DD
}

interface ConsentInitiateResponse {
  responseCode: string;
  sessionId?: string;
  data?: { consentUrl?: string };
  messageTimestamp?: string;
  responseMessage?: string;
}

// ─── TIN / Account (legacy BIVS) ─────────────────────────────────────────────

interface TINVerificationRequest {
  TIN: string;
  FullName?: string;
}

interface TINVerificationResponse {
  ResponseCode: string;
  ResponseDescription: string;
  TIN?: string;
  TaxPayerName?: string;
  TaxOffice?: string;
  TaxPayerType?: string;
  Status?: string;
}

// ─── TIN Identity v2 (Individual / Corporate) ────────────────────────────────

interface TINIdentityRequest {
  ValidationNumber: string;
  Signature: string; // Base64 of client username
}

interface IndividualTINResponse {
  status: string;
  message: string;
  data?: {
    taxpayer?: {
      tin?: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      phone_no?: string;
      email?: string;
      date_of_birth?: string;
      date_of_registration?: string;
      tax_authority?: string;
      tax_office?: string | null;
    };
    responseCode?: string;
    responseDescription?: string;
  };
}

interface CorporateTINResponse {
  status: string;
  message: string;
  data?: {
    taxpayer?: {
      tin?: string;
      registered_name?: string;
      registration_number?: string;
      phone_no?: string | null;
      email?: string | null;
      date_of_incorporation?: string;
      date_of_registration?: string;
      tax_authority?: string;
      tax_office?: string | null;
    };
    responseCode?: string;
    responseDescription?: string;
  };
}

/**
 * NIBSS API Client
 *
 * Integrations:
 * - FAS (Financial Authentication Service) — BVN & NIN validation
 *   Base URL: NIBSS_FAS_BASE_URL  (https://apitest.nibss-plc.com.ng/cvs/v2)
 *   Endpoint: POST /switch10/{subclass}/{retry}/{institutionCode}
 *
 * - Consent Hub — consent initiation (required before FAS BVN lookup)
 *   Base URL: NIBSS_CONSENT_HUB_BASE_URL  (https://apitest.nibss-plc.com.ng/api)
 *   Endpoint: POST /consent/initiate
 *
 * - BIVS — TIN verification, token generation
 *   Reset URL: NIBSS_BIVS_RESET_URL
 */
export class NIBSSClient {
  // ── Axios clients ──
  private fasClient: AxiosInstance;
  private consentHubClient: AxiosInstance;
  private bivsClient: AxiosInstance; // kept for TIN + token generation
  private identityClient: AxiosInstance; // TIN Identity v2 (individual / corporate)

  // ── BIVS (token + TIN) ──
  private bivsClientId: string;
  private bivsClientSecret: string;
  private bivsBaseUrl: string;
  private bivsResetUrl: string;
  private bivsClientUsername: string; // Base64'd for TIN Identity v2 Signature field
  private tinIdentityBaseUrl: string;

  // ── Consent Hub / FAS (shared credentials per user confirmation) ──
  private consentClientId: string;
  private consentClientSecret: string;
  private consentResetUrl: string;

  // ── FAS path params ──
  private fasBaseUrl: string;
  private fasSubclass: string;
  private fasRetry: string;
  private institutionCode: string;

  // ── Consent Hub ──
  private consentHubBaseUrl: string;
  private dataControllerId: string;   // NIBSS fixed test ID
  private callbackUrl: string;

  // ── Token cache ──
  private bivsToken: string | null = null;
  private bivsTokenExpiry: number = 0;
  private consentToken: string | null = null;
  private consentTokenExpiry: number = 0;

  constructor() {
    // BIVS
    this.bivsClientId        = process.env.NIBSS_BIVS_CLIENT_ID       || '';
    this.bivsClientSecret    = process.env.NIBSS_BIVS_CLIENT_SECRET   || '';
    this.bivsBaseUrl         = process.env.NIBSS_BIVS_BASE_URL        || 'https://apitest.nibss-plc.com.ng:1443';
    this.bivsResetUrl        = process.env.NIBSS_BIVS_RESET_URL       || 'https://apitest.nibss-plc.com.ng:1443/reset';
    this.bivsClientUsername  = process.env.NIBSS_BIVS_CLIENT_USERNAME || '';
    this.tinIdentityBaseUrl  = process.env.NIBSS_TIN_BASE_URL         || 'https://apitest.nibss-plc.com.ng/identity/v2';

    // Consent Hub / FAS (same credentials)
    this.consentClientId     = process.env.NIBSS_CONSENT_CLIENT_ID     || '';
    this.consentClientSecret = process.env.NIBSS_CONSENT_CLIENT_SECRET || '';
    this.consentResetUrl     = process.env.NIBSS_CONSENT_RESET_URL     || 'https://apitest.nibss-plc.com.ng:1443/reset';

    // FAS
    this.fasBaseUrl      = process.env.NIBSS_FAS_BASE_URL  || 'https://apitest.nibss-plc.com.ng/cvs/v2';
    this.fasSubclass     = process.env.NIBSS_FAS_SUBCLASS  || '1';
    this.fasRetry        = process.env.NIBSS_FAS_RETRY     || '1';
    this.institutionCode = process.env.NIBSS_INSTITUTION_CODE || '';

    // Consent Hub
    this.consentHubBaseUrl = process.env.NIBSS_CONSENT_HUB_BASE_URL || 'https://apitest.nibss-plc.com.ng/api';
    this.dataControllerId  = process.env.NIBSS_DATA_CONTROLLER_ID   || 'd6378b2e-092f-485a-a1f9-f97b3ca8c3f3';
    this.callbackUrl       = process.env.NIBSS_CALLBACK_URL         || '';

    // ── Axios instances ──
    this.bivsClient = axios.create({
      baseURL: this.bivsBaseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.fasClient = axios.create({
      baseURL: this.fasBaseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.consentHubClient = axios.create({
      baseURL: this.consentHubBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Version': '1.0.0',
      },
    });

    this.identityClient = axios.create({
      baseURL: this.tinIdentityBaseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
  }

  // ─── Interceptors ──────────────────────────────────────────────────────────

  private setupInterceptors() {
    const attach = (client: AxiosInstance, label: string) => {
      client.interceptors.request.use(
        (config) => {
          logger.info(`NIBSS ${label} Request`, { method: config.method, url: config.url });
          return config;
        },
        (error) => { logger.error(`NIBSS ${label} Request Error`, error); return Promise.reject(error); }
      );
      client.interceptors.response.use(
        (response) => {
          logger.info(`NIBSS ${label} Response`, { status: response.status });
          return response;
        },
        (error) => {
          logger.error(`NIBSS ${label} Response Error`, {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
          });
          return Promise.reject(error);
        }
      );
    };

    attach(this.bivsClient,       'BIVS');
    attach(this.fasClient,        'FAS');
    attach(this.consentHubClient, 'ConsentHub');
    attach(this.identityClient,   'TINIdentity');
  }

  // ─── Token management ──────────────────────────────────────────────────────

  private async getBivsToken(): Promise<string> {
    if (this.bivsToken && Date.now() < this.bivsTokenExpiry) return this.bivsToken;

    logger.info('Requesting BIVS access token');
    const params = new URLSearchParams();
    params.append('client_id',     this.bivsClientId);
    params.append('client_secret', this.bivsClientSecret);
    params.append('scope',         `${this.bivsClientId}/.default`);
    params.append('grant_type',    'client_credentials');

    try {
      const res = await axios.post<NIBSSTokenResponse>(this.bivsResetUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      this.bivsToken       = res.data.access_token;
      this.bivsTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
      logger.info('BIVS token obtained', { expiresIn: res.data.expires_in });
      return this.bivsToken;
    } catch (error: any) {
      logger.error('Failed to obtain BIVS token', { error: error.message, data: error.response?.data });
      throw new Error(`BIVS authentication failed: ${error.message}`);
    }
  }

  private async getConsentToken(): Promise<string> {
    if (this.consentToken && Date.now() < this.consentTokenExpiry) return this.consentToken;

    logger.info('Requesting Consent/FAS access token');
    const params = new URLSearchParams();
    params.append('client_id',     this.consentClientId);
    params.append('client_secret', this.consentClientSecret);
    params.append('scope',         `${this.consentClientId}/.default`);
    params.append('grant_type',    'client_credentials');

    try {
      const res = await axios.post<NIBSSTokenResponse>(this.consentResetUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      this.consentToken       = res.data.access_token;
      this.consentTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
      logger.info('Consent token obtained', { expiresIn: res.data.expires_in });
      return this.consentToken;
    } catch (error: any) {
      logger.error('Failed to obtain Consent token', { error: error.message, data: error.response?.data });
      throw new Error(`Consent authentication failed: ${error.message}`);
    }
  }

  // ─── Consent Hub ───────────────────────────────────────────────────────────

  /**
   * Initiate a consent request via NIBSS Consent Hub.
   * Returns a consentUrl to redirect the user to for authentication.
   * After the user authenticates, NIBSS will POST a retrievalToken to your callback URL.
   *
   * @param dataOwnerId  User's BVN or NIN
   * @param requestType  4-char string e.g. "YYYY" (Personal ID, Contact, Demographics, Geographic)
   * @param dataSubjectPresent  true if user is physically present (gets redirect URL)
   */
  async initiateConsent(
    dataOwnerId: string,
    requestType: string = 'YYYY',
    dataSubjectPresent: boolean = true
  ): Promise<{
    success: boolean;
    sessionId?: string;
    consentUrl?: string;
    message: string;
  }> {
    try {
      const token = await this.getConsentToken();
      const today = new Date().toISOString().split('T')[0];

      const body: ConsentInitiateRequest = {
        dataControllerId:   this.dataControllerId,
        dataProcessorId:    this.consentClientId,
        dataOwnerID:        dataOwnerId,
        requestType,
        consentType:        'RedirectLink',
        dataSubjectPresent,
        authenticationDate: today,
      };

      logger.info('Initiating Consent Hub request', {
        dataOwnerId: `***${dataOwnerId.slice(-4)}`,
        requestType,
        dataSubjectPresent,
      });

      const res = await this.consentHubClient.post<ConsentInitiateResponse>(
        '/consent/initiate',
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const isSuccess = res.data.responseCode === '00';

      if (!isSuccess) {
        logger.warn('Consent Hub initiation failed', {
          responseCode: res.data.responseCode,
          message: res.data.responseMessage,
        });
        return { success: false, message: res.data.responseMessage || 'Consent initiation failed' };
      }

      logger.info('Consent Hub session created', { sessionId: res.data.sessionId });

      return {
        success:    true,
        sessionId:  res.data.sessionId,
        consentUrl: res.data.data?.consentUrl,
        message:    res.data.responseMessage || 'Consent session created',
      };
    } catch (error: any) {
      logger.error('Consent Hub initiation error', { error: error.message, data: error.response?.data });
      return { success: false, message: `Consent initiation failed: ${error.message}` };
    }
  }

  // ─── FAS helpers ───────────────────────────────────────────────────────────

  private get fasPath(): string {
    return `/switch10/${this.fasSubclass}/${this.fasRetry}/${this.institutionCode}`;
  }

  // ─── FAS: BVN Core Validation ──────────────────────────────────────────────

  /**
   * Extract full KYC data for a BVN using a retrievalToken from Consent Hub.
   */
  async fasValidateBvnCore(bvn: string, retrievalToken: string): Promise<{
    verified: boolean;
    data?: {
      firstName: string;
      middleName?: string;
      lastName: string;
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
  }> {
    try {
      const token = await this.getBivsToken();
      const body: FASBvnCoreRequest = { number: bvn, type: 'bvn', retrievalToken };

      logger.info('FAS BVN Core validation', { bvn: `***${bvn.slice(-4)}` });

      const res = await this.fasClient.post<FASCoreResponse[]>(
        this.fasPath,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const responses = Array.isArray(res.data) ? res.data : [res.data];
      const dataEntry = responses.find((r) => r.data) as FASCoreResponse | undefined;
      const msgEntry  = responses.find((r: any) => r.message) as any;

      if (!dataEntry?.data) {
        return { verified: false, message: msgEntry?.message || 'No data returned from FAS' };
      }

      const d = dataEntry.data as FASBvnCoreData;

      logger.info('FAS BVN Core validation succeeded', {
        firstName: d.first_name,
        lastName: d.surname,
      });

      return {
        verified: true,
        data: {
          firstName:          d.first_name        || '',
          middleName:         d.middle_name,
          lastName:           d.surname           || '',
          dateOfBirth:        d.DateOfBirth       || d.date_of_birth,
          gender:             d.gender,
          maritalStatus:      d.marital_status,
          nationality:        d.nationality,
          stateOfOrigin:      d.state_of_origin,
          lgaOfOrigin:        d.lga_of_origin,
          stateOfResidence:   d.state_of_residence,
          residentialAddress: d.residential_address,
          email:              d.email,
          phoneNumber:        d.Phone_number1     || d.phone_number2,
          enrollBankCode:     d.enroll_bank_code,
          watchlisted:        !!d.watchlisted,
          faceImage:          d.face_image,
        },
        message: msgEntry?.message || 'BVN validation successful',
      };
    } catch (error: any) {
      logger.error('FAS BVN Core validation error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `BVN validation failed: ${error.message}` };
    }
  }

  // ─── FAS: BVN Boolean Validation ───────────────────────────────────────────

  /**
   * Boolean match — check whether supplied fields match the BVN record.
   */
  async fasValidateBvnBoolean(bvn: string, fields: {
    firstname: string;
    lastname: string;
    middlename: string;
    phone_no: string;
    dob: string;
    gender: string;
  }): Promise<{
    success: boolean;
    matches?: FASBooleanData;
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();
      const body: FASBvnBooleanRequest = { number: bvn, type: 'bvn', ...fields };

      logger.info('FAS BVN Boolean validation', { bvn: `***${bvn.slice(-4)}` });

      const res = await this.fasClient.post<any[]>(
        this.fasPath,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const responses = Array.isArray(res.data) ? res.data : [res.data];
      const dataEntry = responses.find((r: any) => r.data);
      const msgEntry  = responses.find((r: any) => r.message) as any;

      return {
        success: !!dataEntry,
        matches: dataEntry?.data,
        message: msgEntry?.message || 'BVN boolean validation complete',
      };
    } catch (error: any) {
      logger.error('FAS BVN Boolean validation error', { error: error.message, data: error.response?.data });
      return { success: false, message: `BVN boolean validation failed: ${error.message}` };
    }
  }

  // ─── FAS: NIN ShareCode Validation ─────────────────────────────────────────

  /**
   * Validate a NIN ShareCode (from NINAUTH app) and extract KYC data.
   */
  async fasValidateNinSharecode(shareCode: string, requestReason: string): Promise<{
    verified: boolean;
    data?: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      dateOfBirth?: string;
      gender?: string;
      phoneNumber?: string;
      faceImage?: string;
    };
    message: string;
  }> {
    try {
      const token = await this.getConsentToken();
      const body: FASNinSharecodeRequest = { number: shareCode, type: 'ninauth_sharecode', requestReason };

      logger.info('FAS NIN ShareCode validation', { shareCode: `***${shareCode.slice(-3)}` });

      const res = await this.fasClient.post<any[]>(
        this.fasPath,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const responses = Array.isArray(res.data) ? res.data : [res.data];
      const dataEntry = responses.find((r: any) => r.data);
      const msgEntry  = responses.find((r: any) => r.message) as any;

      if (!dataEntry?.data) {
        return { verified: false, message: msgEntry?.message || 'No NIN data returned' };
      }

      const inner: FASNinCoreData = dataEntry.data?.data || dataEntry.data;
      const bio = inner.biographicData || {};
      const biometric = inner.biometricData?.[0];

      return {
        verified: true,
        data: {
          firstName:   bio.firstName,
          lastName:    bio.lastName,
          middleName:  bio.middleName,
          dateOfBirth: bio.dateOfBirth,
          gender:      bio.gender,
          phoneNumber: bio.phone1 || inner.contactData?.phone1,
          faceImage:   biometric?.image,
        },
        message: msgEntry?.message || 'NIN validation successful',
      };
    } catch (error: any) {
      logger.error('FAS NIN ShareCode validation error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `NIN validation failed: ${error.message}` };
    }
  }

  // ─── FAS: NIN InPerson Validation ──────────────────────────────────────────

  /**
   * Validate NIN in-person using 11-digit NIN and a base64 selfie image.
   */
  async fasValidateNinInPerson(nin: string, biometricBase64: string, requestReason: string): Promise<{
    verified: boolean;
    data?: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      dateOfBirth?: string;
      gender?: string;
      faceImage?: string;
    };
    message: string;
  }> {
    try {
      const token = await this.getConsentToken();
      const body: FASNinInPersonRequest = {
        number: nin,
        type: 'ninauth_inperson',
        requestReason,
        biometric: biometricBase64,
      };

      logger.info('FAS NIN InPerson validation', { nin: `***${nin.slice(-4)}` });

      const res = await this.fasClient.post<any[]>(
        this.fasPath,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const responses = Array.isArray(res.data) ? res.data : [res.data];
      const dataEntry = responses.find((r: any) => r.data);
      const msgEntry  = responses.find((r: any) => r.message) as any;

      if (!dataEntry?.data) {
        return { verified: false, message: msgEntry?.message || 'No NIN InPerson data returned' };
      }

      const inner = dataEntry.data?.data || dataEntry.data;
      const bio   = inner.biographicData || {};
      const biometric = inner.biometricData?.[0];

      return {
        verified: true,
        data: {
          firstName:   bio.firstName,
          lastName:    bio.lastName,
          middleName:  bio.middleName,
          dateOfBirth: bio.dateOfBirth,
          gender:      bio.gender,
          faceImage:   biometric?.image,
        },
        message: msgEntry?.message || 'NIN InPerson validation successful',
      };
    } catch (error: any) {
      logger.error('FAS NIN InPerson validation error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `NIN InPerson validation failed: ${error.message}` };
    }
  }

  // ─── FAS: Core & Optional (BVN + NIN comparison) ──────────────────────────

  /**
   * Compare a BVN record against a NIN ShareCode record.
   */
  async fasValidateCoreAndOptional(bvn: string, ninShareCode: string, requestReason: string): Promise<{
    success: boolean;
    comparison?: FASComparisonData;
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();
      const body: FASCoreOptionalRequest = {
        number: bvn,
        type: 'bvn',
        optionA: ninShareCode,
        optionB: 'ninauth_sharecode',
        requestReason,
      };

      logger.info('FAS Core & Optional validation', { bvn: `***${bvn.slice(-4)}` });

      const res = await this.fasClient.post<any[]>(
        this.fasPath,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const responses = Array.isArray(res.data) ? res.data : [res.data];
      const compEntry = responses.find((r: any) => r.comparisonResult);

      return {
        success:     !!compEntry,
        comparison:  compEntry?.comparisonResult,
        message:     compEntry ? 'Comparison complete' : 'No comparison data returned',
      };
    } catch (error: any) {
      logger.error('FAS Core & Optional validation error', { error: error.message, data: error.response?.data });
      return { success: false, message: `Core & Optional validation failed: ${error.message}` };
    }
  }

  // ─── TIN Verification (BIVS) ───────────────────────────────────────────────

  async verifyTin(request: TINVerificationRequest): Promise<{
    verified: boolean;
    data?: {
      tin: string;
      taxPayerName: string;
      taxOffice?: string;
      taxPayerType?: string;
      status?: string;
    };
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();
      logger.info('Verifying TIN', { tin: `***${request.TIN.slice(-4)}` });

      const res = await this.bivsClient.post<TINVerificationResponse>(
        '/api/v1/tin/verify',
        request,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.ResponseCode !== '00') {
        logger.warn('TIN verification failed', { responseCode: res.data.ResponseCode });
        return { verified: false, message: res.data.ResponseDescription || 'TIN verification failed' };
      }

      return {
        verified: true,
        data: {
          tin:          res.data.TIN || request.TIN,
          taxPayerName: res.data.TaxPayerName || '',
          taxOffice:    res.data.TaxOffice,
          taxPayerType: res.data.TaxPayerType,
          status:       res.data.Status,
        },
        message: 'TIN verified successfully',
      };
    } catch (error: any) {
      logger.error('TIN verification error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `TIN verification failed: ${error.message}` };
    }
  }

  // ─── Account Verification (BIVS) ───────────────────────────────────────────

  async verifyAccount(accountNumber: string, bankCode: string): Promise<{
    verified: boolean;
    accountName?: string;
    accountNumber?: string;
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();
      logger.info('Verifying account', { accountNumber: `***${accountNumber.slice(-4)}`, bankCode });

      const res = await this.bivsClient.post(
        '/api/v1/account/verify',
        { AccountNumber: accountNumber, BankCode: bankCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.ResponseCode !== '00') {
        return { verified: false, message: res.data.ResponseDescription || 'Account verification failed' };
      }

      return {
        verified:      true,
        accountName:   res.data.AccountName,
        accountNumber: res.data.AccountNumber || accountNumber,
        message:       'Account verified successfully',
      };
    } catch (error: any) {
      logger.error('Account verification error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `Account verification failed: ${error.message}` };
    }
  }

  // ─── Bank List (BIVS) ──────────────────────────────────────────────────────

  async getBankList(): Promise<Array<{ bankCode: string; bankName: string }>> {
    try {
      const token = await this.getBivsToken();
      logger.info('Fetching bank list');

      const res = await this.bivsClient.get('/api/v1/banks', {
        headers: { Authorization: `Bearer ${token}` },
      });

      return (res.data.Banks || []).map((b: any) => ({
        bankCode: b.BankCode || b.Code,
        bankName: b.BankName || b.Name,
      }));
    } catch (error: any) {
      logger.error('Bank list fetch failed', { error: error.message });
      throw new Error(`Bank list fetch failed: ${error.message}`);
    }
  }

  // ─── TIN Identity v2 — Individual ──────────────────────────────────────────

  async verifyIndividualTin(tin: string): Promise<{
    verified: boolean;
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
  }> {
    try {
      const token     = await this.getBivsToken();
      const signature = Buffer.from(this.bivsClientUsername).toString('base64');

      logger.info('Verifying Individual TIN via Identity v2', { tin: `***${tin.slice(-4)}` });

      const res = await this.identityClient.post<IndividualTINResponse>(
        '/verifyIndividualTin',
        { ValidationNumber: tin, Signature: signature } satisfies TINIdentityRequest,
        { headers: { Token: `Bearer ${token}` } }
      );

      const { status, data } = res.data;

      if (status !== '00' || !data?.taxpayer) {
        logger.warn('Individual TIN verification failed', { status, message: res.data.message });
        return { verified: false, message: res.data.message || 'Individual TIN verification failed' };
      }

      const tp = data.taxpayer;
      return {
        verified: true,
        data: {
          tin:                tp.tin || tin,
          firstName:          tp.first_name,
          middleName:         tp.middle_name,
          lastName:           tp.last_name,
          phoneNo:            tp.phone_no,
          email:              tp.email,
          dateOfBirth:        tp.date_of_birth,
          dateOfRegistration: tp.date_of_registration,
          taxAuthority:       tp.tax_authority,
          taxOffice:          tp.tax_office,
        },
        message: 'Individual TIN verified successfully',
      };
    } catch (error: any) {
      logger.error('Individual TIN verification error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `Individual TIN verification failed: ${error.message}` };
    }
  }

  // ─── TIN Identity v2 — Corporate ───────────────────────────────────────────

  async verifyCorporateTin(tin: string): Promise<{
    verified: boolean;
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
  }> {
    try {
      const token     = await this.getBivsToken();
      const signature = Buffer.from(this.bivsClientUsername).toString('base64');

      logger.info('Verifying Corporate TIN via Identity v2', { tin: `***${tin.slice(-4)}` });

      const res = await this.identityClient.post<CorporateTINResponse>(
        '/verifyCorporateTin',
        { ValidationNumber: tin, Signature: signature } satisfies TINIdentityRequest,
        { headers: { Token: `Bearer ${token}` } }
      );

      const { status, data } = res.data;

      if (status !== '00' || !data?.taxpayer) {
        logger.warn('Corporate TIN verification failed', { status, message: res.data.message });
        return { verified: false, message: res.data.message || 'Corporate TIN verification failed' };
      }

      const tp = data.taxpayer;
      return {
        verified: true,
        data: {
          tin:                  tp.tin || tin,
          registeredName:       tp.registered_name,
          registrationNumber:   tp.registration_number,
          phoneNo:              tp.phone_no,
          email:                tp.email,
          dateOfIncorporation:  tp.date_of_incorporation,
          dateOfRegistration:   tp.date_of_registration,
          taxAuthority:         tp.tax_authority,
          taxOffice:            tp.tax_office,
        },
        message: 'Corporate TIN verified successfully',
      };
    } catch (error: any) {
      logger.error('Corporate TIN verification error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `Corporate TIN verification failed: ${error.message}` };
    }
  }

  // ─── Token reset ───────────────────────────────────────────────────────────

  resetTokens() {
    logger.info('Resetting NIBSS tokens');
    this.bivsToken         = null;
    this.bivsTokenExpiry   = 0;
    this.consentToken      = null;
    this.consentTokenExpiry = 0;
  }
}

export const nibssClient = new NIBSSClient();
