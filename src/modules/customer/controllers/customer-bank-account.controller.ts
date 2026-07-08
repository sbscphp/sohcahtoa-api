import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { customerBankAccountService } from '../services/customer-bank-account.service';
import { successResponse } from '../../../shared/utils/response';
import { ValidationError } from '../../../shared/utils';

export class CustomerBankAccountController {
  /**
   * GET /api/customer/bank-accounts/banks?q=
   * Returns the list of supported Nigerian banks, optionally filtered by name.
   */
  async getBanks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string | undefined;
      const banks = customerBankAccountService.getBanks(q);
      res.json(successResponse(banks));
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/customer/bank-accounts/lookup?bankName=&accountNumber=
   * Simulates an account-name enquiry (NIBSS / bank API will replace this).
   */
  async lookupAccountName(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bankName, accountNumber } = req.query as Record<string, string>;
      const result = await customerBankAccountService.lookupAccountName(bankName, accountNumber);
      res.json(successResponse(result, 'Account name retrieved'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/customer/bank-accounts
   * List all saved bank accounts for the authenticated customer.
   */
  async listBankAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const currency = req.query.currency as string | undefined;
      const accounts = await customerBankAccountService.listBankAccounts(userId, currency);
      res.json(successResponse(accounts));
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/customer/bank-accounts
   * Add (or re-confirm) a bank account on the customer's profile.
   * Body: { bankName, accountNumber, accountName }
   */
  async addBankAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { bankName, accountNumber, accountName, currency, swiftCode, iban, routingNumber, bankAddress } = req.body;
      const account = await customerBankAccountService.addBankAccount(userId, {
        bankName,
        accountNumber,
        accountName,
        currency,
        swiftCode,
        iban,
        routingNumber,
        bankAddress,
      });
      res.status(201).json(successResponse(account, 'Bank account saved'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/customer/bank-accounts/:bankAccountId/default
   * Mark a bank account as the customer's default.
   */
  async setDefault(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { bankAccountId } = req.params;
      const account = await customerBankAccountService.setDefault(userId, bankAccountId);
      res.json(successResponse(account, 'Default bank account updated'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/customer/bank-accounts/:bankAccountId
   * Remove a bank account from the customer's profile.
   */
  async deleteBankAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { bankAccountId } = req.params;
      await customerBankAccountService.deleteBankAccount(userId, bankAccountId);
      res.json(successResponse(null, 'Bank account removed'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/customer/transactions/:transactionId/bank-accounts
   * Attach one or more saved bank accounts to a transaction.
   * Body: { bankAccountIds: string[] }
   */
  async attachToTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { transactionId } = req.params;
      const { bankAccountIds } = req.body;

      if (!Array.isArray(bankAccountIds)) {
        throw new ValidationError('bankAccountIds must be an array');
      }

      const accounts = await customerBankAccountService.attachToTransaction(
        userId,
        transactionId,
        bankAccountIds,
      );
      res.json(successResponse(accounts, 'Bank accounts attached to transaction'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/customer/transactions/:transactionId/bank-accounts
   * List all bank accounts attached to a transaction.
   */
  async getTransactionBankAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { transactionId } = req.params;
      const accounts = await customerBankAccountService.getTransactionBankAccounts(
        userId,
        transactionId,
      );
      res.json(successResponse(accounts));
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/customer/transactions/:transactionId/bank-accounts/:bankAccountId
   * Detach a specific bank account from a transaction.
   */
  async detachFromTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { transactionId, bankAccountId } = req.params;
      await customerBankAccountService.detachFromTransaction(userId, transactionId, bankAccountId);
      res.json(successResponse(null, 'Bank account removed from transaction'));
    } catch (err) {
      next(err);
    }
  }
}

export const customerBankAccountController = new CustomerBankAccountController();
