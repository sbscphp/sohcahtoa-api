import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('QoreIDClient');

export interface QoreIDPassportData {
  id: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  birthdate?: string;
  gender?: string;
  expiry?: string;
  issued?: string;
  birthplace?: string;
  issuedAt?: string;
  photo?: string;
  email?: string;
  mobile?: string;
  nationality?: string;
}

export interface QoreIDPassportResponse {
  status: {
    state: string;   // e.g. "VERIFIED" | "NOT_FOUND" | "FAILED"
    status: string;  // e.g. "SUCCESS" | "NO_MATCH"
  };
  passport?: QoreIDPassportData;
}

class QoreIDClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly secret: string;
  private readonly http: AxiosInstance;

  // In-memory token cache
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.baseUrl = (process.env.QOREID_BASE_URL || 'https://api.qoreid.com').replace(/\/$/, '');
    this.clientId = process.env.QOREID_CLIENT_ID || '';
    this.secret = process.env.QOREID_SECRET || '';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.secret);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      logger.debug('Fetching new QoreID access token');
      const response = await this.http.post<{ accessToken: string; expiresIn: number }>(
        '/token',
        { clientId: this.clientId, secret: this.secret }
      );

      this.accessToken = response.data.accessToken;
      // Cache for (expiresIn - 60) seconds to avoid using an about-to-expire token
      this.tokenExpiry = Date.now() + (response.data.expiresIn - 60) * 1_000;
      logger.debug('QoreID access token obtained successfully', { expiresIn: response.data.expiresIn });
      return this.accessToken;
    } catch (error: any) {
      logger.error('QoreID token fetch failed', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify a Nigerian passport by number via the QoreID API.
   * firstname/lastname are required by QoreID's contract (used for identity match).
   */
  async verifyPassport(
    passportNumber: string,
    firstname: string,
    lastname: string
  ): Promise<QoreIDPassportResponse> {
    try {
      const token = await this.getAccessToken();

      const basePath = process.env.QOREID_PASSPORT_ENDPOINT || '/v1/ng/identities/passport';
      const endpoint = `${basePath}/${encodeURIComponent(passportNumber)}`;

      logger.info('Calling QoreID passport verification', { passportNumber, endpoint });

      const response = await this.http.post<QoreIDPassportResponse>(
        endpoint,
        { firstname, lastname },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logger.debug('QoreID passport response', { status: response.data.status });
      return response.data;
    } catch (error: any) {
      logger.error('QoreID passport verification failed', {
        passportNumber,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }
}

export const qoreIDClient = new QoreIDClient();
export default qoreIDClient;
