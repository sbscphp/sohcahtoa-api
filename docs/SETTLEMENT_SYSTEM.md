# Settlement System - Outbound Payments

## Overview

The settlement system handles outbound payments from Sohcahtoa to beneficiaries (e.g., foreign institutions, partner banks, customers). This complements the Providus deposit system by managing the payment side of transactions.

## Key Concepts

### Settlement Types

1. **Inbound Settlements** - Deposits from customers (handled by Providus virtual accounts)
2. **Outbound Settlements** - Payouts to beneficiaries (handled by this system)

### Settlement Flow

```
1. Transaction approved & deposit confirmed
   ↓
2. Create outbound settlement
   ↓
3. Admin approval
   ↓
4. Process settlement (submit to bank/payment provider)
   ↓
5. Settlement completed
   ↓
6. Reconciliation
```

## Database Models

### SettlementBatch
Groups multiple settlements for bulk processing.

```typescript
{
  id: string
  batchNumber: string (unique, e.g., "BATCH-20260313-0001")
  direction: 'INBOUND' | 'OUTBOUND'
  totalAmount: Decimal
  totalCount: number
  currency: string
  status: SettlementStatus
  description: string
  createdBy: string
  approvedBy: string
  processedBy: string
  approvedAt: DateTime
  submittedAt: DateTime
  completedAt: DateTime
  failureReason: string
  metadata: JSON
}
```

### OutboundSettlement
Individual payout record.

```typescript
{
  id: string
  batchId: string (optional - can be standalone)
  transactionId: string (optional)
  referenceNumber: string (unique, e.g., "STL-1710339600000-123")
  amount: Decimal
  currency: string
  status: SettlementStatus

  // Beneficiary details
  beneficiaryName: string
  beneficiaryBank: string
  beneficiaryAccount: string
  beneficiarySwift: string
  beneficiaryIban: string
  beneficiaryCountry: string
  beneficiaryAddress: string

  // Payment details
  paymentMethod: string
  paymentReference: string
  paymentProof: string (URL)

  // Providus integration
  providusReference: string
  providusSessionId: string
  providusResponse: JSON

  // Processing timeline
  initiatedBy: string
  approvedBy: string
  processedBy: string
  initiatedAt: DateTime
  approvedAt: DateTime
  processedAt: DateTime
  completedAt: DateTime
  failedAt: DateTime
  failureReason: string
}
```

### SettlementReconciliation
Tracks reconciliation of settlements.

```typescript
{
  id: string
  settlementId: string
  reconciliationType: 'MANUAL' | 'AUTO' | 'PROVIDUS_VERIFY'
  expectedAmount: Decimal
  actualAmount: Decimal
  variance: Decimal
  status: 'PENDING' | 'MATCHED' | 'VARIANCE' | 'RESOLVED'
  providusData: JSON
  reconciledBy: string
  reconciledAt: DateTime
  notes: string
}
```

## Settlement Statuses

```
PENDING → Initial creation
REQUIRES_APPROVAL → Needs additional approval
PROCESSING → Approved, ready to process
SUBMITTED → Submitted to bank/provider
COMPLETED → Payment confirmed
FAILED → Payment failed
CANCELLED → Cancelled by admin
```

## API Endpoints

### Create Settlement
```http
POST /api/admin/settlement-management
Authorization: Bearer <admin_token>

{
  "transactionId": "uuid",  // optional - link to transaction
  "amount": 500000.00,
  "currency": "USD",
  "beneficiaryName": "University of Oxford",
  "beneficiaryBank": "HSBC Bank",
  "beneficiaryAccount": "12345678",
  "beneficiarySwift": "HSBCGB2L",
  "beneficiaryCountry": "UK",
  "paymentMethod": "SWIFT",
  "notes": "School fees payment for Spring 2026"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settlement created successfully",
  "data": {
    "id": "uuid",
    "referenceNumber": "STL-1710339600000-123",
    "amount": "500000.00",
    "currency": "USD",
    "status": "PENDING",
    "beneficiaryName": "University of Oxford",
    "createdAt": "2026-03-13T10:00:00Z"
  }
}
```

### Create Settlement Batch
```http
POST /api/admin/settlement-management/batches
Authorization: Bearer <admin_token>

{
  "direction": "OUTBOUND",
  "settlementIds": ["uuid1", "uuid2", "uuid3"],
  "description": "Daily school fees settlements - March 13, 2026"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settlement batch created successfully",
  "data": {
    "id": "uuid",
    "batchNumber": "BATCH-20260313-0001",
    "direction": "OUTBOUND",
    "totalAmount": "1500000.00",
    "totalCount": 3,
    "currency": "USD",
    "status": "PENDING"
  }
}
```

### Approve Settlement
```http
POST /api/admin/settlement-management/{id}/approve
Authorization: Bearer <admin_token>
```

### Process Settlement
```http
POST /api/admin/settlement-management/{id}/process
Authorization: Bearer <admin_token>
```

This submits the payment to the bank/payment provider.

### Complete Settlement
```http
POST /api/admin/settlement-management/{id}/complete
Authorization: Bearer <admin_token>

{
  "proofOfPayment": "https://storage.example.com/proof.pdf"
}
```

### List Settlements
```http
GET /api/admin/settlement-management?status=PENDING&limit=20&offset=0
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` - Filter by status
- `batchId` - Filter by batch
- `transactionId` - Filter by transaction
- `limit` - Results per page (default: 20, max: 100)
- `offset` - Page offset

### Get Settlement Details
```http
GET /api/admin/settlement-management/{id}
Authorization: Bearer <admin_token>
```

### List Batches
```http
GET /api/admin/settlement-management/batches?direction=OUTBOUND&limit=20
Authorization: Bearer <admin_token>
```

### Approve Batch
```http
POST /api/admin/settlement-management/batches/{id}/approve
Authorization: Bearer <admin_token>
```

### Process Batch
```http
POST /api/admin/settlement-management/batches/{id}/process
Authorization: Bearer <admin_token>
```

Processes all settlements in the batch. Returns success/failure count.

### Reconcile Settlement
```http
POST /api/admin/settlement-management/{id}/reconcile
Authorization: Bearer <admin_token>

{
  "actualAmount": 500000.00,
  "providusSessionId": "optional-session-id",
  "notes": "Confirmed via bank statement"
}
```

### Reconcile Batch
```http
POST /api/admin/settlement-management/batches/{id}/reconcile
Authorization: Bearer <admin_token>
```

### Get Pending Reconciliations
```http
GET /api/admin/settlement-management/reconciliations/pending?limit=20&offset=0
Authorization: Bearer <admin_token>
```

### Get Reconciliation Report
```http
GET /api/admin/settlement-management/reconciliations/report?startDate=2026-03-01&endDate=2026-03-31
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 150,
      "matched": 145,
      "variance": 3,
      "pending": 2,
      "resolved": 3,
      "totalVarianceAmount": 250.00
    },
    "reconciliations": [...]
  }
}
```

### Resolve Variance
```http
POST /api/admin/settlement-management/reconciliations/{id}/resolve
Authorization: Bearer <admin_token>

{
  "resolution": "Variance due to bank fees. Approved by finance manager."
}
```

## Usage Examples

### Single Transaction Settlement

When a transaction is approved and deposit confirmed, create settlement for the beneficiary:

```typescript
// After deposit confirmed
const settlement = await settlementService.createOutboundSettlement({
  transactionId: transaction.id,
  amount: transaction.foreignAmount,
  currency: transaction.currency,
  beneficiaryName: transaction.beneficiaryName,
  beneficiaryBank: transaction.beneficiaryBank,
  beneficiaryAccount: transaction.beneficiaryAccount,
  beneficiarySwift: transaction.beneficiarySwift,
  beneficiaryCountry: transaction.destinationCountry,
  paymentMethod: 'SWIFT',
  initiatedBy: adminUserId,
  notes: `Settlement for transaction ${transaction.referenceNumber}`
});
```

### Batch Processing Workflow

```typescript
// 1. Create multiple settlements
const settlement1 = await settlementService.createOutboundSettlement({...});
const settlement2 = await settlementService.createOutboundSettlement({...});
const settlement3 = await settlementService.createOutboundSettlement({...});

// 2. Create batch
const batch = await settlementService.createSettlementBatch({
  direction: 'OUTBOUND',
  settlementIds: [settlement1.id, settlement2.id, settlement3.id],
  description: 'Daily school fees batch',
  createdBy: adminUserId
});

// 3. Approve batch
await settlementService.approveSettlementBatch(batch.id, supervisorId);

// 4. Process batch
const result = await settlementService.processSettlementBatch(batch.id, financeOfficerId);
// result = { batch, results: { successful: 3, failed: 0, errors: [] } }

// 5. Reconcile batch
const reconcileResults = await reconciliationService.reconcileBatch(batch.id, accountantId);
// reconcileResults = { total: 3, matched: 3, variance: 0, pending: 0, errors: [] }
```

### Manual Reconciliation

```typescript
// Reconcile a settlement with bank statement data
await reconciliationService.reconcileSettlement({
  settlementId: settlement.id,
  actualAmount: 499950.00, // From bank statement
  notes: 'Bank deducted $50 processing fee',
  reconciledBy: adminUserId
});
```

### Providus Verification

```typescript
// Verify settlement using Providus session ID
await reconciliationService.reconcileSettlement({
  settlementId: settlement.id,
  providusSessionId: 'PROV-123456789',
  reconciledBy: adminUserId
});
// System automatically fetches actual amount from Providus
```

## Integration Points

### 1. Transaction Completion

When a transaction reaches `DEPOSIT_CONFIRMED` status, automatically create settlement:

```typescript
// In deposit verification service
if (transaction.status === 'DEPOSIT_CONFIRMED') {
  // Create settlement for beneficiary
  await settlementService.createOutboundSettlement({
    transactionId: transaction.id,
    amount: transaction.foreignAmount,
    currency: transaction.currency,
    beneficiaryName: transaction.beneficiaryDetails.name,
    beneficiaryBank: transaction.beneficiaryDetails.bank,
    beneficiaryAccount: transaction.beneficiaryDetails.account,
    // ... other details
    paymentMethod: transaction.disbursementMethod,
    initiatedBy: 'SYSTEM',
  });

  // Update transaction
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: 'DISBURSEMENT_IN_PROGRESS',
      currentStep: 'DISBURSEMENT'
    }
  });
}
```

### 2. Providus Integration

For settlements processed through Providus (if they support outbound payments):

```typescript
// In processSettlement method
const providusResult = await providusService.initiateTransfer({
  amount: settlement.amount,
  currency: settlement.currency,
  beneficiaryAccount: settlement.beneficiaryAccount,
  beneficiaryBank: settlement.beneficiaryBank,
  // ... other details
});

await prisma.outboundSettlement.update({
  where: { id: settlementId },
  data: {
    providusReference: providusResult.referenceNumber,
    providusSessionId: providusResult.sessionId,
    providusResponse: providusResult,
  }
});
```

### 3. Notifications

```typescript
// When settlement is completed
await notificationService.sendNotification({
  userId: transaction.userId,
  type: 'PUSH',
  channel: 'ALL',
  title: 'Payment Sent',
  body: `Your payment of ${settlement.currency} ${settlement.amount} to ${settlement.beneficiaryName} has been processed.`,
  data: {
    settlementId: settlement.id,
    transactionId: transaction.id,
    amount: settlement.amount.toString()
  }
});
```

## Reconciliation Process

### Automatic Reconciliation

Run daily to match settlements with bank statements:

```typescript
// Cron job
cron.schedule('0 2 * * *', async () => {
  // Get yesterday's date range
  const startDate = moment().subtract(1, 'day').startOf('day').toDate();
  const endDate = moment().subtract(1, 'day').endOf('day').toDate();

  // Get all submitted settlements from yesterday
  const settlements = await prisma.outboundSettlement.findMany({
    where: {
      status: 'SUBMITTED',
      processedAt: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // Auto-reconcile each
  for (const settlement of settlements) {
    try {
      await reconciliationService.createReconciliation(settlement.id, 'AUTO');
    } catch (error) {
      logger.error('Auto-reconciliation failed', { settlementId: settlement.id, error });
    }
  }
});
```

### Manual Reconciliation

For variances or failed auto-reconciliation:

1. Admin reviews pending reconciliations
2. Compares with bank statements
3. Reconciles with actual amount
4. Resolves any variances

## Security & Permissions

### Required Permissions

- **Create Settlement** - Operations Officer, Finance Manager
- **Approve Settlement** - Finance Manager, Senior Manager
- **Process Settlement** - Finance Officer, Senior Finance Manager
- **Complete Settlement** - Finance Officer (with proof)
- **Reconcile** - Accountant, Finance Manager
- **Resolve Variance** - Senior Finance Manager, CFO

### Audit Trail

All settlement operations are logged:

```typescript
await auditService.logEvent({
  eventType: 'SETTLEMENT_CREATED',
  category: 'PAYMENT',
  userId: adminUserId,
  resourceType: 'SETTLEMENT',
  resourceId: settlement.id,
  action: 'CREATE',
  metadata: {
    amount: settlement.amount,
    currency: settlement.currency,
    beneficiary: settlement.beneficiaryName
  }
});
```

## Error Handling

### Failed Settlements

When a settlement fails:

```typescript
{
  status: 'FAILED',
  failedAt: '2026-03-13T15:30:00Z',
  failureReason: 'Invalid beneficiary account number'
}
```

Admin can:
1. Review failure reason
2. Correct details
3. Create new settlement
4. Mark original as cancelled

### Variance Resolution

When reconciliation shows variance:

```typescript
{
  expectedAmount: 500000.00,
  actualAmount: 499950.00,
  variance: -50.00,
  status: 'VARIANCE'
}
```

Process:
1. Investigate variance (bank fees, exchange rate differences, etc.)
2. Add resolution notes
3. Mark as resolved
4. Update accounting records if needed

## Reports

### Daily Settlement Report

```typescript
const report = await settlementService.listSettlements({
  limit: 1000,
  offset: 0
});

// Group by status
const summary = {
  pending: report.settlements.filter(s => s.status === 'PENDING').length,
  processing: report.settlements.filter(s => s.status === 'PROCESSING').length,
  completed: report.settlements.filter(s => s.status === 'COMPLETED').length,
  failed: report.settlements.filter(s => s.status === 'FAILED').length,
  totalAmount: report.settlements.reduce((sum, s) => sum + Number(s.amount), 0)
};
```

### Reconciliation Report

```http
GET /api/admin/settlement-management/reconciliations/report?startDate=2026-03-01&endDate=2026-03-31
```

Shows:
- Total settlements reconciled
- Matched vs variance count
- Total variance amount
- Pending reconciliations
- Resolved variances

## Best Practices

1. **Batch Processing** - Group related settlements for efficient processing
2. **Dual Approval** - Require approval from different roles
3. **Daily Reconciliation** - Run automated reconciliation daily
4. **Proof of Payment** - Always attach proof when marking as complete
5. **Variance Investigation** - Investigate all variances promptly
6. **Regular Reports** - Review settlement reports daily/weekly
7. **Failed Settlement Handling** - Have clear process for failed settlements
8. **Notification** - Keep customers informed of payment status

## Files Created

- `prisma/schema.prisma` - SettlementBatch, OutboundSettlement, SettlementReconciliation models
- `src/modules/payments/services/settlement.service.ts` - Settlement management
- `src/modules/payments/services/settlement-reconciliation.service.ts` - Reconciliation
- `src/modules/admin/controllers/settlement-management.controller.ts` - Admin endpoints
- `src/modules/admin/routes/settlement-management.routes.ts` - Routes
- `docs/SETTLEMENT_SYSTEM.md` - This documentation

## Next Steps

1. Run database migration
2. Test settlement creation
3. Configure payment provider integration (Providus or other)
4. Set up reconciliation cron job
5. Configure permissions for different admin roles
6. Set up monitoring and alerts for failed settlements
