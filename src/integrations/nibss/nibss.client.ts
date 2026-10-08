import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('NIBSSClient');

// ─── Token ───────────────────────────────────────────────────────────────────

interface NIBSSTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ─── FAS (Financial Authentication Service) ──────────────────────────────────

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
  dataOwnerID: string; // actual BVN/NIN identifier, never the redacted form
  requestType: string; // e.g. "YYYY"
  consentType: 'RedirectLink' | 'OfflineConsent';
  dataSubjectPresent: boolean;
  authenticationDate: string; // YYYY-MM-DD
  callbackUrl?: string; // where NIBSS redirects after user authenticates (RedirectLink)
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

  // ── FAS-specific credentials (optional; falls back to consent credentials) ──
  private fasClientId: string;
  private fasClientSecret: string;
  private fasResetUrl: string;

  // ── FAS path params ──
  private fasBaseUrl: string;
  private fasSubclass: string;
  private fasRetry: string;
  private institutionCode: string;

  // ── Consent Hub (legacy) ──
  private consentHubBaseUrl: string;
  private dataControllerId: string;
  private callbackUrl: string;

  // ── iGree (BVN Consent v1) — consent phase (Step 1 authorize + callback token exchange) ──
  private iGreeBaseUrl: string = '';
  private iGreeClient!: AxiosInstance;
  private iGreeClientId: string = '';
  private iGreeClientSecret: string = '';
  private iGreeRedirectUri: string = '';
  private idpBaseUrl: string = '';

  // ── iGree — retrieval phase (Step 4 data fetch): a SEPARATE NIBSS app registration,
  //    with its own client_credentials token, distinct from the consent-phase token above.
  private iGreeConsumerCustomId: string = '';
  private iGreeChannelCode: string = '02';
  private iGreeRetrievalClientId: string = '';
  private iGreeRetrievalClientSecret: string = '';
  private iGreeRetrievalResetUrl: string = '';
  private iGreeRetrievalToken: string | null = null;
  private iGreeRetrievalTokenExpiry: number = 0;
  private lastExchangedToken: string | null = null;
  private lastIdToken: string | null = null;

  // ── Token cache ──
  private bivsToken: string | null = null;
  private bivsTokenExpiry: number = 0;
  private consentToken: string | null = null;
  private consentTokenExpiry: number = 0;
  private fasToken: string | null = null;
  private fasTokenExpiry: number = 0;

  constructor() {
    // Helper to sanitize base URLs (strip trailing slashes and port :1443 if present)
    const cleanUrl = (url: string) => url.replace(/\/+$/, '').replace(':1443', '');

    // BIVS
    this.bivsClientId        = process.env.NIBSS_BIVS_CLIENT_ID       || process.env.NIBSS_CLIENT_ID || '';
    this.bivsClientSecret    = process.env.NIBSS_BIVS_CLIENT_SECRET   || process.env.NIBSS_CLIENT_SECRET || '';
    this.bivsBaseUrl         = cleanUrl(process.env.NIBSS_BIVS_BASE_URL || process.env.NIBSS_BIVS_BASEURL || 'https://apitest.nibss-plc.com.ng');
    this.bivsResetUrl        = process.env.NIBSS_BIVS_RESET_URL       || process.env.NIBSS_BIVS_RESETURL || `${this.bivsBaseUrl}/reset`;
    this.bivsClientUsername  = process.env.NIBSS_BIVS_CLIENT_USERNAME || '';
    this.tinIdentityBaseUrl  = cleanUrl(process.env.NIBSS_TIN_BASE_URL || process.env.NIBSS_TIN_BASEURL || 'https://apitest.nibss-plc.com.ng/identity/v2');

    // Consent Hub / FAS (same credentials)
    this.consentClientId     = process.env.NIBSS_CONSENT_CLIENT_ID     || process.env.NIBSS_CLIENT_ID || '';
    this.consentClientSecret = process.env.NIBSS_CONSENT_CLIENT_SECRET || process.env.NIBSS_CLIENT_SECRET || '';
    this.consentResetUrl     = process.env.NIBSS_CONSENT_RESET_URL     || process.env.NIBSS_CONSENT_RESETURL || 'https://apitest.nibss-plc.com.ng/reset';

    // FAS-specific credentials — fall back to consent credentials if not set
    this.fasClientId     = process.env.NIBSS_FAS_CLIENT_ID     || this.consentClientId;
    this.fasClientSecret = process.env.NIBSS_FAS_CLIENT_SECRET || this.consentClientSecret;
    this.fasResetUrl     = process.env.NIBSS_FAS_RESET_URL     || process.env.NIBSS_FAS_RESETURL || this.consentResetUrl;

    // FAS
    this.fasBaseUrl      = cleanUrl(process.env.NIBSS_FAS_BASE_URL || process.env.NIBSS_FAS_BASEURL || 'https://apitest.nibss-plc.com.ng/cvs/v2');
    this.fasSubclass     = process.env.NIBSS_FAS_SUBCLASS  || '1';
    this.fasRetry        = process.env.NIBSS_FAS_RETRY     || '1';
    this.institutionCode = process.env.NIBSS_INSTITUTION_CODE || '123456';

    // Consent Hub (legacy)
    this.consentHubBaseUrl = cleanUrl(process.env.NIBSS_CONSENT_HUB_BASE_URL || process.env.NIBSS_CONSENT_HUB_BASEURL || 'https://apitest.nibss-plc.com.ng/api');
    this.dataControllerId  = process.env.NIBSS_DATA_CONTROLLER_ID   || 'd6378b2e-092f-485a-a1f9-f97b3ca8c3f3';
    this.callbackUrl       = process.env.NIBSS_CALLBACK_URL         || process.env.NIBSS_REDIRECT_URI || '';

    // iGree — consent phase (Step 1 authorize + callback token exchange)
    this.iGreeBaseUrl           = cleanUrl(process.env.NIBSS_IGREE_BASE_URL || process.env.NIBSS_API_BASE_URL || process.env.NIBSS_API_BASEURL || 'https://apitest.nibss-plc.com.ng/bvnconsent/v1');
    this.idpBaseUrl             = cleanUrl(process.env.NIBSS_IDP_BASE_URL || process.env.NIBSS_IDP_BASEURL || 'https://idsandbox.nibss-plc.com.ng');
    this.iGreeClientId          = process.env.NIBSS_IGREE_CLIENT_ID || process.env.NIBSS_IDP_CLIENT_ID || process.env.NIBSS_API_CLIENT_ID || process.env.NIBSS_CLIENT_ID || '';
    this.iGreeClientSecret      = process.env.NIBSS_IGREE_CLIENT_SECRET || process.env.NIBSS_IDP_CLIENT_SECRET || process.env.NIBSS_API_CLIENT_SECRET || process.env.NIBSS_CLIENT_SECRET || '';
    this.iGreeRedirectUri       = process.env.NIBSS_IGREE_REDIRECT_URI || process.env.NIBSS_REDIRECT_URI || '';

    // iGree — retrieval phase (Step 4 data fetch): NIBSS_IGREE_RETRIEVAL_CLIENT_ID/SECRET are for
    // a distinct app registration IF NIBSS has issued one; falls back to the consent-phase
    // credentials otherwise, since in practice the sandbox tenant only provisions one iGree app
    // (confirmed: the consent client_id/secret authenticate fine against the retrieval endpoints,
    // while a separately-issued "retrieval" id/secret pair was rejected with invalid_client).
    this.iGreeRetrievalClientId     = process.env.NIBSS_IGREE_RETRIEVAL_CLIENT_ID     || process.env.NIBSS_API_CLIENT_ID || this.iGreeClientId;
    this.iGreeRetrievalClientSecret = process.env.NIBSS_IGREE_RETRIEVAL_CLIENT_SECRET || process.env.NIBSS_API_CLIENT_SECRET || this.iGreeClientSecret;
    this.iGreeRetrievalResetUrl     = process.env.NIBSS_IGREE_RETRIEVAL_RESET_URL     || `${this.idpBaseUrl}/oxauth/restv1/token`;
    this.iGreeConsumerCustomId      = process.env.NIBSS_IGREE_CONSUMER_CUSTOM_ID      || this.iGreeRetrievalClientId;
    this.iGreeChannelCode           = process.env.NIBSS_IGREE_CHANNEL_CODE || process.env.NIBSS_CHANNEL_CODE || '02';

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

    this.iGreeClient = axios.create({
      baseURL: this.iGreeBaseUrl,
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
            wwwAuthenticate: error.response?.headers?.['www-authenticate'],
            responseHeaders: error.response?.status === 401 ? error.response?.headers : undefined,
          });
          return Promise.reject(error);
        }
      );
    };

    attach(this.bivsClient,       'BIVS');
    attach(this.fasClient,        'FAS');
    attach(this.consentHubClient, 'ConsentHub');
    attach(this.identityClient,   'TINIdentity');
    attach(this.iGreeClient,      'iGree');
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

  /**
   * Obtain a token for FAS (Credit Verification Service).
   * Uses NIBSS_FAS_CLIENT_ID/SECRET/RESET_URL if set; falls back to consent credentials.
   * Having separate env vars allows NIBSS to provide FAS-specific credentials without code changes.
   */
  private async getFasToken(): Promise<string> {
    if (this.fasToken && Date.now() < this.fasTokenExpiry) return this.fasToken;

    const usingFasSpecific = !!(process.env.NIBSS_FAS_CLIENT_ID);
    logger.info('Requesting FAS access token', { usingFasSpecificCredentials: usingFasSpecific });

    const params = new URLSearchParams();
    params.append('client_id',     this.fasClientId);
    params.append('client_secret', this.fasClientSecret);
    params.append('scope',         `${this.fasClientId}/.default`);
    params.append('grant_type',    'client_credentials');

    try {
      const res = await axios.post<NIBSSTokenResponse>(this.fasResetUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      this.fasToken       = res.data.access_token;
      this.fasTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
      logger.info('FAS token obtained', { expiresIn: res.data.expires_in });
      return this.fasToken;
    } catch (error: any) {
      logger.error('Failed to obtain FAS token', { error: error.message, data: error.response?.data });
      throw new Error(`FAS authentication failed: ${error.message}`);
    }
  }

  // ─── Consent Hub ───────────────────────────────────────────────────────────

  /**
   * Initiate a consent request via NIBSS Consent Hub.
   * Returns a consentUrl to redirect the user to for authentication.
   * After the user authenticates, NIBSS will POST a retrievalToken to your callback URL.
   *
   * @param dataOwnerId  Identifier for the data subject or customer whose data is being accessed. This can be the user's BVN, NIN Sharecode, or any identification number.
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

      // Use the real BVN/NIN value for the request payload; logging is intentionally masked.
      const requestBody: ConsentInitiateRequest = {
        dataControllerId:   this.dataControllerId,
        dataProcessorId:    this.consentClientId,
        dataOwnerID:        dataOwnerId,
        requestType,
        consentType:        'RedirectLink',
        dataSubjectPresent,
        authenticationDate: today,
        ...(this.callbackUrl && { callbackUrl: this.callbackUrl }),
      };

      logger.info('Initiating Consent Hub request', {
        dataOwnerId: `***${dataOwnerId.slice(-4)}`,
        requestType,
        dataSubjectPresent,
        dataProcessorId: this.consentClientId,
      });

      const res = await this.consentHubClient.post<ConsentInitiateResponse>(
        '/consent/initiate',
        requestBody,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // responseCode "00" = full success
      // responseCode "25" = no contact info on record — non-fatal for OfflineConsent since
      //                     we capture consent ourselves; NIBSS still creates the session
      const sessionCreated = !!res.data.sessionId;
      const isSuccess = res.data.responseCode === '00' || (res.data.responseCode === '25' && sessionCreated);

      if (!isSuccess) {
        logger.warn('Consent Hub initiation failed', {
          responseCode: res.data.responseCode,
          message: res.data.responseMessage,
        });
        return { success: false, message: res.data.responseMessage || 'Consent initiation failed' };
      }

      if (res.data.responseCode === '25') {
        logger.info('Consent Hub: no contact info on record — proceeding with session', {
          sessionId: res.data.sessionId,
        });
      }

      logger.info('Consent Hub session created', { sessionId: res.data.sessionId });

      return {
        success:    true,
        sessionId:  res.data.sessionId,
        consentUrl: res.data.data?.consentUrl,
        message:    res.data.responseMessage || 'Consent session created',
      };
    } catch (error: any) {
      // NIBSS returns HTTP 400 for responseCode "25" (no contact info on record).
      // For OfflineConsent this is non-fatal — we handle contact ourselves.
      // If a sessionId is present in the error body, treat it as a successful session creation.
      const errorData = error.response?.data as ConsentInitiateResponse | undefined;
      if (errorData?.responseCode === '25' && errorData?.sessionId) {
        logger.info('Consent Hub: no contact info (code 25) — proceeding with session', {
          sessionId: errorData.sessionId,
        });
        return {
          success:    true,
          sessionId:  errorData.sessionId,
          consentUrl: errorData.data?.consentUrl,
          message:    errorData.responseMessage || 'Consent session created',
        };
      }

      logger.error('Consent Hub initiation error', { error: error.message, data: errorData });
      return { success: false, message: `Consent initiation failed: ${error.message}` };
    }
  }

  // ─── FAS helpers ───────────────────────────────────────────────────────────

  private get fasPath(): string {
    const instCode = this.institutionCode || '123456';
    return `/switch10/${this.fasSubclass}/${this.fasRetry}/${instCode}`;
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
      const token = await this.getFasToken();
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
      const token = await this.getFasToken();
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
      const token = await this.getFasToken();
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
      let token: string;
      try {
        token = await this.getFasToken();
      } catch {
        token = await this.getBivsToken();
      }

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

  // ─── iGree: BVN Consent v1 ─────────────────────────────────────────────────

  /**
   * Obtain a token for the iGree RETRIEVAL phase (Step 4 data fetch) — a separate
   * NIBSS app registration from the consent phase, with its own client_credentials grant.
   * Goes through the same oxAuth IdP (idpBaseUrl) as the consent-phase code exchange —
   * NOT the Azure AD-backed /reset endpoint used by BIVS/Consent Hub/FAS.
   * Falls back to client_secret_post if the IdP rejects HTTP Basic Auth.
   */
  async getIGreeRetrievalToken(): Promise<string> {
    if (this.iGreeRetrievalToken && Date.now() < this.iGreeRetrievalTokenExpiry) return this.iGreeRetrievalToken;

    logger.info('Requesting iGree retrieval access token');
    const scope = process.env.NIBSS_IGREE_RETRIEVAL_SCOPE;
    const baseParams: Record<string, string> = { grant_type: 'client_credentials' };
    if (scope) baseParams.scope = scope;

    let tokenData: NIBSSTokenResponse;
    try {
      const params = new URLSearchParams(baseParams);
      const credentials = Buffer.from(`${this.iGreeRetrievalClientId}:${this.iGreeRetrievalClientSecret}`).toString('base64');

      const res = await axios.post<NIBSSTokenResponse>(this.iGreeRetrievalResetUrl, params, {
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 10000,
      });
      tokenData = res.data;
    } catch (error: any) {
      const status = error.response?.status;
      if (status !== 400 && status !== 401) {
        logger.error('Failed to obtain iGree retrieval token', { error: error.message, data: error.response?.data });
        throw new Error(`iGree retrieval authentication failed: ${error.message}`);
      }

      logger.warn('iGree retrieval: Basic Auth token request rejected, retrying with client_secret_post', { status });

      try {
        const params = new URLSearchParams({
          ...baseParams,
          client_id:     this.iGreeRetrievalClientId,
          client_secret: this.iGreeRetrievalClientSecret,
        });

        const retryRes = await axios.post<NIBSSTokenResponse>(this.iGreeRetrievalResetUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        });
        tokenData = retryRes.data;
      } catch (retryError: any) {
        logger.error('Failed to obtain iGree retrieval token', { error: retryError.message, data: retryError.response?.data });
        throw new Error(`iGree retrieval authentication failed: ${retryError.message}`);
      }
    }

    this.iGreeRetrievalToken       = tokenData.access_token;
    this.iGreeRetrievalTokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
    logger.info('iGree retrieval token obtained', { expiresIn: tokenData.expires_in });
    return this.iGreeRetrievalToken;
  }

  /**
   * Build the IdP authorization URL to redirect the user to for BVN consent.
   * After the user authenticates, NIBSS redirects to iGreeRedirectUri with ?code=...&state=...
   *
   * @param state  A unique session identifier to correlate the callback
   */
  iGreeGetAuthUrl(state: string): string {
    const params = new URLSearchParams({
      scope:         'openid bvn profile address',
      acr_values:    'otp',
      response_type: 'code',
      redirect_uri:  this.iGreeRedirectUri,
      client_id:     this.iGreeClientId,
      state,
      nonce:         state,
    });
    return `${this.idpBaseUrl}/oxauth/restv1/authorize?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for an access token via the iGree IdP. This only proves
   * the customer completed OTP consent on NIBSS's portal — it does NOT resolve which bvn they
   * consented for. NIBSS's oxAuth server doesn't release the "bvn" scope's claim to this client
   * registration (confirmed: absent from the id_token, and UserInfo rejects it with
   * insufficient_scope), so callers must get the bvn from elsewhere (the customer's own
   * self-reported input) rather than from this exchange.
   * Falls back to client_secret_post (credentials in the body) if the IdP
   * rejects HTTP Basic Auth — some NIBSS environments expect this instead.
   */
  async iGreeExchangeCode(code: string): Promise<{ accessToken: string; idToken?: string; expiresIn: number }> {
    const tokenUrl = `${this.idpBaseUrl}/oxauth/restv1/token`;
    const baseParams = {
      code,
      redirect_uri: this.iGreeRedirectUri,
      grant_type:   'authorization_code',
    };

    let tokenData: NIBSSTokenResponse;
    try {
      const params = new URLSearchParams(baseParams);
      const credentials = Buffer.from(`${this.iGreeClientId}:${this.iGreeClientSecret}`).toString('base64');

      const res = await axios.post<NIBSSTokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 15000,
      });
      tokenData = res.data;
    } catch (error: any) {
      const status = error.response?.status;
      if (status !== 400 && status !== 401) throw error;

      logger.warn('iGree: Basic Auth token exchange rejected, retrying with client_secret_post', { status });

      const params = new URLSearchParams({
        ...baseParams,
        client_id:     this.iGreeClientId,
        client_secret: this.iGreeClientSecret,
      });

      const retryRes = await axios.post<NIBSSTokenResponse>(tokenUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });
      tokenData = retryRes.data;
    }

    // Cache the exchanged user consent token for subsequent BVN details retrieval calls
    this.lastExchangedToken = tokenData.access_token;
    this.lastIdToken        = tokenData.id_token || null;

    return {
      accessToken: tokenData.access_token,
      idToken:     tokenData.id_token,
      expiresIn:   tokenData.expires_in,
    };
  }

  /**
   * Retrieve BVN partial details for the iGree retrieval phase.
   * Calls POST /getPartialDetailsWithBvn (or fallback endpoint candidates) at the iGree base URL.
   * Supports passing the user's consent token (from iGreeExchangeCode), or falls back to
   * cached exchange tokens and retrieval credentials.
   *
   * @param bvn  The 11-digit BVN to look up
   * @param originatorId  Unique originator/session ID (or userConsentToken if passed here)
   * @param userConsentToken  Optional user consent access token or id_token from iGreeExchangeCode
   */
  async iGreeGetBvnDetails(
    bvn?: string,
    originatorId?: string,
    userConsentToken?: string
  ): Promise<{
    verified: boolean;
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
      nin?: string;
      watchlisted?: boolean;
      faceImage?: string;
    };
    message: string;
  }> {
    try {
      // Detect if originatorId was passed as a JWT token directly
      let explicitToken = userConsentToken;
      let effectiveOriginatorId = originatorId;

      if (!explicitToken && originatorId && (originatorId.startsWith('eyJ') || originatorId.length > 50)) {
        explicitToken = originatorId;
        effectiveOriginatorId = undefined;
      }

      // Collect token candidates: User Consent Token (highest priority) -> Cached Tokens -> Machine Token
      const tokenCandidates: string[] = [];
      if (explicitToken) tokenCandidates.push(explicitToken);
      if (this.lastIdToken && !tokenCandidates.includes(this.lastIdToken)) {
        tokenCandidates.push(this.lastIdToken);
      }
      if (this.lastExchangedToken && !tokenCandidates.includes(this.lastExchangedToken)) {
        tokenCandidates.push(this.lastExchangedToken);
      }

      try {
        const retToken = await this.getIGreeRetrievalToken();
        if (retToken && !tokenCandidates.includes(retToken)) {
          tokenCandidates.push(retToken);
        }
      } catch (tokenErr: any) {
        logger.warn('Could not fetch iGree retrieval client token; relying on consent tokens', {
          error: tokenErr.message,
        });
      }

      if (tokenCandidates.length === 0) {
        return {
          verified: false,
          message: 'No active NIBSS token found. Please complete iGree consent code exchange first.',
        };
      }

      const consumerUniqueId = `${this.iGreeChannelCode}${effectiveOriginatorId || this.iGreeConsumerCustomId || '01'}`;

      // Candidate endpoint paths on NIBSS iGree API Gateway
      const candidatePaths = [
        '/getPartialDetailsWithBvn',
        '/getSingleDetailsWithBvn',
        '/getDetailsWithBvn',
      ];

      // Candidate client identification configurations
      const candidateCreds = [
        { clientId: this.iGreeConsumerCustomId, secret: '' },
        { clientId: this.iGreeClientId, secret: '' },
        { clientId: this.iGreeRetrievalClientId, secret: this.iGreeRetrievalClientSecret },
        ...(this.bivsClientId ? [{ clientId: this.bivsClientId, secret: this.bivsClientSecret }] : []),
        { clientId: this.institutionCode || '123456', secret: '' },
      ].filter((c, idx, arr) => c.clientId && arr.findIndex(x => x.clientId === c.clientId && x.secret === c.secret) === idx);

      logger.info('iGree: fetching BVN details across candidates');

      let record: any = null;
      let lastError: any = null;

      outerLoop: for (const token of tokenCandidates) {
        for (const cred of candidateCreds) {
          for (const targetPath of candidatePaths) {
            try {
              const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                'x-consumer-unique-id': consumerUniqueId,
                'x-consumer-custom-id': cred.clientId,
                client_id: cred.clientId,
                OrganisationCode: this.institutionCode || '123456',
                'Content-Type': 'application/json',
                Accept: 'application/json',
              };

              if (cred.secret) {
                headers['Ocp-Apim-Subscription-Key'] = cred.secret;
                headers['apiKey'] = cred.secret;
              }

              const res = await this.iGreeClient.post<any>(
                targetPath,
                bvn ? { bvn } : {},
                { headers, timeout: 10000 }
              );

              const respData = res.data;
              if (Array.isArray(respData) && respData.length > 0) {
                record = respData[0];
                break outerLoop;
              } else if (
                respData &&
                typeof respData === 'object' &&
                (respData.first_name || respData.FirstName || respData.surname || respData.Surname || respData.bvn || respData.nin || Object.keys(respData).length > 0)
              ) {
                record = respData;
                break outerLoop;
              }
            } catch (err: any) {
              lastError = err;
              const status = err.response?.status;
              const errDetail = err.response?.data?.message || err.response?.data || err.message;
              logger.warn(`iGree fetch at ${targetPath} (client: ${cred.clientId}) failed (status ${status}):`, errDetail);
            }
          }
        }
      }

      if (!record) {
        const errorDetail =
          lastError?.response?.data?.error_description ||
          lastError?.response?.data?.message ||
          lastError?.response?.data ||
          lastError?.message ||
          'No BVN data returned from iGree';
        return {
          verified: false,
          message: `iGree BVN fetch failed: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}`,
        };
      }

      logger.info('iGree: BVN details retrieved successfully', {
        firstName:     record.first_name || record.FirstName,
        lastName:      record.surname || record.Surname || record.lastName || record.LastName,
        middleName:    record.middle_name || record.MiddleName || record.middleName,
        gender:        record.gender || record.Gender,
        maritalStatus: record.marital_status || record.MaritalStatus || record.maritalStatus,
        nationality:   record.nationality || record.Nationality,
        stateOfOrigin: record.state_of_origin || record.StateOfOrigin || record.stateOfOrigin,
        lgaOfOrigin:   record.lga_of_origin || record.LgaOfOrigin || record.lgaOfOrigin,
        nin:           (() => { const n = record.nin || record.NIN || record.Nin; return n ? `***${String(n).slice(-4)}` : undefined; })(),
      });

      return {
        verified: true,
        data: {
          firstName:     record.first_name     || record.FirstName     || '',
          lastName:      record.surname        || record.Surname       || record.lastName || record.LastName || '',
          middleName:    record.middle_name    || record.MiddleName    || record.middleName,
          dateOfBirth:   record.date_of_birth  || record.DateOfBirth   || record.dateOfBirth,
          gender:        record.gender         || record.Gender,
          maritalStatus: record.marital_status || record.MaritalStatus || record.maritalStatus,
          nationality:   record.nationality    || record.Nationality,
          stateOfOrigin: record.state_of_origin|| record.StateOfOrigin || record.stateOfOrigin,
          lgaOfOrigin:   record.lga_of_origin  || record.LgaOfOrigin   || record.lgaOfOrigin,
          nin:           record.nin            || record.NIN           || record.Nin,
          watchlisted:   !!(record.watchlisted || record.Watchlisted) && record.watchlisted !== '0' && record.Watchlisted !== '0',
          faceImage:     record.face_image     || record.FaceImage     || record.image || record.Image,
        },
        message: 'BVN details retrieved successfully',
      };
    } catch (error: any) {
      logger.error('iGree: BVN details fetch error', { error: error.message, data: error.response?.data });
      return { verified: false, message: `iGree BVN fetch failed: ${error.message}` };
    }
  }

  // ─── Token reset ───────────────────────────────────────────────────────────

  resetTokens() {
    logger.info('Resetting NIBSS tokens');
    this.bivsToken          = null;
    this.bivsTokenExpiry    = 0;
    this.consentToken       = null;
    this.consentTokenExpiry = 0;
    this.fasToken           = null;
    this.fasTokenExpiry     = 0;
    this.iGreeRetrievalToken = null;
    this.iGreeRetrievalTokenExpiry = 0;
    this.lastExchangedToken = null;
    this.lastIdToken        = null;
  }
}

export const nibssClient = new NIBSSClient();
