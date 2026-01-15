import prisma from '../config/database';
import { publishEvent } from '../config/kafka';
import axios from 'axios';
import {
  generateId,
  generateTransactionReference,
  NotFoundError,
  createLogger,
} from '@fx-platform/shared-utils';
import {
  AmlCheckRequest,
  AmlCheckResponse,
  AmlCheckStatus,
  AmlFlagSeverity,
  AmlFlagType,
  ComplianceReviewStatus,
  EventType,
  ServiceName
} from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.COMPLIANCE);

export class ComplianceService {
  async performAmlCheck(data: AmlCheckRequest): Promise<AmlCheckResponse> {
    // Create AML check record
    const check = await prisma.amlCheck.create({
      data: {
        transactionId: data.transactionId,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        transactionType: data.transactionType,
        sourceOfFunds: data.sourceOfFunds,
        status: AmlCheckStatus.PENDING,
      },
    });

    // Update status to in progress
    await prisma.amlCheck.update({
      where: { id: check.id },
      data: { status: AmlCheckStatus.IN_PROGRESS },
    });

    // Perform various checks
    const flags = [];
    let riskScore = 0;

    // 1. Threshold check
    const thresholdCheck = await this.checkThreshold(data);
    if (thresholdCheck.flagged) {
      flags.push(thresholdCheck.flag);
      riskScore += thresholdCheck.riskImpact;
    }

    // 2. Frequency check
    const frequencyCheck = await this.checkTransactionFrequency(data.userId);
    if (frequencyCheck.flagged) {
      flags.push(frequencyCheck.flag);
      riskScore += frequencyCheck.riskImpact;
    }

    // 3. Watchlist check
    const watchlistCheck = await this.checkWatchlist(data.userId);
    if (watchlistCheck.flagged) {
      flags.push(watchlistCheck.flag);
      riskScore += watchlistCheck.riskImpact;
    }

    // 4. Country risk check
    const countryCheck = await this.checkCountryRisk(data);
    if (countryCheck.flagged) {
      flags.push(countryCheck.flag);
      riskScore += countryCheck.riskImpact;
    }

    // 5. NFIU check (external API)
    const nfiuCheck = await this.checkNFIU(data);
    if (nfiuCheck.flagged) {
      flags.push(nfiuCheck.flag);
      riskScore += nfiuCheck.riskImpact;
    }

    // Store flags
    for (const flag of flags) {
      await prisma.amlFlag.create({
        data: {
          checkId: check.id,
          type: flag.type,
          severity: flag.severity,
          description: flag.description,
          details: flag.details,
        },
      });

      // Publish high severity flags immediately
      if (flag.severity === AmlFlagSeverity.HIGH || flag.severity === AmlFlagSeverity.CRITICAL) {
        await publishEvent({
          eventId: generateId(),
          eventType: EventType.AML_FLAG_RAISED,
          source: ServiceName.COMPLIANCE,
          timestamp: new Date().toISOString(),
          userId: data.userId,
          data: {
            transactionId: data.transactionId,
            userId: data.userId,
            flagType: flag.type,
            severity: flag.severity,
            description: flag.description,
          },
        });
      }
    }

    // Determine final status
    let finalStatus: AmlCheckStatus;
    const recommendations = [];

    if (riskScore >= 80) {
      finalStatus = AmlCheckStatus.FAILED;
      recommendations.push('Transaction should be blocked');
      recommendations.push('Report to NFIU required');
    } else if (riskScore >= 50) {
      finalStatus = AmlCheckStatus.FLAGGED;
      recommendations.push('Requires compliance officer review');
      recommendations.push('Additional documentation may be needed');
    } else {
      finalStatus = AmlCheckStatus.PASSED;
      recommendations.push('Transaction can proceed');
    }

    // Update check
    const updated = await prisma.amlCheck.update({
      where: { id: check.id },
      data: {
        status: finalStatus,
        riskScore,
        recommendations,
        checkedAt: new Date(),
      },
      include: {
        flags: true,
      },
    });

    // Create compliance review if flagged
    if (finalStatus === AmlCheckStatus.FLAGGED || finalStatus === AmlCheckStatus.FAILED) {
      await prisma.complianceReview.create({
        data: {
          checkId: check.id,
          transactionId: data.transactionId,
          reviewerId: '', // Will be assigned
          status: ComplianceReviewStatus.PENDING,
        },
      });

      // Publish event for admin notification
      await publishEvent({
        eventId: generateId(),
        eventType: EventType.COMPLIANCE_REVIEW_REQUIRED,
        source: ServiceName.COMPLIANCE,
        timestamp: new Date().toISOString(),
        userId: data.userId,
        data: {
          transactionId: data.transactionId,
          checkId: check.id,
          riskScore,
          status: finalStatus,
        },
      });
    }

    return {
      checkId: updated.id,
      transactionId: updated.transactionId,
      status: updated.status as any,
      riskScore: updated.riskScore,
      flags: updated.flags.map((f:any) => ({
        id: f.id,
        type: f.type as any,
        severity: f.severity as any,
        description: f.description,
        details: f.details,
        createdAt: f.createdAt.toISOString(),
      })),
      recommendations,
      checkedAt: updated.checkedAt?.toISOString() || '',
    };
  }

  private async checkThreshold(data: AmlCheckRequest) {
    // Check if amount exceeds single transaction threshold
    const threshold = 10000; // USD equivalent

    if (data.amount > threshold) {
      return {
        flagged: true,
        flag: {
          type: AmlFlagType.THRESHOLD_EXCEEDED,
          severity: AmlFlagSeverity.MEDIUM,
          description: `Transaction amount ${data.amount} ${data.currency} exceeds threshold`,
          details: { amount: data.amount, threshold },
        },
        riskImpact: 20,
      };
    }

    return { flagged: false, riskImpact: 0 };
  }

  private async checkTransactionFrequency(userId: string) {
    // Check for suspicious patterns in transaction frequency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentChecks = await prisma.amlCheck.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentChecks > 10) {
      return {
        flagged: true,
        flag: {
          type: AmlFlagType.FREQUENT_TRANSACTIONS,
          severity: AmlFlagSeverity.MEDIUM,
          description: `User has ${recentChecks} transactions in the last 30 days`,
          details: { count: recentChecks, period: '30 days' },
        },
        riskImpact: 25,
      };
    }

    return { flagged: false, riskImpact: 0 };
  }

  private async checkWatchlist(userId: string) {
    // Check if user is on any watchlist
    const watchlistEntry = await prisma.watchList.findFirst({
      where: {
        name: userId,
        isActive: true,
      },
    });

    if (watchlistEntry) {
      return {
        flagged: true,
        flag: {
          type: AmlFlagType.SANCTIONS_LIST,
          severity: AmlFlagSeverity.CRITICAL,
          description: `User found on watchlist: ${watchlistEntry.reason}`,
          details: { source: watchlistEntry.source, reason: watchlistEntry.reason },
        },
        riskImpact: 80,
      };
    }

    return { flagged: false, riskImpact: 0 };
  }

  private async checkCountryRisk(data: AmlCheckRequest) {
    // Check high-risk countries
    const highRiskCountries = ['SYRIA', 'IRAN', 'NORTH_KOREA', 'AFGHANISTAN'];

    // This would typically check the transaction's destination country
    // For now, we'll skip this check
    return { flagged: false, riskImpact: 0 };
  }

  private async checkNFIU(data: AmlCheckRequest) {
    try {
      // Mock NFIU API call
      logger.info('Checking with NFIU API');

      // In production, this would call actual NFIU API
      const response = await this.callNFIUAPI({
        userId: data.userId,
        amount: data.amount,
        transactionType: data.transactionType,
      });

      if (response.flagged) {
        return {
          flagged: true,
          flag: {
            type: AmlFlagType.ADVERSE_MEDIA,
            severity: AmlFlagSeverity.HIGH,
            description: 'NFIU reported adverse findings',
            details: response.details,
          },
          riskImpact: 50,
        };
      }

      return { flagged: false, riskImpact: 0 };
    } catch (error) {
      logger.error('NFIU check failed:', error);
      return { flagged: false, riskImpact: 0 };
    }
  }

  private async callNFIUAPI(data: any) {
    // Mock NFIU API call
    // In production, integrate with actual NFIU API
    return {
      flagged: false,
      details: null,
    };
  }

  async getAmlCheck(checkId: string) {
    const check = await prisma.amlCheck.findUnique({
      where: { id: checkId },
      include: {
        flags: true,
        reviews: true,
      },
    });

    if (!check) {
      throw new NotFoundError('AML check not found');
    }

    return check;
  }

  async reviewCheck(checkId: string, reviewerId: string, decision: string, notes?: string) {
    const check = await prisma.amlCheck.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new NotFoundError('AML check not found');
    }

    const review = await prisma.complianceReview.create({
      data: {
        checkId,
        transactionId: check.transactionId,
        reviewerId,
        status: decision === 'APPROVE' ? ComplianceReviewStatus.APPROVED : ComplianceReviewStatus.REJECTED,
        decision,
        notes,
        reviewedAt: new Date(),
      },
    });

    // Publish event
    await publishEvent({
      eventId: generateId(),
      eventType: EventType.COMPLIANCE_REVIEW_COMPLETED,
      source: ServiceName.COMPLIANCE,
      timestamp: new Date().toISOString(),
      data: {
        checkId,
        transactionId: check.transactionId,
        decision,
        reviewedBy: reviewerId,
      },
    });

    return review;
  }

  async reportToNFIU(transactionId: string, userId: string, reason: string, data: any) {
    const reportReference = generateTransactionReference('NFIU');

    const report = await prisma.nfiuReport.create({
      data: {
        transactionId,
        userId,
        reportType: 'SUSPICIOUS_TRANSACTION',
        amount: data.amount,
        currency: data.currency,
        reason,
        reportData: data,
        reportReference,
      },
    });

    // In production, actually submit to NFIU API
    logger.info(`NFIU report created: ${reportReference}`);

    return report;
  }

  async getPendingReviews(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.complianceReview.findMany({
        where: {
          status: ComplianceReviewStatus.PENDING,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          check: {
            include: {
              flags: true,
            },
          },
        },
      }),
      prisma.complianceReview.count({
        where: {
          status: ComplianceReviewStatus.PENDING,
        },
      }),
    ]);

    return {
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new ComplianceService();
