import prisma from '../config/database';
import { publishEvent } from '../config/kafka';
import axios from 'axios';
import {
  generateId,
  NotFoundError,
  createLogger,
} from '@fx-platform/shared-utils';
import {
  VerificationStatus,
  EventType,
  ServiceName,
} from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.DOCUMENT);

export class VerificationService {
  async createVerificationRequest(data: {
    transactionId: string;
    userId: string;
    documentId: string;
    documentUrl: string;
    verificationType: string;
  }) {
    const request = await prisma.verificationRequest.create({
      data: {
        transactionId: data.transactionId,
        userId: data.userId,
        documentId: data.documentId,
        verificationType: data.verificationType as any,
        documentUrl: data.documentUrl,
        status: VerificationStatus.PENDING,
      },
    });

    // Trigger automated verification
    await this.processAutomatedVerification(request.id);

    return request;
  }

  async processAutomatedVerification(requestId: string) {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Verification request not found');
    }

    await prisma.verificationRequest.update({
      where: { id: requestId },
      data: { status: VerificationStatus.IN_PROGRESS },
    });

    try {
      let result: any;

      switch (request.verificationType) {
        case 'PASSPORT':
          result = await this.verifyPassport(request);
          break;
        case 'BVN':
          result = await this.verifyBVN(request);
          break;
        case 'TIN':
          result = await this.verifyTIN(request);
          break;
        case 'VISA':
          result = await this.verifyVisa(request);
          break;
        default:
          result = await this.basicDocumentCheck(request);
      }

      // Store verification result
      await prisma.verificationResult.create({
        data: {
          requestId: request.id,
          verificationType: request.verificationType,
          status: result.status,
          provider: result.provider,
          apiResponse: result.apiResponse,
          extractedData: result.extractedData,
          confidenceScore: result.confidenceScore,
          flags: result.flags,
        },
      });

      // Update request status
      await prisma.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: result.status,
          completedAt: result.status === VerificationStatus.VERIFIED ? new Date() : null,
        },
      });

      // Publish event
      await publishEvent({
        eventId: generateId(),
        eventType: EventType.VERIFICATION_COMPLETED,
        source: ServiceName.DOCUMENT,
        timestamp: new Date().toISOString(),
        userId: request.userId,
        data: {
          transactionId: request.transactionId,
          userId: request.userId,
          documentType: request.verificationType,
          verificationStatus: result.status,
        },
      });

      return result;
    } catch (error) {
      logger.error('Verification failed:', error);

      await prisma.verificationRequest.update({
        where: { id: requestId },
        data: { status: VerificationStatus.REQUIRES_MANUAL_REVIEW },
      });

      throw error;
    }
  }

  private async verifyPassport(request: any) {
    const startTime = Date.now();

    try {
      // Integration with Nigerian Immigration Service API (mock)
      const response = await this.callExternalAPI(
        'NIGERIAN_IMMIGRATION',
        '/api/verify-passport',
        { documentUrl: request.documentUrl }
      );

      const duration = Date.now() - startTime;

      await prisma.externalApiLog.create({
        data: {
          provider: 'NIGERIAN_IMMIGRATION',
          endpoint: '/api/verify-passport',
          requestData: { documentUrl: request.documentUrl },
          responseData: response,
          statusCode: 200,
          duration,
          success: true,
        },
      });

      // Analyze response
      const isValid = response.data?.valid === true;
      const confidenceScore = response.data?.confidenceScore || 0;

      return {
        status: isValid && confidenceScore > 70
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'NIGERIAN_IMMIGRATION',
        apiResponse: response,
        extractedData: response.data?.extractedData,
        confidenceScore,
        flags: response.data?.flags || [],
      };
    } catch (error) {
      logger.error('Passport verification failed:', error);
      return {
        status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'NIGERIAN_IMMIGRATION',
        apiResponse: null,
        confidenceScore: 0,
        flags: ['API_ERROR'],
      };
    }
  }

  private async verifyBVN(request: any) {
    try {
      // Integration with CBN BVN verification (mock)
      const response = await this.callExternalAPI(
        'CBN_BVN',
        '/api/verify-bvn',
        { bvn: request.documentUrl }
      );

      return {
        status: response.data?.verified ? VerificationStatus.VERIFIED : VerificationStatus.FAILED,
        provider: 'CBN_BVN',
        apiResponse: response,
        extractedData: response.data,
        confidenceScore: 100,
        flags: [],
      };
    } catch (error) {
      logger.error('BVN verification failed:', error);
      return {
        status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'CBN_BVN',
        apiResponse: null,
        confidenceScore: 0,
        flags: ['API_ERROR'],
      };
    }
  }

  private async verifyTIN(request: any) {
    try {
      // Integration with FIRS TIN verification (mock)
      const response = await this.callExternalAPI(
        'FIRS_TIN',
        '/api/verify-tin',
        { tin: request.documentUrl }
      );

      return {
        status: response.data?.valid ? VerificationStatus.VERIFIED : VerificationStatus.FAILED,
        provider: 'FIRS_TIN',
        apiResponse: response,
        extractedData: response.data,
        confidenceScore: 100,
        flags: [],
      };
    } catch (error) {
      return {
        status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'FIRS_TIN',
        apiResponse: null,
        confidenceScore: 0,
        flags: ['API_ERROR'],
      };
    }
  }

  private async verifyVisa(request: any) {
    try {
      // OCR and visa verification (mock)
      const response = await this.callExternalAPI(
        'VISA_VERIFY',
        '/api/verify-visa',
        { documentUrl: request.documentUrl }
      );

      return {
        status: response.data?.valid ? VerificationStatus.VERIFIED : VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'VISA_VERIFY',
        apiResponse: response,
        extractedData: response.data,
        confidenceScore: response.data?.confidenceScore || response.data?.confidenceScore || 0,
        flags: response.data?.flags || [],
      };
    } catch (error) {
      return {
        status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        provider: 'VISA_VERIFY',
        apiResponse: null,
        confidenceScore: 0,
        flags: ['API_ERROR'],
      };
    }
  }

  private async basicDocumentCheck(request: any) {
    // Basic document validation - file exists, readable, etc.
    return {
      status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
      provider: 'INTERNAL',
      apiResponse: null,
      extractedData: null,
      confidenceScore: 50,
      flags: ['MANUAL_REVIEW_REQUIRED'],
    };
  }

  private async callExternalAPI(provider: string, endpoint: string, data: any) {
    // Mock external API calls
    // In production, this would call actual verification APIs
    logger.info(`Calling external API: ${provider}${endpoint}`);

    // Simulate API response
    return {
      status: 200,
      data: {
        valid: true,
        verified: true,
        confidenceScore: 85,
        extractedData: {
          documentNumber: 'A12345678',
          name: 'John Doe',
          dateOfBirth: '1990-01-01',
        },
        flags: [],
      },
    };
  }

  async getVerificationRequest(requestId: string) {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: {
        results: true,
        reviews: true,
      },
    });

    if (!request) {
      throw new NotFoundError('Verification request not found');
    }

    return request;
  }

  async adminReview(requestId: string, reviewerId: string, decision: string, comments?: string) {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Verification request not found');
    }

    const review = await prisma.adminReview.create({
      data: {
        requestId,
        reviewerId,
        status: decision === 'APPROVE' ? VerificationStatus.VERIFIED : VerificationStatus.FAILED,
        decision,
        comments,
      },
    });

    await prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: decision === 'APPROVE' ? VerificationStatus.VERIFIED : VerificationStatus.FAILED,
        completedAt: new Date(),
      },
    });

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.VERIFICATION_COMPLETED,
      source: ServiceName.DOCUMENT,
      timestamp: new Date().toISOString(),
      userId: request.userId,
      data: {
        transactionId: request.transactionId,
        userId: request.userId,
        documentType: request.verificationType,
        verificationStatus: decision === 'APPROVE' ? 'VERIFIED' : 'FAILED',
        reviewedBy: reviewerId,
      },
    });

    return review;
  }

  async getPendingReviews(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where: {
          status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          results: true,
        },
      }),
      prisma.verificationRequest.count({
        where: {
          status: VerificationStatus.REQUIRES_MANUAL_REVIEW,
        },
      }),
    ]);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new VerificationService();
