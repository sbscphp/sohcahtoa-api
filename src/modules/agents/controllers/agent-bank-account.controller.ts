import { Request, Response } from 'express';
import { agentBankAccountService } from '../services/agent-bank-account.service';

export const agentBankAccountController = {
  async addBankAccount(req: Request, res: Response) {
    try {
      const agentUserId = (req as any).user.id;
      const account = await agentBankAccountService.addBankAccount(agentUserId, req.body);
      res.status(201).json({ success: true, data: account });
    } catch (e: any) {
      res.status(e.statusCode || 400).json({ success: false, message: e.message });
    }
  },

  async listBankAccounts(req: Request, res: Response) {
    try {
      const agentUserId = (req as any).user.id;
      const { currency } = req.query as any;
      const accounts = await agentBankAccountService.listBankAccounts(agentUserId, currency);
      res.json({ success: true, data: accounts });
    } catch (e: any) {
      res.status(e.statusCode || 400).json({ success: false, message: e.message });
    }
  },

  async updateBankAccount(req: Request, res: Response) {
    try {
      const agentUserId = (req as any).user.id;
      const account = await agentBankAccountService.updateBankAccount(agentUserId, req.params.accountId, req.body);
      res.json({ success: true, data: account });
    } catch (e: any) {
      res.status(e.statusCode || 400).json({ success: false, message: e.message });
    }
  },

  async deleteBankAccount(req: Request, res: Response) {
    try {
      const agentUserId = (req as any).user.id;
      const result = await agentBankAccountService.deleteBankAccount(agentUserId, req.params.accountId);
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(e.statusCode || 404).json({ success: false, message: e.message });
    }
  },

  async setDefault(req: Request, res: Response) {
    try {
      const agentUserId = (req as any).user.id;
      const account = await agentBankAccountService.setDefault(agentUserId, req.params.accountId);
      res.json({ success: true, data: account });
    } catch (e: any) {
      res.status(e.statusCode || 400).json({ success: false, message: e.message });
    }
  },
};
