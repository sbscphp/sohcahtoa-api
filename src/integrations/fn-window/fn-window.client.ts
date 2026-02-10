import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('FNWindowClient');

/**
 * CBN FN Window API Client
 * Handles integration with CBN Foreign Exchange Window for:
 * - Real-time FX rate feeds
 * - Settlement instructions
 * - NFEM market data
 */
export class FNWindowClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.FN_WINDOW_API_KEY || '';
    this.baseUrl = process.env.FN_WINDOW_API_BASE_URL || 'https://nfem.cbn.gov.ng/api/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });
  }

  /**
   * Get current FX rates from NFEM window
   */
  async getCurrentRates(): Promise<Array<{
    currencyPair: string;
    bidRate: number;
    askRate: number;
    timestamp: string;
  }>> {
    try {
      const response = await this.client.get('/rates/current');
      return response.data.rates || [];
    } catch (error: any) {
      logger.error('Failed to fetch FN Window rates', { error: error.message });
      throw new Error(`FN Window rates fetch failed: ${error.message}`);
    }
  }

  /**
   * Get specific currency pair rate
   */
  async getCurrencyRate(baseCurrency: string, quoteCurrency: string): Promise<{
    currencyPair: string;
    bidRate: number;
    askRate: number;
    midRate: number;
    timestamp: string;
  }> {
    try {
      const response = await this.client.get(`/rates/${baseCurrency}/${quoteCurrency}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to fetch currency rate', { baseCurrency, quoteCurrency });
      throw new Error(`Currency rate fetch failed: ${error.message}`);
    }
  }

  /**
   * Submit settlement instruction
   */
  async submitSettlement(data: {
    transactionReference: string;
    amount: number;
    currency: string;
    nairaEquivalent: number;
    exchangeRate: number;
    beneficiaryDetails: any;
  }): Promise<{
    success: boolean;
    settlementReference: string;
  }> {
    try {
      const response = await this.client.post('/settlement/submit', data);
      return {
        success: true,
        settlementReference: response.data.settlementReference,
      };
    } catch (error: any) {
      logger.error('Settlement submission failed', { error: error.message });
      throw new Error(`Settlement submission failed: ${error.message}`);
    }
  }
}

export const fnWindowClient = new FNWindowClient();
