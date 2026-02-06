import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('TRMSClient');

/**
 * TRMS (Trade Monitoring System) API Client
 * Handles submission of Form A, Form M, and Form B to CBN TRMS Portal
 */
export class TRMSClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TRMS_API_KEY || '';
    this.baseUrl = process.env.TRMS_API_BASE_URL || 'https://trms.cbn.gov.ng/api/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.info('TRMS API Request', { method: config.method, url: config.url });
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('TRMS API Response', { status: response.status });
        return response;
      },
      (error) => {
        logger.error('TRMS API Error', {
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Submit Form A (Application for Foreign Exchange - Invisibles)
   * Used for: PTA, BTA, Medical, School Fees, Professional Fees
   */
  async submitFormA(data: {
    applicantName: string;
    applicantBvn: string;
    transactionType: string;
    currency: string;
    amount: number;
    purpose: string;
    destinationCountry: string;
    supportingDocuments: Array<{
      documentType: string;
      documentUrl: string;
    }>;
  }): Promise<{
    success: boolean;
    formNumber: string;
    submissionDate: string;
    status: string;
  }> {
    try {
      const response = await this.client.post('/forms/form-a', data);
      return {
        success: true,
        formNumber: response.data.formNumber,
        submissionDate: response.data.submissionDate,
        status: response.data.status,
      };
    } catch (error: any) {
      logger.error('Form A submission failed', { error: error.message });
      throw new Error(`Form A submission failed: ${error.message}`);
    }
  }

  /**
   * Submit Form M (Import Declaration Form)
   * Used for importing goods
   */
  async submitFormM(data: {
    importerName: string;
    importerTin: string;
    goodsDescription: string;
    hsCode: string;
    currency: string;
    amount: number;
    countryOfOrigin: string;
    invoiceNumber: string;
  }): Promise<{
    success: boolean;
    formNumber: string;
    submissionDate: string;
  }> {
    try {
      const response = await this.client.post('/forms/form-m', data);
      return {
        success: true,
        formNumber: response.data.formNumber,
        submissionDate: response.data.submissionDate,
      };
    } catch (error: any) {
      logger.error('Form M submission failed', { error: error.message });
      throw new Error(`Form M submission failed: ${error.message}`);
    }
  }

  /**
   * Check form status
   */
  async checkFormStatus(formNumber: string): Promise<{
    formNumber: string;
    status: string;
    approvalDate?: string;
    rejectionReason?: string;
  }> {
    try {
      const response = await this.client.get(`/forms/status/${formNumber}`);
      return {
        formNumber: response.data.formNumber,
        status: response.data.status,
        approvalDate: response.data.approvalDate,
        rejectionReason: response.data.rejectionReason,
      };
    } catch (error: any) {
      logger.error('Form status check failed', { formNumber, error: error.message });
      throw new Error(`Form status check failed: ${error.message}`);
    }
  }
}

export const trmsClient = new TRMSClient();
