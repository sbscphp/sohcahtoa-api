import { getDatabase } from "../../../config/database";
import { createLogger } from "../../../shared/utils";
import { ServiceName } from "../../../shared/types";
import { workflowService } from "./workflow.service";

const prisma = getDatabase();
const logger = createLogger(ServiceName.ADMIN);

export class AdminWalletService {

  /**
   * List all transient wallets with search, filter, sort, and pagination.
   * Matches the UI columns: Wallet ID, Customer Name, Date & Time, Total Debits, Total Credit
   */
  async listWallets(filters: any, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === "true" || filters.isActive === true;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    // Search by customer name, email, or wallet ID
    const search = (filters.search || "").toString().trim();
    let userIds: string[] | null = null;
    if (search) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { profile: { firstName: { contains: search, mode: "insensitive" } } },
            { profile: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      });
      userIds = matchedUsers.map((u) => u.id);

      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }

    // Sorting
    const orderBy: any = {};
    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = (filters.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [wallets, total] = await Promise.all([
      (prisma as any).customerWallet.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      (prisma as any).customerWallet.count({ where }),
    ]);

    // Get user details for all wallets
    const walletUserIds = wallets.map((w: any) => w.userId);
    const users = walletUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: walletUserIds } },
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get debit and credit totals for each wallet
    const walletIds = wallets.map((w: any) => w.id);

    const [debitAggregates, creditAggregates] = await Promise.all([
      (prisma as any).walletEntry.groupBy({
        by: ["walletId"],
        where: { walletId: { in: walletIds }, type: "DEBIT", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      (prisma as any).walletEntry.groupBy({
        by: ["walletId"],
        where: { walletId: { in: walletIds }, type: "CREDIT", status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

    const debitMap = new Map(
      debitAggregates.map((a: any) => [a.walletId, Number(a._sum?.amount || 0)])
    );
    const creditMap = new Map(
      creditAggregates.map((a: any) => [a.walletId, Number(a._sum?.amount || 0)])
    );

    const data = wallets.map((w: any) => {
      const user: any = userMap.get(w.userId);
      const customerName = user?.profile
        ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim()
        : undefined;

      return {
        id: w.id,
        walletId: w.id,
        userId: w.userId,
        customerName,
        balance: Number(w.balance),
        currency: w.currency,
        isActive: w.isActive,
        totalDebits: debitMap.get(w.id) || 0,
        totalCredits: creditMap.get(w.id) || 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single wallet by wallet ID, including recent ledger entries.
   */
  async getWalletById(walletId: string) {
    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return null;
    }

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: wallet.userId },
      include: { profile: true },
    });

    const customerName = user?.profile
      ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim()
      : undefined;

    // Debit & credit totals
    const [debitAgg, creditAgg] = await Promise.all([
      (prisma as any).walletEntry.aggregate({
        where: { walletId: wallet.id, type: "DEBIT", status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
      (prisma as any).walletEntry.aggregate({
        where: { walletId: wallet.id, type: "CREDIT", status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      id: wallet.id,
      walletId: wallet.id,
      customerId: wallet.userId,
      userId: wallet.userId,
      customerName,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isActive: wallet.isActive,
      totalDebits: Number(debitAgg._sum?.amount || 0),
      totalDebitCount: debitAgg._count || 0,
      totalCredits: Number(creditAgg._sum?.amount || 0),
      totalCreditCount: creditAgg._count || 0,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Get wallet ledger entries with filters and pagination.
   */
  async getWalletLedger(
    walletId: string,
    filters: {
      page?: number;
      limit?: number;
      type?: "DEBIT" | "CREDIT";
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      matchStatus?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ) {
    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return null;
    }

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const andConditions: any[] = [];
    andConditions.push({ walletId: wallet.id });

    if (filters.type) andConditions.push({ type: filters.type });
    if (filters.status) andConditions.push({ status: filters.status });
    if (filters.dateFrom || filters.dateTo) {
      const dateCond: any = {};
      if (filters.dateFrom) dateCond.gte = new Date(filters.dateFrom);
      if (filters.dateTo) dateCond.lte = new Date(filters.dateTo);
      andConditions.push({ createdAt: dateCond });
    }
    if (filters.search) {
      const search = filters.search.trim();
      andConditions.push({
        OR: [
          { transactionRef: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      });
    }
    if (filters.matchStatus) {
      const matchStatus = filters.matchStatus.toUpperCase();
      if (matchStatus === "MATCHED") {
        andConditions.push({
          OR: [
            { matchStatus: "MATCHED" },
            {
              AND: [
                { matchStatus: null },
                { linkedTransactionId: { not: null } }
              ]
            }
          ]
        });
      } else if (matchStatus === "UNMATCHED") {
        andConditions.push({
          OR: [
            { matchStatus: "UNMATCHED" },
            {
              AND: [
                { matchStatus: null },
                { linkedTransactionId: null }
              ]
            }
          ]
        });
      }
    }

    const where = { AND: andConditions };

    const orderBy: any = {};
    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = (filters.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [entries, total] = await Promise.all([
      (prisma as any).walletEntry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      (prisma as any).walletEntry.count({ where }),
    ]);

    return {
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        balance: Number(wallet.balance),
        currency: wallet.currency,
      },
      entries: entries.map((e: any) => ({
        id: e.id,
        type: e.type,
        amount: Number(e.amount),
        balanceBefore: Number(e.balanceBefore),
        balanceAfter: Number(e.balanceAfter),
        description: e.description,
        status: e.status,
        matchStatus: e.matchStatus || (e.linkedTransactionId ? "MATCHED" : "UNMATCHED"),
        transactionRef: e.transactionRef,
        transactionId: e.transactionId,
        linkedTransactionId: e.linkedTransactionId,
        linkReason: e.linkReason,
        sessionId: e.sessionId,
        createdAt: e.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific ledger entry by ID, including notes.
   */
  async getEntryById(walletId: string, entryId: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!entry) {
      return null;
    }

    // Resolve admin names for notes
    const adminIds = new Set<string>();
    for (const n of entry.notes) {
      if (n.adminId) adminIds.add(n.adminId);
    }
    if (entry.flaggedBy) adminIds.add(entry.flaggedBy);
    if (entry.refundedBy) adminIds.add(entry.refundedBy);
    if (entry.disbursedBy) adminIds.add(entry.disbursedBy);

    const admins = adminIds.size
      ? await prisma.adminUser.findMany({
          where: { id: { in: Array.from(adminIds) } },
          select: { id: true, fullName: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.fullName]));

    // Get linked transaction details if any
    let linkedTransaction = null;
    const linkedTxId = entry.linkedTransactionId || entry.transactionId;
    if (linkedTxId) {
      const tx = await prisma.transaction.findUnique({
        where: { id: linkedTxId },
        select: {
          id: true,
          referenceNumber: true,
          type: true,
          status: true,
          foreignAmount: true,
          nairaEquivalent: true,
          currency: true,
          createdAt: true,
        },
      });
      if (tx) {
        linkedTransaction = {
          id: tx.id,
          referenceNumber: tx.referenceNumber,
          type: tx.type,
          status: tx.status,
          foreignAmount: Number(tx.foreignAmount || 0),
          nairaEquivalent: Number(tx.nairaEquivalent || 0),
          currency: tx.currency,
          createdAt: tx.createdAt,
        };
      }
    }

    return {
      id: entry.id,
      walletId: entry.walletId,
      type: entry.type,
      amount: Number(entry.amount),
      balanceBefore: Number(entry.balanceBefore),
      balanceAfter: Number(entry.balanceAfter),
      description: entry.description,
      status: entry.status,
      matchStatus: entry.matchStatus || (entry.linkedTransactionId ? "MATCHED" : "UNMATCHED"),
      transactionRef: entry.transactionRef,
      transactionId: entry.transactionId,
      sessionId: entry.sessionId,
      linkedTransactionId: entry.linkedTransactionId,
      linkReason: entry.linkReason,
      linkedTransaction,
      isFlagged: entry.isFlagged,
      flagReason: entry.flagReason,
      flaggedBy: entry.flaggedBy ? adminMap.get(entry.flaggedBy) || entry.flaggedBy : null,
      flaggedAt: entry.flaggedAt,
      refundStatus: entry.refundStatus,
      refundedBy: entry.refundedBy ? adminMap.get(entry.refundedBy) || entry.refundedBy : null,
      refundedAt: entry.refundedAt,
      disbursementStatus: entry.disbursementStatus,
      disbursedBy: entry.disbursedBy ? adminMap.get(entry.disbursedBy) || entry.disbursedBy : null,
      disbursedAt: entry.disbursedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      notes: entry.notes.map((n: any) => ({
        id: n.id,
        note: n.note,
        adminId: n.adminId,
        adminName: adminMap.get(n.adminId) || n.adminId,
        createdAt: n.createdAt,
      })),
    };
  }

  /**
   * Get customer details for a wallet.
   */
  async getCustomerForWallet(walletId: string) {
    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: wallet.userId },
      include: { profile: true, kyc: true },
    });

    if (!user) {
      return null;
    }

    const profile = user.profile;
    const kyc = user.kyc;

    return {
      userId: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      customerType: user.customerType,
      firstName: profile?.firstName || null,
      lastName: profile?.lastName || null,
      fullName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
      dateOfBirth: profile?.dateOfBirth || null,
      address: profile?.address || null,
      city: profile?.city || null,
      state: profile?.state || null,
      country: profile?.country || null,
      bvn: kyc?.bvn ? `${kyc.bvn.slice(0, 2)}*******${kyc.bvn.slice(-3)}` : null,
      bvnVerified: kyc?.bvnVerified || false,
      ninVerified: kyc?.ninVerified || false,
      createdAt: user.createdAt,
    };
  }

  /**
   * Add a note to a wallet entry.
   */
  async addEntryNote(walletId: string, entryId: string, adminId: string, note: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    const created = await (prisma as any).walletEntryNote.create({
      data: {
        entryId,
        adminId,
        note,
      },
    });

    logger.info("Note added to wallet entry", { walletId, entryId, adminId, noteId: created.id });

    return {
      id: created.id,
      entryId: created.entryId,
      adminId: created.adminId,
      note: created.note,
      createdAt: created.createdAt,
    };
  }

  /**
   * Get notes for a wallet entry.
   */
  async getEntryNotes(walletId: string, entryId: string, page = 1, limit = 20) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    const skip = (page - 1) * limit;
    const where = { entryId };

    const [notes, total] = await Promise.all([
      (prisma as any).walletEntryNote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).walletEntryNote.count({ where }),
    ]);

    // Resolve admin names
    const adminIds = [...new Set(notes.map((n: any) => n.adminId).filter(Boolean))] as string[];
    const admins = adminIds.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a.fullName]));

    return {
      notes: notes.map((n: any) => ({
        id: n.id,
        note: n.note,
        adminId: n.adminId,
        adminName: adminMap.get(n.adminId) || n.adminId,
        createdAt: n.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Link a transaction to an unmatched wallet entry.
   */
  async linkTransaction(walletId: string, entryId: string, transactionId: string, adminId: string, reason: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    // Verify transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, referenceNumber: true },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        linkedTransactionId: transactionId,
        linkReason: reason,
        matchStatus: "MATCHED",
      },
    });

    logger.info("Transaction linked to wallet entry", {
      walletId,
      entryId,
      transactionId,
      adminId,
      reason,
    });

    return {
      id: updated.id,
      linkedTransactionId: updated.linkedTransactionId,
      linkReason: updated.linkReason,
      matchStatus: updated.matchStatus,
      message: "Transaction linked successfully",
    };
  }

  /**
   * Automatically link a transaction to an unmatched wallet entry.
   */
  async autoLinkTransaction(walletId: string, entryId: string, adminId: string, reason?: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      throw new Error("Wallet entry not found");
    }

    if (entry.matchStatus === "MATCHED" || entry.linkedTransactionId) {
      throw new Error("Wallet entry is already matched");
    }

    const wallet = await prisma.customerWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    let matchingTransactions: any[] = [];

    // Try to find by transactionRef first if it exists
    if (entry.transactionRef) {
      const txByRef = await prisma.transaction.findFirst({
        where: {
          userId: wallet.userId,
          referenceNumber: entry.transactionRef,
        },
      });
      if (txByRef) {
        matchingTransactions = [txByRef];
      }
    }

    // If no match by ref, try matching by amount and status
    if (matchingTransactions.length === 0) {
      matchingTransactions = await prisma.transaction.findMany({
        where: {
          userId: wallet.userId,
          status: {
            in: ["AWAITING_DEPOSIT", "PENDING_RECORD_VALIDATION", "DRAFT", "DEPOSIT_PENDING"]
          },
          OR: [
            { nairaEquivalent: entry.amount },
            { foreignAmount: entry.amount },
            { amountPaid: entry.amount },
            { balanceDue: entry.amount }
          ],
        },
      });
    }

    if (matchingTransactions.length === 0) {
      throw new Error("Could not find any matching transaction to auto-link");
    }

    if (matchingTransactions.length > 1) {
      throw new Error("Multiple matching transactions found. Please link manually.");
    }

    const transaction = matchingTransactions[0];

    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        linkedTransactionId: transaction.id,
        linkReason: reason || "Auto-linked by system",
        matchStatus: "MATCHED",
      },
    });

    logger.info("Transaction auto-linked to wallet entry", {
      walletId,
      entryId,
      transactionId: transaction.id,
      adminId,
      reason: updated.linkReason,
    });

    return {
      id: updated.id,
      linkedTransactionId: updated.linkedTransactionId,
      linkReason: updated.linkReason,
      matchStatus: updated.matchStatus,
      message: "Transaction auto-linked successfully",
      transactionRef: transaction.referenceNumber,
    };
  }

  /**
   * Unlink a transaction from a wallet entry.
   */
  async unlinkTransaction(walletId: string, entryId: string, adminId: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        linkedTransactionId: null,
        linkReason: null,
        matchStatus: "UNMATCHED",
      },
    });

    logger.info("Transaction unlinked from wallet entry", {
      walletId,
      entryId,
      adminId,
    });

    return {
      id: updated.id,
      linkedTransactionId: null,
      linkReason: null,
      matchStatus: updated.matchStatus,
      message: "Transaction unlinked successfully",
    };
  }

  /**
   * Flag a wallet entry for review.
   */
  async flagEntry(walletId: string, entryId: string, adminId: string, reason: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        isFlagged: true,
        flagReason: reason,
        flaggedBy: adminId,
        flaggedAt: new Date(),
      },
    });

    if (entry.transactionId) {
      const tx = await (prisma as any).transaction.findUnique({
        where: { id: entry.transactionId },
      });
      if (tx) {
           
        await (prisma as any).transactionHistory.create({
          data: {
            transactionId: entry.transactionId,
            action: "ADMIN_FLAGGED",
            performedBy: adminId,
            notes: `Transaction flagged via wallet entry: ${reason}`,
          },
        });
      }
    }

    logger.info("Wallet entry flagged", { walletId, entryId, adminId, reason });

    return {
      id: updated.id,
      isFlagged: true,
      flagReason: reason,
      flaggedAt: updated.flaggedAt,
      message: "Entry flagged successfully",
    };
  }

  /**
   * Initiate a refund for a wallet entry.
   */
  async initiateRefund(walletId: string, entryId: string, adminId: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    if (entry.refundStatus === "COMPLETED") {
      throw new Error("Entry has already been refunded");
    }
    if (entry.refundStatus === "PENDING_APPROVAL") {
      throw new Error("Refund is already pending approval");
    }

    // Attach workflow first
    const attached = await workflowService.attachWorkflowToRefund(entryId);

    if (!attached) {
      // Auto approve / process immediately if no workflow template exists for REFUND
      return this.executeRefundTransaction(walletId, entryId, adminId);
    }

    // Updated with PENDING_APPROVAL status and initiator
    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        refundedBy: adminId,
        refundStatus: "PENDING_APPROVAL",
        refundedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      refundStatus: "PENDING_APPROVAL",
      refundedBy: adminId,
      refundedAt: updated.refundedAt,
      message: "Refund initiated and queued for approval",
    };
  }

  /**
   * Execute the actual refund transaction (ledger entries & wallet balance adjustments).
   */
  async executeRefundTransaction(walletId: string, entryId: string, adminId: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });
    if (!entry) throw new Error("Entry not found");
    if (entry.refundStatus === "COMPLETED") throw new Error("Entry has already been refunded");

    const wallet = await (prisma as any).customerWallet.findUnique({
      where: { id: walletId },
    });

    const balanceBefore = Number(wallet.balance);
    const refundAmount = Number(entry.amount);
    const isDebit = entry.type === "DEBIT";
    const balanceAfter = isDebit ? balanceBefore + refundAmount : balanceBefore - refundAmount;

    // Create reversal entry and update wallet balance in a transaction
    const [updatedEntry, _reversalEntry, _updatedWallet] = await (prisma as any).$transaction([
      (prisma as any).walletEntry.update({
        where: { id: entryId },
        data: {
          refundStatus: "COMPLETED",
          refundedBy: adminId,
          refundedAt: new Date(),
          currentWorkflowStageId: null,
        },
      }),
      (prisma as any).walletEntry.create({
        data: {
          walletId,
          transactionId: entry.transactionId,
          transactionRef: entry.transactionRef,
          sessionId: `REFUND-${entry.transactionRef}`,
          type: isDebit ? "CREDIT" : "DEBIT",
          amount: refundAmount,
          balanceBefore,
          balanceAfter,
          description: `Refund for entry ${entry.id}`,
          status: "COMPLETED",
          matchStatus: "MATCHED",
          metadata: { isRefund: true, refundOf: entryId },
        },
      }),
      (prisma as any).customerWallet.update({
        where: { id: walletId },
        data: { balance: balanceAfter },
      }),
    ]);

    logger.info("Wallet entry refunded", { walletId, entryId, adminId, refundAmount });

    return {
      id: updatedEntry.id,
      refundStatus: "COMPLETED",
      refundedAt: updatedEntry.refundedAt,
      message: "Refund initiated successfully",
    };
  }

  async approveRefund(walletId: string, entryId: string, adminId: string, reason?: string) {
    const client: any = prisma as any;
    const entry = await client.walletEntry.findFirst({
      where: { id: entryId, walletId },
      select: {
        id: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        refundStatus: true,
      }
    });

    if (!entry) throw new Error("Entry not found");
    if (entry.refundStatus === "COMPLETED") throw new Error("Refund is already completed");

    if (entry.workflowTemplateId && entry.currentWorkflowStageId) {
      const workflow = await client.workflowTemplate.findUnique({
        where: { id: entry.workflowTemplateId },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: { assignees: true }
          }
        }
      });

      if (workflow) {
        const currentStageIndex = workflow.stages.findIndex((s: any) => s.id === entry.currentWorkflowStageId);
        if (currentStageIndex === -1) {
          throw new Error("Refund is in an invalid workflow stage.");
        }

        const currentStage = workflow.stages[currentStageIndex];
        const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
        if (!isAssigned) {
          throw new Error("You are not authorized to approve this refund at its current stage.");
        }

        if (currentStageIndex + 1 < workflow.stages.length) {
          const nextStage = workflow.stages[currentStageIndex + 1];
          await client.walletEntry.update({
            where: { id: entryId },
            data: { currentWorkflowStageId: nextStage.id }
          });
          return { message: "Refund advanced to the next approval stage" };
        }
      }
    }

    // Final approval: Execute the refund transaction
    await this.executeRefundTransaction(walletId, entryId, adminId);
    return { message: "Refund approved and processed successfully" };
  }

  async rejectRefund(walletId: string, entryId: string, adminId: string, reason: string) {
    const client: any = prisma as any;
    const entry = await client.walletEntry.findFirst({
      where: { id: entryId, walletId },
      select: {
        id: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        refundStatus: true,
      }
    });

    if (!entry) throw new Error("Entry not found");
    if (entry.refundStatus === "COMPLETED") throw new Error("Refund is already completed");

    if (entry.workflowTemplateId && entry.currentWorkflowStageId) {
      const workflow = await client.workflowTemplate.findUnique({
        where: { id: entry.workflowTemplateId },
        include: { stages: { include: { assignees: true } } }
      });

      if (workflow) {
        const currentStage = workflow.stages.find((s: any) => s.id === entry.currentWorkflowStageId);
        if (currentStage) {
          const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
          if (!isAssigned) {
            throw new Error("You are not authorized to reject this refund at its current stage.");
          }
        }
      }
    }

    await client.walletEntry.update({
      where: { id: entryId },
      data: {
        refundStatus: "FAILED",
        currentWorkflowStageId: null,
      }
    });

    return { message: "Refund rejected successfully" };
  }

  /**
   * Confirm disbursement for a wallet entry.
   */
  async confirmDisbursement(walletId: string, entryId: string, adminId: string) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    if (entry.disbursementStatus === "COMPLETED") {
      throw new Error("Entry has already been disbursed");
    }

    const updated = await (prisma as any).walletEntry.update({
      where: { id: entryId },
      data: {
        disbursementStatus: "COMPLETED",
        disbursedBy: adminId,
        disbursedAt: new Date(),
      },
    });

    const targetTrxId = entry.linkedTransactionId || entry.transactionId;
    if (targetTrxId) {
      await (prisma as any).transaction.update({
        where: { id: targetTrxId },
        data: {
          status: "COMPLETED",
          currentStep: "COMPLETED",
          completedAt: new Date(),
          updatedAt: new Date(),
        }
      });

      await (prisma as any).transactionHistory.create({
        data: {
          transactionId: targetTrxId,
          action: "DISBURSEMENT_CONFIRMED",
          performedBy: adminId,
          notes: "Disbursement confirmed",
        },
      });
    }

    logger.info("Wallet entry disbursement confirmed", { walletId, entryId, adminId });

    return {
      id: updated.id,
      disbursementStatus: "COMPLETED",
      disbursedAt: updated.disbursedAt,
      message: "Disbursement confirmed successfully",
    };
  }

  /**
   * Get audit logs for a wallet ledger entry.
   */
  async getEntryAuditLogs(walletId: string, entryId: string, page = 1, limit = 20) {
    const entry = await (prisma as any).walletEntry.findFirst({
      where: { id: entryId, walletId },
    });

    if (!entry) {
      return null;
    }

    const skip = (page - 1) * limit;
    const where: any = {
      resourceType: "WALLET",
      resourceId: walletId,
      metadata: {
        path: ["entryId"],
        equals: entryId,
      } as any,
    };

    const client: any = prisma as any;
    const [actions, total] = await Promise.all([
      client.adminAction.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip,
        take: limit,
        include: {
          admin: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
      client.adminAction.count({ where }),
    ]);

    return {
      logs: actions.map((a: any) => ({
        id: a.id,
        adminId: a.adminId,
        adminName: a.admin?.fullName || null,
        adminEmail: a.admin?.email || null,
        actionType: a.actionType,
        actionLabel: a.actionLabel,
        previousState: a.previousState,
        newState: a.newState,
        reason: a.reason || a.metadata?.reason || null,
        metadata: a.metadata,
        status: a.status,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        performedAt: a.performedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const adminWalletService = new AdminWalletService();
