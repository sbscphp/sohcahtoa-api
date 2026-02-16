import { getDatabase } from '../../../config/database';
import { ValidationError, NotFoundError, createLogger } from '../../../shared/utils';
import { CustomerType, KycStatus } from '../../../shared/types';

const logger = createLogger('PassportService');

const prisma = getDatabase();

export interface PassportUploadData {
  userId: string;
  passportDocumentUrl: string;
}

export class PassportService {
  async uploadPassportForVerification(data: PassportUploadData): Promise<{ message: string; verificationRequestId: string }> {
    // Find user and validate they are a tourist
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { kyc: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.customerType !== CustomerType.TOURIST && user.customerType !== CustomerType.EXPATRIATE) {
      throw new ValidationError('Passport upload is only available for tourist and expatriate accounts');
    }

    if (!user.kyc) {
      throw new ValidationError('KYC record not found');
    }

    // Update KYC status
    await prisma.userKyc.update({
      where: { userId: data.userId },
      data: {
        status: KycStatus.IN_PROGRESS,
      },
    });

    // TODO: Create verification request in document service
    // This would typically be done via API call or event publishing
    // For now, we'll simulate it with a mock request ID
    const verificationRequestId = `VR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Passport verification request created', {
      verificationRequestId,
      documentUrl: data.passportDocumentUrl,
      userId: data.userId,
    });

    /**
     * In production, this would publish an event or make an API call to the document service:
     *
     * await publishEvent({
     *   eventType: EventType.DOCUMENT_UPLOADED,
     *   data: {
     *     userId: data.userId,
     *     documentUrl: data.passportDocumentUrl,
     *     verificationType: 'PASSPORT',
     *     verificationRequestId,
     *   },
     * });
     *
     * OR
     *
     * const response = await fetch(`${DOCUMENT_SERVICE_URL}/verify/passport`, {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({
     *     userId: data.userId,
     *     documentUrl: data.passportDocumentUrl,
     *   }),
     * });
     */

    return {
      message: 'Passport uploaded successfully. Verification is in progress.',
      verificationRequestId,
    };
  }

  async getPassportVerificationStatus(userId: string): Promise<{ status: string; message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: true },
    });

    if (!user || !user.kyc) {
      throw new NotFoundError('User or KYC record not found');
    }

    const statusMessages: Record<string, string> = {
      NOT_STARTED: 'Passport verification has not been initiated',
      IN_PROGRESS: 'Passport verification is in progress',
      PENDING_VERIFICATION: 'Passport verification is pending manual review',
      VERIFIED: 'Passport has been verified successfully',
      REJECTED: 'Passport verification was rejected',
    };

    return {
      status: user.kyc.status,
      message: statusMessages[user.kyc.status] || 'Unknown status',
    };
  }
}

export default new PassportService();
