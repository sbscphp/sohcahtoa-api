import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('NIBSSClient');

interface NIBSSTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface BVNVerificationRequest {
  BVN: string;
  PhoneNumber?: string;
  DoB?: string; // Date of Birth in format YYYY-MM-DD
  FirstName?: string;
  LastName?: string;
}

interface BVNVerificationResponse {
  ResponseCode: string;
  ResponseDescription: string;
  BVN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  DateOfBirth?: string;
  PhoneNumber?: string;
  Email?: string;
  Gender?: string;
  StateOfOrigin?: string;
  LgaOfOrigin?: string;
  Nationality?: string;
  WatchListed?: string;
  RegistrationDate?: string;
  EnrollmentBank?: string;
  EnrollmentBranch?: string;
}

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

interface ConsentRequest {
  customerId: string;
  serviceType: string;
  duration: number; // in days
  purpose: string;
}

interface ConsentResponse {
  ResponseCode: string;
  ResponseDescription: string;
  ConsentId?: string;
  Status?: string;
  ExpiryDate?: string;
}

/**
 * NIBSS API Client
 * Handles integration with Nigeria Inter-Bank Settlement System for:
 * - BVN verification (BIVS)
 * - TIN verification
 * - Consent management
 * - Account verification
 * - Payment clearing and settlement
 *
 * Supports both BIVS and ConsentMgmt apps
 */
export class NIBSSClient {
  private bivsClient: AxiosInstance;
  private consentClient: AxiosInstance;

  private bivsClientId: string;
  private bivsClientSecret: string;
  private bivsBaseUrl: string;

  private consentClientId: string;
  private consentClientSecret: string;
  private consentBaseUrl: string;

  private bivsToken: string | null = null;
  private bivsTokenExpiry: number = 0;

  private consentToken: string | null = null;
  private consentTokenExpiry: number = 0;

  constructor() {
    // BIVS Configuration
    this.bivsClientId = process.env.NIBSS_BIVS_CLIENT_ID || '';
    this.bivsClientSecret = process.env.NIBSS_BIVS_CLIENT_SECRET || '';
    this.bivsBaseUrl = process.env.NIBSS_BIVS_BASE_URL || 'https://apitest.nibss-plc.com.ng:1443';

    // ConsentMgmt Configuration
    this.consentClientId = process.env.NIBSS_CONSENT_CLIENT_ID || '';
    this.consentClientSecret = process.env.NIBSS_CONSENT_CLIENT_SECRET || '';
    this.consentBaseUrl = process.env.NIBSS_CONSENT_BASE_URL || 'https://apitest.nibss-plc.com.ng:1443';

    // Initialize BIVS client
    this.bivsClient = axios.create({
      baseURL: this.bivsBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize ConsentMgmt client
    this.consentClient = axios.create({
      baseURL: this.consentBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors for both clients
   */
  private setupInterceptors() {
    // BIVS Interceptors
    this.bivsClient.interceptors.request.use(
      (config) => {
        logger.info('NIBSS BIVS API Request', {
          method: config.method,
          url: config.url,
          data: config.data ? '***REDACTED***' : undefined
        });
        return config;
      },
      (error) => {
        logger.error('NIBSS BIVS API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.bivsClient.interceptors.response.use(
      (response) => {
        logger.info('NIBSS BIVS API Response', {
          status: response.status,
          responseCode: response.data?.ResponseCode
        });
        return response;
      },
      (error) => {
        logger.error('NIBSS BIVS API Response Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );

    // ConsentMgmt Interceptors
    this.consentClient.interceptors.request.use(
      (config) => {
        logger.info('NIBSS Consent API Request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('NIBSS Consent API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.consentClient.interceptors.response.use(
      (response) => {
        logger.info('NIBSS Consent API Response', {
          status: response.status,
          responseCode: response.data?.ResponseCode
        });
        return response;
      },
      (error) => {
        logger.error('NIBSS Consent API Response Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get OAuth2 access token for BIVS
   */
  private async getBivsToken(): Promise<string> {
    // Check if token is still valid
    if (this.bivsToken && Date.now() < this.bivsTokenExpiry) {
      return this.bivsToken;
    }

    try {
      logger.info('Requesting new BIVS access token', {
        clientId: `***${this.bivsClientId.slice(-4)}`,
        baseUrl: this.bivsBaseUrl,
      });

      // Try method 1: OAuth2 with form data
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.bivsClientId);
        params.append('client_secret', this.bivsClientSecret);

        const response = await axios.post<NIBSSTokenResponse>(
          `${this.bivsBaseUrl}/oauth/token`,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        );

        this.bivsToken = response.data.access_token;
        this.bivsTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

        logger.info('BIVS access token obtained successfully (OAuth2)', {
          expiresIn: response.data.expires_in,
        });

        return this.bivsToken;
      } catch (oauthError: any) {
        logger.warn('OAuth2 token request failed, trying Basic Auth', {
          error: oauthError.message,
          status: oauthError.response?.status,
        });

        // Try method 2: Basic Authentication
        const basicAuth = Buffer.from(`${this.bivsClientId}:${this.bivsClientSecret}`).toString('base64');

        const response = await axios.post<NIBSSTokenResponse>(
          `${this.bivsBaseUrl}/token`,
          { grant_type: 'client_credentials' },
          {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        this.bivsToken = response.data.access_token;
        this.bivsTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

        logger.info('BIVS access token obtained successfully (Basic Auth)', {
          expiresIn: response.data.expires_in,
        });

        return this.bivsToken;
      }
    } catch (error: any) {
      logger.error('Failed to obtain BIVS access token', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      });
      throw new Error(`BIVS authentication failed: ${error.message}`);
    }
  }

  /**
   * Get OAuth2 access token for ConsentMgmt
   */
  private async getConsentToken(): Promise<string> {
    // Check if token is still valid
    if (this.consentToken && Date.now() < this.consentTokenExpiry) {
      return this.consentToken;
    }

    try {
      logger.info('Requesting new Consent access token', {
        clientId: `***${this.consentClientId.slice(-4)}`,
        baseUrl: this.consentBaseUrl,
      });

      // Try method 1: OAuth2 with form data
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.consentClientId);
        params.append('client_secret', this.consentClientSecret);

        const response = await axios.post<NIBSSTokenResponse>(
          `${this.consentBaseUrl}/oauth/token`,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        );

        this.consentToken = response.data.access_token;
        this.consentTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

        logger.info('Consent access token obtained successfully (OAuth2)', {
          expiresIn: response.data.expires_in,
        });

        return this.consentToken;
      } catch (oauthError: any) {
        logger.warn('OAuth2 token request failed, trying Basic Auth', {
          error: oauthError.message,
          status: oauthError.response?.status,
        });

        // Try method 2: Basic Authentication
        const basicAuth = Buffer.from(`${this.consentClientId}:${this.consentClientSecret}`).toString('base64');

        const response = await axios.post<NIBSSTokenResponse>(
          `${this.consentBaseUrl}/token`,
          { grant_type: 'client_credentials' },
          {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        this.consentToken = response.data.access_token;
        this.consentTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

        logger.info('Consent access token obtained successfully (Basic Auth)', {
          expiresIn: response.data.expires_in,
        });

        return this.consentToken;
      }
    } catch (error: any) {
      logger.error('Failed to obtain Consent access token', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      });
      throw new Error(`Consent authentication failed: ${error.message}`);
    }
  }

  /**
   * Verify BVN and get customer details using BIVS
   */
  async verifyBvn(request: BVNVerificationRequest): Promise<{
    verified: boolean;
    data?: {
      bvn: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      dateOfBirth: string;
      phoneNumber: string;
      email?: string;
      gender?: string;
      stateOfOrigin?: string;
      nationality?: string;
      watchListed: boolean;
      enrollmentBank?: string;
    };
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();

      logger.info('Verifying BVN', {
        bvn: `***${request.BVN.slice(-4)}`,
        hasPhoneNumber: !!request.PhoneNumber,
        hasDoB: !!request.DoB
      });

      const response = await this.bivsClient.post<BVNVerificationResponse>(
        '/api/v1/bvn/verify',
        request,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const isVerified = response.data.ResponseCode === '00';

      if (!isVerified) {
        logger.warn('BVN verification failed', {
          responseCode: response.data.ResponseCode,
          description: response.data.ResponseDescription,
        });

        return {
          verified: false,
          message: response.data.ResponseDescription || 'BVN verification failed',
        };
      }

      logger.info('BVN verified successfully', {
        bvn: `***${request.BVN.slice(-4)}`,
        firstName: response.data.FirstName,
        lastName: response.data.LastName,
      });

      return {
        verified: true,
        data: {
          bvn: response.data.BVN || request.BVN,
          firstName: response.data.FirstName || '',
          middleName: response.data.MiddleName || undefined,
          lastName: response.data.LastName || '',
          dateOfBirth: response.data.DateOfBirth || '',
          phoneNumber: response.data.PhoneNumber || '',
          email: response.data.Email || undefined,
          gender: response.data.Gender || undefined,
          stateOfOrigin: response.data.StateOfOrigin || undefined,
          nationality: response.data.Nationality || 'Nigerian',
          watchListed: response.data.WatchListed === 'YES' || response.data.WatchListed === 'TRUE',
          enrollmentBank: response.data.EnrollmentBank || undefined,
        },
        message: 'BVN verified successfully',
      };
    } catch (error: any) {
      logger.error('BVN verification error', {
        error: error.message,
        response: error.response?.data
      });

      return {
        verified: false,
        message: `BVN verification failed: ${error.response?.data?.ResponseDescription || error.message}`,
      };
    }
  }

  /**
   * Verify TIN (Tax Identification Number)
   */
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

      logger.info('Verifying TIN', {
        tin: `***${request.TIN.slice(-4)}`,
      });

      const response = await this.bivsClient.post<TINVerificationResponse>(
        '/api/v1/tin/verify',
        request,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const isVerified = response.data.ResponseCode === '00';

      if (!isVerified) {
        logger.warn('TIN verification failed', {
          responseCode: response.data.ResponseCode,
          description: response.data.ResponseDescription,
        });

        return {
          verified: false,
          message: response.data.ResponseDescription || 'TIN verification failed',
        };
      }

      logger.info('TIN verified successfully', {
        tin: `***${request.TIN.slice(-4)}`,
        taxPayerName: response.data.TaxPayerName,
      });

      return {
        verified: true,
        data: {
          tin: response.data.TIN || request.TIN,
          taxPayerName: response.data.TaxPayerName || '',
          taxOffice: response.data.TaxOffice || undefined,
          taxPayerType: response.data.TaxPayerType || undefined,
          status: response.data.Status || undefined,
        },
        message: 'TIN verified successfully',
      };
    } catch (error: any) {
      logger.error('TIN verification error', {
        error: error.message,
        response: error.response?.data
      });

      return {
        verified: false,
        message: `TIN verification failed: ${error.response?.data?.ResponseDescription || error.message}`,
      };
    }
  }

  /**
   * Request customer consent for data access
   */
  async requestConsent(request: ConsentRequest): Promise<{
    success: boolean;
    consentId?: string;
    expiryDate?: string;
    message: string;
  }> {
    try {
      const token = await this.getConsentToken();

      logger.info('Requesting customer consent', {
        customerId: request.customerId,
        serviceType: request.serviceType,
        duration: request.duration,
      });

      const response = await this.consentClient.post<ConsentResponse>(
        '/api/v1/consent/request',
        {
          CustomerId: request.customerId,
          ServiceType: request.serviceType,
          Duration: request.duration,
          Purpose: request.purpose,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const isSuccess = response.data.ResponseCode === '00';

      if (!isSuccess) {
        logger.warn('Consent request failed', {
          responseCode: response.data.ResponseCode,
          description: response.data.ResponseDescription,
        });

        return {
          success: false,
          message: response.data.ResponseDescription || 'Consent request failed',
        };
      }

      logger.info('Consent requested successfully', {
        consentId: response.data.ConsentId,
      });

      return {
        success: true,
        consentId: response.data.ConsentId,
        expiryDate: response.data.ExpiryDate,
        message: 'Consent requested successfully',
      };
    } catch (error: any) {
      logger.error('Consent request error', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        message: `Consent request failed: ${error.response?.data?.ResponseDescription || error.message}`,
      };
    }
  }

  /**
   * Verify bank account details
   */
  async verifyAccount(accountNumber: string, bankCode: string): Promise<{
    verified: boolean;
    accountName?: string;
    accountNumber?: string;
    message: string;
  }> {
    try {
      const token = await this.getBivsToken();

      logger.info('Verifying account', {
        accountNumber: `***${accountNumber.slice(-4)}`,
        bankCode,
      });

      const response = await this.bivsClient.post(
        '/api/v1/account/verify',
        {
          AccountNumber: accountNumber,
          BankCode: bankCode,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const isVerified = response.data.ResponseCode === '00';

      if (!isVerified) {
        logger.warn('Account verification failed', {
          responseCode: response.data.ResponseCode,
          description: response.data.ResponseDescription,
        });

        return {
          verified: false,
          message: response.data.ResponseDescription || 'Account verification failed',
        };
      }

      logger.info('Account verified successfully', {
        accountName: response.data.AccountName,
      });

      return {
        verified: true,
        accountName: response.data.AccountName,
        accountNumber: response.data.AccountNumber || accountNumber,
        message: 'Account verified successfully',
      };
    } catch (error: any) {
      logger.error('Account verification error', {
        error: error.message,
        response: error.response?.data
      });

      return {
        verified: false,
        message: `Account verification failed: ${error.response?.data?.ResponseDescription || error.message}`,
      };
    }
  }

  /**
   * Get list of banks
   */
  async getBankList(): Promise<Array<{
    bankCode: string;
    bankName: string;
  }>> {
    try {
      const token = await this.getBivsToken();

      logger.info('Fetching bank list');

      const response = await this.bivsClient.get('/api/v1/banks', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const banks = response.data.Banks || [];

      logger.info('Bank list fetched successfully', {
        count: banks.length,
      });

      return banks.map((bank: any) => ({
        bankCode: bank.BankCode || bank.Code,
        bankName: bank.BankName || bank.Name,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch bank list', {
        error: error.message,
        response: error.response?.data
      });
      throw new Error(`Bank list fetch failed: ${error.message}`);
    }
  }

  /**
   * Reset/clear authentication tokens (useful for testing or error recovery)
   */
  resetTokens() {
    logger.info('Resetting NIBSS tokens');
    this.bivsToken = null;
    this.bivsTokenExpiry = 0;
    this.consentToken = null;
    this.consentTokenExpiry = 0;
  }
}

export const nibssClient = new NIBSSClient();
