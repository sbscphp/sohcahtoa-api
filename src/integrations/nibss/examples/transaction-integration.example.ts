/**
 * NIBSS Integration Examples for Transaction Processing
 *
 * This file demonstrates how to integrate NIBSS verification
 * into your existing transaction workflows.
 */

import { nibssClient } from '../nibss.client';
import bvnService from '../../../modules/auth/services/bvn.service';
import tinService from '../../../modules/auth/services/tin.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('NIBSSTransactionIntegration');

/**
 * Example 1: BVN Verification During Customer Onboarding
 */
export async function verifyCustomerBvnDuringOnboarding(
  bvn: string,
  phoneNumber: string,
  userId: string
) {
  try {
    logger.info('Starting BVN verification for customer onboarding', {
      userId,
      bvn: `***${bvn.slice(-4)}`,
    });

    // Option 1: Using the BVN service wrapper (recommended)
    const result = await bvnService.verifyBvn(bvn, phoneNumber);

    if (!result.success) {
      logger.error('BVN verification failed', {
        userId,
        error: result.error,
      });
      throw new Error(`BVN verification failed: ${result.message}`);
    }

    // Check if customer is watch-listed
    if (result.data?.watchListed) {
      logger.warn('Customer is watch-listed', {
        userId,
        bvn: `***${bvn.slice(-4)}`,
      });
      throw new Error('Customer is on watch list. Unable to proceed with onboarding.');
    }

    logger.info('BVN verification successful', {
      userId,
      firstName: result.data?.firstName,
      lastName: result.data?.lastName,
    });

    return {
      verified: true,
      customerData: result.data,
    };
  } catch (error: any) {
    logger.error('BVN verification error during onboarding', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Example 2: TIN Verification for BTA Transactions
 *
 * Business Travel Allowance (BTA) transactions require TIN verification
 */
export async function verifyTinForBtaTransaction(
  tin: string,
  companyName: string,
  userId: string,
  transactionId: string
) {
  try {
    logger.info('Starting TIN verification for BTA transaction', {
      userId,
      transactionId,
      tin: `***${tin.slice(-4)}`,
    });

    // Verify TIN using NIBSS
    const result = await tinService.verifyTin(tin, companyName);

    if (!result.success) {
      logger.error('TIN verification failed for BTA transaction', {
        userId,
        transactionId,
        error: result.error,
      });
      throw new Error(`TIN verification failed: ${result.message}`);
    }

    // Check if TIN is active
    if (result.data?.status !== 'ACTIVE') {
      logger.warn('TIN is not active', {
        userId,
        transactionId,
        tin: `***${tin.slice(-4)}`,
        status: result.data?.status,
      });
      throw new Error('TIN is not active. Unable to process BTA transaction.');
    }

    logger.info('TIN verification successful for BTA transaction', {
      userId,
      transactionId,
      taxPayerName: result.data?.taxPayerName,
    });

    return {
      verified: true,
      tinData: result.data,
    };
  } catch (error: any) {
    logger.error('TIN verification error for BTA transaction', {
      userId,
      transactionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Example 3: Account Verification Before Disbursement
 *
 * Verify beneficiary account before making a transfer
 */
export async function verifyBeneficiaryAccount(
  accountNumber: string,
  bankCode: string,
  expectedAccountName: string,
  transactionId: string
) {
  try {
    logger.info('Verifying beneficiary account', {
      transactionId,
      accountNumber: `***${accountNumber.slice(-4)}`,
      bankCode,
    });

    // Verify account using NIBSS
    const result = await nibssClient.verifyAccount(accountNumber, bankCode);

    if (!result.verified) {
      logger.error('Account verification failed', {
        transactionId,
        error: result.message,
      });
      throw new Error(`Account verification failed: ${result.message}`);
    }

    // Optional: Check if account name matches expected name
    const accountNameMatch = result.accountName?.toLowerCase().includes(
      expectedAccountName.toLowerCase()
    );

    if (!accountNameMatch) {
      logger.warn('Account name mismatch', {
        transactionId,
        expected: expectedAccountName,
        actual: result.accountName,
      });
      // You might want to flag this for manual review instead of blocking
    }

    logger.info('Account verification successful', {
      transactionId,
      accountName: result.accountName,
    });

    return {
      verified: true,
      accountName: result.accountName,
      nameMatch: accountNameMatch,
    };
  } catch (error: any) {
    logger.error('Account verification error', {
      transactionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Example 4: Consent-Based Verification for Compliance
 *
 * Request consent before performing verification (NDPR compliance)
 */
export async function verifyWithConsent(
  userId: string,
  bvn: string,
  purpose: string = 'KYC Verification for Foreign Exchange Transaction'
) {
  try {
    logger.info('Starting consent-based BVN verification', {
      userId,
      bvn: `***${bvn.slice(-4)}`,
      purpose,
    });

    // Use the consent-enabled verification method
    const result = await bvnService.verifyBvnWithConsent(userId, bvn, purpose);

    if (!result.success) {
      logger.error('Consent-based verification failed', {
        userId,
        error: result.error,
      });
      throw new Error(`Verification failed: ${result.message}`);
    }

    logger.info('Consent-based verification successful', {
      userId,
      firstName: result.data?.firstName,
      lastName: result.data?.lastName,
    });

    return {
      verified: true,
      customerData: result.data,
    };
  } catch (error: any) {
    logger.error('Consent-based verification error', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Example 5: Complete Transaction Verification Workflow
 *
 * Comprehensive verification for a transaction involving BVN, TIN, and account checks
 */
export async function performCompleteTransactionVerification(params: {
  userId: string;
  transactionId: string;
  transactionType: string;
  bvn?: string;
  tin?: string;
  companyName?: string;
  beneficiaryAccount?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
}) {
  const verificationResults: any = {
    transactionId: params.transactionId,
    userId: params.userId,
    verifications: {
      bvn: null,
      tin: null,
      account: null,
    },
    allPassed: false,
    errors: [],
  };

  try {
    logger.info('Starting complete transaction verification', params);

    // Step 1: Verify BVN if provided
    if (params.bvn) {
      try {
        const bvnResult = await bvnService.verifyBvn(params.bvn);
        verificationResults.verifications.bvn = {
          verified: bvnResult.success,
          data: bvnResult.data,
          watchListed: bvnResult.data?.watchListed,
        };

        if (!bvnResult.success) {
          verificationResults.errors.push(`BVN verification failed: ${bvnResult.message}`);
        }

        if (bvnResult.data?.watchListed) {
          verificationResults.errors.push('Customer is on watch list');
        }
      } catch (error: any) {
        verificationResults.errors.push(`BVN verification error: ${error.message}`);
      }
    }

    // Step 2: Verify TIN if provided (required for BTA transactions)
    if (params.tin) {
      try {
        const tinResult = await tinService.verifyTin(params.tin, params.companyName);
        verificationResults.verifications.tin = {
          verified: tinResult.success,
          data: tinResult.data,
          status: tinResult.data?.status,
        };

        if (!tinResult.success) {
          verificationResults.errors.push(`TIN verification failed: ${tinResult.message}`);
        }

        if (tinResult.data?.status !== 'ACTIVE') {
          verificationResults.errors.push('TIN is not active');
        }
      } catch (error: any) {
        verificationResults.errors.push(`TIN verification error: ${error.message}`);
      }
    }

    // Step 3: Verify beneficiary account if provided
    if (params.beneficiaryAccount) {
      try {
        const accountResult = await nibssClient.verifyAccount(
          params.beneficiaryAccount.accountNumber,
          params.beneficiaryAccount.bankCode
        );

        verificationResults.verifications.account = {
          verified: accountResult.verified,
          accountName: accountResult.accountName,
          nameMatch: accountResult.accountName?.toLowerCase().includes(
            params.beneficiaryAccount.accountName.toLowerCase()
          ),
        };

        if (!accountResult.verified) {
          verificationResults.errors.push(`Account verification failed: ${accountResult.message}`);
        }
      } catch (error: any) {
        verificationResults.errors.push(`Account verification error: ${error.message}`);
      }
    }

    // Determine if all verifications passed
    const bvnPassed = !params.bvn || (verificationResults.verifications.bvn?.verified && !verificationResults.verifications.bvn?.watchListed);
    const tinPassed = !params.tin || (verificationResults.verifications.tin?.verified && verificationResults.verifications.tin?.status === 'ACTIVE');
    const accountPassed = !params.beneficiaryAccount || verificationResults.verifications.account?.verified;

    verificationResults.allPassed = bvnPassed && tinPassed && accountPassed;

    logger.info('Complete transaction verification finished', {
      transactionId: params.transactionId,
      allPassed: verificationResults.allPassed,
      errorCount: verificationResults.errors.length,
    });

    return verificationResults;
  } catch (error: any) {
    logger.error('Complete transaction verification error', {
      transactionId: params.transactionId,
      error: error.message,
    });
    verificationResults.errors.push(`Verification workflow error: ${error.message}`);
    return verificationResults;
  }
}

/**
 * Example 6: Get Bank List for Dropdown
 *
 * Fetch list of banks for account verification form
 */
export async function getBankListForForm() {
  try {
    logger.info('Fetching bank list from NIBSS');

    const banks = await nibssClient.getBankList();

    logger.info('Bank list fetched successfully', {
      bankCount: banks.length,
    });

    return banks.map((bank) => ({
      value: bank.bankCode,
      label: bank.bankName,
    }));
  } catch (error: any) {
    logger.error('Error fetching bank list', {
      error: error.message,
    });

    // Return fallback list of major Nigerian banks
    return [
      { value: '058', label: 'Guaranty Trust Bank' },
      { value: '033', label: 'United Bank for Africa' },
      { value: '044', label: 'Access Bank' },
      { value: '011', label: 'First Bank of Nigeria' },
      { value: '035', label: 'Wema Bank' },
      { value: '057', label: 'Zenith Bank' },
    ];
  }
}
