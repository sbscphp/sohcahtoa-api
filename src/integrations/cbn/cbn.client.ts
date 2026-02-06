import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('CBNClient');

/**
 * CBN API Client
 * Handles integration with Central Bank of Nigeria APIs for:
 * - BDC license validation
 * - Regulatory compliance checks
 * - FX rate feeds
 */
export class CBNClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CBN_API_KEY || '';
    this.baseUrl = process.env.CBN_API_BASE_URL || 'https://api.cbn.gov.ng/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('CBN API Request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('CBN API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('CBN API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('CBN API Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate BDC license with CBN
   */
  async validateBdcLicense(licenseNumber: string): Promise<{
    valid: boolean;
    status: string;
    expiryDate?: string;
    details?: any;
  }> {
    try {
      const response = await this.client.get(`/bdc/license/${licenseNumber}`);
      return {
        valid: response.data.status === 'ACTIVE',
        status: response.data.status,
        expiryDate: response.data.expiryDate,
        details: response.data,
      };
    } catch (error: any) {
      logger.error('Failed to validate BDC license', { licenseNumber, error: error.message });
      throw new Error(`BDC license validation failed: ${error.message}`);
    }
  }

  /**
   * Get PEP/Sanctions watchlist
   */
  async getWatchList(): Promise<any[]> {
    try {
      const response = await this.client.get('/compliance/watchlist');
      return response.data.records || [];
    } catch (error: any) {
      logger.error('Failed to fetch watchlist', { error: error.message });
      throw new Error(`Watchlist fetch failed: ${error.message}`);
    }
  }

  /**
   * Screen individual against PEP/Sanctions list
   */
  async screenIndividual(data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    bvn?: string;
  }): Promise<{
    matched: boolean;
    matches: any[];
    riskScore: number;
  }> {
    try {
      const response = await this.client.post('/compliance/screen', data);
      return {
        matched: response.data.matched || false,
        matches: response.data.matches || [],
        riskScore: response.data.riskScore || 0,
      };
    } catch (error: any) {
      logger.error('Failed to screen individual', { error: error.message });
      throw new Error(`Individual screening failed: ${error.message}`);
    }
  }

  /**
   * Get current FX rates from CBN
   */
  async getFxRates(currencyPair?: string): Promise<any[]> {
    try {
      const endpoint = currencyPair
        ? `/fx/rates/${currencyPair}`
        : '/fx/rates';
      const response = await this.client.get(endpoint);
      return response.data.rates || [];
    } catch (error: any) {
      logger.error('Failed to fetch FX rates', { error: error.message });
      throw new Error(`FX rates fetch failed: ${error.message}`);
    }
  }

  /**
   * Submit regulatory report to CBN
   */
  async submitReport(reportType: string, data: any): Promise<{
    success: boolean;
    referenceNumber: string;
  }> {
    try {
      const response = await this.client.post('/reports/submit', {
        reportType,
        data,
        submittedAt: new Date().toISOString(),
      });
      return {
        success: true,
        referenceNumber: response.data.referenceNumber,
      };
    } catch (error: any) {
      logger.error('Failed to submit report to CBN', { reportType, error: error.message });
      throw new Error(`Report submission failed: ${error.message}`);
    }
  }
}

export const cbnClient = new CBNClient();
