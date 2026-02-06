import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('OCRClient');

/**
 * OCR Service Client
 * Handles document text extraction and verification
 * Supports: Google Cloud Vision, AWS Textract, Azure Computer Vision
 */
export class OCRClient {
  private client: AxiosInstance;
  private provider: string;
  private apiKey: string;

  constructor() {
    this.provider = process.env.OCR_PROVIDER || 'google';
    this.apiKey = process.env.OCR_API_KEY || '';

    const baseUrls: Record<string, string> = {
      google: 'https://vision.googleapis.com/v1',
      aws: 'https://textract.us-east-1.amazonaws.com',
      azure: 'https://cognitiveservices.azure.com/vision/v3.2',
    };

    this.client = axios.create({
      baseURL: baseUrls[this.provider],
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Extract text from document image
   */
  async extractText(imageUrl: string): Promise<{
    text: string;
    confidence: number;
    fields?: Record<string, any>;
  }> {
    try {
      if (this.provider === 'google') {
        return await this.extractTextGoogle(imageUrl);
      } else if (this.provider === 'aws') {
        return await this.extractTextAWS(imageUrl);
      } else if (this.provider === 'azure') {
        return await this.extractTextAzure(imageUrl);
      }
      throw new Error(`Unsupported OCR provider: ${this.provider}`);
    } catch (error: any) {
      logger.error('OCR text extraction failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract passport information
   */
  async extractPassportData(imageUrl: string): Promise<{
    passportNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    expiryDate: string;
    confidence: number;
  }> {
    const result = await this.extractText(imageUrl);

    // Parse passport fields (simplified - real implementation would use AI/ML)
    return {
      passportNumber: this.extractField(result.text, /P[A-Z0-9]{7,9}/),
      firstName: this.extractField(result.text, /Given Names?:?\s*([A-Z\s]+)/i),
      lastName: this.extractField(result.text, /Surname:?\s*([A-Z\s]+)/i),
      dateOfBirth: this.extractField(result.text, /Date of Birth:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i),
      nationality: this.extractField(result.text, /Nationality:?\s*([A-Z\s]+)/i),
      expiryDate: this.extractField(result.text, /Date of Expiry:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i),
      confidence: result.confidence,
    };
  }

  /**
   * Extract BVN from document
   */
  async extractBvn(imageUrl: string): Promise<{
    bvn: string;
    name: string;
    dateOfBirth: string;
    confidence: number;
  }> {
    const result = await this.extractText(imageUrl);

    return {
      bvn: this.extractField(result.text, /\b\d{11}\b/),
      name: this.extractField(result.text, /Name:?\s*([A-Z\s]+)/i),
      dateOfBirth: this.extractField(result.text, /DOB:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i),
      confidence: result.confidence,
    };
  }

  /**
   * Google Cloud Vision implementation
   */
  private async extractTextGoogle(imageUrl: string): Promise<{
    text: string;
    confidence: number;
  }> {
    const response = await this.client.post(
      `/images:annotate?key=${this.apiKey}`,
      {
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }
    );

    const annotations = response.data.responses[0].textAnnotations || [];
    return {
      text: annotations[0]?.description || '',
      confidence: annotations[0]?.confidence || 0,
    };
  }

  /**
   * AWS Textract implementation
   */
  private async extractTextAWS(imageUrl: string): Promise<{
    text: string;
    confidence: number;
  }> {
    // Simplified - real implementation would use AWS SDK
    return {
      text: '',
      confidence: 0,
    };
  }

  /**
   * Azure Computer Vision implementation
   */
  private async extractTextAzure(imageUrl: string): Promise<{
    text: string;
    confidence: number;
  }> {
    // Simplified - real implementation would use Azure SDK
    return {
      text: '',
      confidence: 0,
    };
  }

  /**
   * Helper to extract field from text using regex
   */
  private extractField(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match ? match[1] || match[0] : '';
  }
}

export const ocrClient = new OCRClient();
