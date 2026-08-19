# Providus Bank Integration - Virtual Account System

## Overview

This integration enables automated deposit collection through Providus Bank's virtual account system. When a customer's transaction is approved, a unique virtual account is generated for them to deposit Naira. The system automatically verifies and confirms deposits.

## Flow Diagram

```
1. Customer creates transaction
2. Transaction goes through verification & document approval
3. Admin approves transaction
   ↓
4. System generates virtual account (Providus API)
   ↓
5. Customer receives account details
   ↓
6. Customer transfers Naira to virtual account
   ↓
7. Providus sends webhook notification
   ↓
8. System verifies deposit (Providus API)
   ↓
9. Transaction status updated to DEPOSIT_CONFIRMED
   ↓
10. Transaction proceeds to disbursement
```

## Session Verification and Wallet Matching

The Providus `sessionId` is the payment verification key. A webhook can create a wallet credit, but the credit is not considered matched until that session ID is verified successfully. Failed or delayed verification leaves the credit pending.

Admin disbursements and refunds use separate provider session IDs because they are outbound payments to the customer. The admin must supply the session ID when confirming the disbursement or completing the refund. After successful verification, the application creates the corresponding wallet debit with `status: COMPLETED`, `matchStatus: MATCHED`, and the verified session ID.

In simulation mode, session verification returns a successful simulated payment response, so the same workflow can be exercised without a live Providus transaction.

## Environment Variables

Add these to your `.env` file:

```bash
# Providus Bank Configuration
PROVIDUS_BASE_URL=https://api.providusbank.com
PROVIDUS_CLIENT_ID=your_providus_client_id
PROVIDUS_CLIENT_SECRET=your_providus_client_secret
```

## Database Schema

### VirtualAccount Model
Stores generated virtual accounts for transactions.

```typescript
{
  id: string
  userId: string?
  transactionId: string (unique)
  accountNumber: string (unique)
  accountName: string
  type: 'DYNAMIC' | 'RESERVED'
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
  bankName: string (default: "Providus Bank")
  initiationTranRef: string?
  bvn: string?
  isBlacklisted: boolean
  expiresAt: DateTime? (for dynamic accounts)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### ProvidusDeposit Model
Tracks deposits made to virtual accounts.

```typescript
{
  id: string
  virtualAccountId: string
  transactionId: string?
  sessionId: string (unique - Providus reference)
  settlementId: string?
  accountNumber: string
  amount: Decimal
  settledAmount: Decimal
  feeAmount: Decimal
  vatAmount: Decimal
  currency: string
  sourceAccountNumber: string?
  sourceAccountName: string?
  sourceBankName: string?
  status: 'PENDING' | 'VERIFIED' | 'SETTLED' | 'FAILED'
  verifiedAt: DateTime?
  webhookReceivedAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}
```

## API Endpoints

### Admin Endpoints

#### 1. Create Virtual Account (After Approval)
```http
POST /api/admin/virtual-accounts
Authorization: Bearer <admin_token>

{
  "transactionId": "uuid",
  "accountName": "SOHCAHTOA-(Customer Name)",
  "type": "DYNAMIC", // or "RESERVED"
  "expiresInHours": 48 // optional, default 48 hours
}
```

**Response:**
```json
{
  "success": true,
  "message": "Virtual account created successfully",
  "data": {
    "id": "uuid",
    "accountNumber": "9919286022",
    "accountName": "SOHCAHTOA-(Customer Name)",
    "bankName": "Providus Bank",
    "status": "ACTIVE",
    "expiresAt": "2026-03-15T14:00:00Z"
  }
}
```

#### 2. Get Virtual Account by Transaction
```http
GET /api/admin/virtual-accounts/transaction/{transactionId}
Authorization: Bearer <admin_token>
```

#### 3. Get Virtual Account by Account Number
```http
GET /api/admin/virtual-accounts/{accountNumber}
Authorization: Bearer <admin_token>
```

#### 4. Blacklist Virtual Account
```http
POST /api/admin/virtual-accounts/{accountNumber}/blacklist
Authorization: Bearer <admin_token>

{
  "reason": "Fraudulent activity detected"
}
```

#### 5. Manual Deposit Verification
```http
POST /api/admin/deposits/verify
Authorization: Bearer <admin_token>

{
  "sessionId": "204210202000000500001"
}
```

#### 6. Get Transaction Deposits
```http
GET /api/admin/deposits/transaction/{transactionId}
Authorization: Bearer <admin_token>
```

### Customer Endpoints

#### 1. Get Virtual Account for Transaction
```http
GET /api/customer/transactions/{transactionId}/virtual-account
Authorization: Bearer <customer_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "9919286022",
    "accountName": "SOHCAHTOA-(Customer Name)",
    "bankName": "Providus Bank",
    "status": "ACTIVE",
    "expiresAt": "2026-03-15T14:00:00Z",
    "deposits": []
  }
}
```

#### 2. Get Deposit Instructions
```http
GET /api/customer/transactions/{transactionId}/deposit-instructions
Authorization: Bearer <customer_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "9919286022",
    "accountName": "SOHCAHTOA-(Customer Name)",
    "bankName": "Providus Bank",
    "amount": "500000.00",
    "currency": "NGN",
    "expiresAt": "2026-03-15T14:00:00Z",
    "instructions": [
      "Transfer the exact amount specified to the account number provided",
      "Use your registered name as the sender name",
      "The account is valid for single use only",
      "Complete the transfer before Wed Mar 15 2026 14:00:00",
      "Your transaction will be automatically confirmed once the deposit is received",
      "Do not share this account number with anyone"
    ],
    "warningNote": "Please transfer the exact amount. Any discrepancy may delay processing."
  }
}
```

#### 3. Get Deposit Status
```http
GET /api/customer/transactions/{transactionId}/deposit-status
Authorization: Bearer <customer_token>
```

### Webhook Endpoints (Providus → Our System)

#### 1. Deposit Notification
```http
POST /api/webhooks/providus/deposit

{
  "sessionId": "204210202000000500001",
  "accountNumber": "9919286022",
  "transactionAmount": 500000.00,
  "settledAmount": 495000.00,
  "feeAmount": 5000.00,
  "vatAmount": 0.00,
  "currency": "NGN",
  "settlementId": "204210202000000500001",
  "sourceAccountNumber": "0123456789",
  "sourceAccountName": "John Doe",
  "sourceBankName": "Access Bank",
  "tranDateTime": "2/13/2021 4:11:09 PM"
}
```

#### 2. Health Check
```http
GET /api/webhooks/providus/health
```

## Integration Flow

### 1. After Admin Approves Transaction

When an admin approves a transaction (sets status to `APPROVED`), the virtual account should be generated:

```typescript
// In admin transaction approval controller
async approveTransaction(transactionId: string) {
  // Update transaction status
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'APPROVED' }
  });

  // Generate virtual account
  const virtualAccount = await virtualAccountService.createVirtualAccount({
    transactionId,
    accountName: `SOHCAHTOA-(${customerName})`,
    type: 'DYNAMIC',
    expiresInHours: 48
  });

  // Send notification to customer with account details
  await notificationService.sendNotification({
    userId: transaction.userId,
    type: 'PUSH',
    channel: 'ALL',
    title: 'Transaction Approved - Deposit Required',
    body: `Your transaction has been approved. Please deposit ₦${amount} to the account provided.`,
    data: {
      transactionId,
      accountNumber: virtualAccount.accountNumber,
      accountName: virtualAccount.accountName,
      amount: amount.toString()
    }
  });
}
```

### 2. Webhook Processing

Providus sends a webhook when a deposit is received:

1. **Webhook received** → `ProvidusWebhookController.handleDepositNotification()`
2. **Find virtual account** → Check if account exists and is active
3. **Create deposit record** → Save deposit details
4. **Verify with Providus** → Call verification API
5. **Match amount** → Compare expected vs received amount
6. **Update transaction** → Set status to `DEPOSIT_CONFIRMED`
7. **Create settlement** → Record the confirmed deposit
8. **Notify customer** → Send confirmation notification

### 3. Manual Verification (Fallback)

If webhook fails or for reconciliation:

```typescript
// Admin can manually verify using session ID
await depositVerificationService.manualVerifyDeposit(sessionId);
```

## Transaction Status Flow

```
DRAFT → AWAITING_VERIFICATION → ... → APPROVED
  ↓ (Virtual account created)
AWAITING_DEPOSIT
  ↓ (Customer deposits)
DEPOSIT_PENDING (if amount mismatch)
  or
DEPOSIT_CONFIRMED (amount matches)
  ↓
DISBURSEMENT_IN_PROGRESS → COMPLETED
```

## Error Handling

### Amount Mismatch
If the deposited amount doesn't match the expected amount:
- Transaction status set to `DEPOSIT_PENDING`
- Admin notification created for manual review
- Customer notified of discrepancy

### Blacklisted Account
If a deposit is received for a blacklisted account:
- Deposit rejected
- Error logged
- Admin notification sent

### Expired Account
Dynamic accounts expire after the specified hours:
- Cron job deactivates expired accounts
- Deposits to expired accounts are flagged

## Cron Jobs

### Deactivate Expired Accounts
Run daily to deactivate expired virtual accounts:

```typescript
// In cron job
import virtualAccountService from './modules/payments/services/virtual-account.service';

cron.schedule('0 0 * * *', async () => {
  const count = await virtualAccountService.deactivateExpiredAccounts();
  logger.info(`Deactivated ${count} expired virtual accounts`);
});
```

## Testing

### Test Virtual Account Creation
```bash
# After approving a transaction
curl -X POST http://localhost:3000/api/admin/virtual-accounts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "uuid",
    "accountName": "SOHCAHTOA-(Test User)"
  }'
```

### Test Webhook (Local)
```bash
curl -X POST http://localhost:3000/api/webhooks/providus/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-id",
    "accountNumber": "9919286022",
    "transactionAmount": 500000,
    "settledAmount": 495000,
    "feeAmount": 5000,
    "currency": "NGN"
  }'
```

## Production Deployment

1. **Add environment variables** to production environment
2. **Run database migration**: `npx prisma migrate deploy`
3. **Configure Providus webhook URL**: `https://yourdomain.com/api/webhooks/providus/deposit`
4. **Set up cron job** for expired account deactivation
5. **Test with small transaction** before going live

## Security Considerations

1. **Webhook Security**: Validate webhook signatures (currently not implemented - can be added)
2. **Amount Verification**: Always verify deposits with Providus API
3. **Account Blacklisting**: Implement fraud detection and blacklist suspicious accounts
4. **Expiry Management**: Ensure expired accounts are deactivated promptly
5. **Access Control**: Only admins can create/manage virtual accounts

## Troubleshooting

### Virtual Account Not Created
- Check if transaction status is `APPROVED`
- Verify Providus credentials are correct
- Check logs for API errors

### Webhook Not Received
- Verify webhook URL is configured in Providus dashboard
- Check firewall/security group settings
- Test webhook endpoint manually

### Deposit Not Confirmed
- Check if webhook was received (check logs)
- Manually verify using session ID
- Verify amount matches exactly

## Support

For Providus Bank API support:
- Documentation: [Providus API Docs]
- Support Email: support@providusbank.com
