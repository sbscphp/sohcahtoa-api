# Transaction Workflow Implementation Plan

## Summary
Based on the compliance and customer journey requirements, this document outlines the implementation plan for updating the transaction workflow system.

---

## 📋 Current Status

✅ **Completed:**
- Basic transaction workflow with statuses
- Document upload system
- Transaction history tracking
- Providus payment integration
- Settlement system

❌ **Missing (To Implement):**
- Document approval before payment
- Mandatory document number fields (BVN, NIN, Passport details)
- Email notifications for document approval/rejection
- Receipt generation system (initial + final)
- Source of funds declaration
- Invoice upload
- Pickup date/time selection
- Information confirmation
- Third-party API verification for PTA

---

## 🗄️ Database Schema Changes

### 1. Update Transaction Model

Add the following fields to the `Transaction` model:

```prisma
model Transaction {
  // ... existing fields

  // Mandatory Document Numbers
  bvnNumber              String?
  ninNumber              String?
  formANumber            String?
  passportNumber         String?
  passportIssueDate      DateTime?
  passportExpiryDate     DateTime?

  // BTA Specific
  tccNumber              String?
  companyLetterUrl       String?

  // Invoice & Confirmation
  invoiceUrl             String?
  informationConfirmed   Boolean              @default(false)
  informationConfirmedAt DateTime?

  // Pickup Details
  pickupDate             DateTime?
  pickupTime             String?

  // Document Approval Workflow
  documentApprovalStatus DocumentApprovalStatus @default(PENDING)
  documentApprovedAt     DateTime?
  documentApprovedBy     String?
  documentRejectionReason String?
  documentReviewSLA      DateTime?            // Expected review completion time

  // Receipts
  initialReceiptUrl      String?
  initialReceiptNumber   String?
  finalReceiptUrl        String?
  finalReceiptNumber     String?

  // Relations
  sourceOfFundsDeclaration SourceOfFundsDeclaration?
  receipts               TransactionReceipt[]
}
```

### 2. Create New Enums

```prisma
enum DocumentApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  REQUIRES_RESUBMISSION
}
```

### 3. Create New Models

#### Source of Funds Declaration
```prisma
model SourceOfFundsDeclaration {
  id                String      @id @default(uuid())
  transactionId     String      @unique
  transaction       Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  fullName          String
  sourceDescription String      @db.Text
  signatureType     String      // 'INITIALS' | 'UPLOADED'
  signatureUrl      String?
  initials          String?

  declaredAt        DateTime    @default(now())
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([transactionId])
  @@map("source_of_funds_declarations")
}
```

#### Transaction Receipt
```prisma
model TransactionReceipt {
  id              String      @id @default(uuid())
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  type            ReceiptType
  receiptNumber   String      @unique
  receiptUrl      String

  amount          Decimal     @db.Decimal(18, 2)
  currency        String
  status          String

  exchangeRate    Decimal?    @db.Decimal(18, 6)
  beneficiaryName String?

  issuedAt        DateTime    @default(now())
  stampedBy       String

  metadata        Json?
  createdAt       DateTime    @default(now())

  @@index([transactionId])
  @@index([receiptNumber])
  @@index([type])
  @@map("transaction_receipts")
}

enum ReceiptType {
  INITIAL
  FINAL
}
```

### 4. Update ExpatriateProfile (if doesn't exist, create it)

```prisma
model ExpatriateProfile {
  id                   String   @id @default(uuid())
  userId               String   @unique

  workPermitUrl        String?
  workPermitNumber     String?
  workPermitIssueDate  DateTime?
  workPermitExpiryDate DateTime?

  taxIdForExpatriate   String?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([userId])
  @@map("expatriate_profiles")
}
```

---

## 🔌 API Endpoints to Create

### Document Approval Endpoints

```typescript
// Admin endpoints
POST   /api/admin/transactions/:id/documents/approve
POST   /api/admin/transactions/:id/documents/reject
GET    /api/admin/transactions/pending-approval
POST   /api/admin/transactions/:id/documents/request-resubmission

// Customer endpoints
GET    /api/customer/transactions/:id/document-status
POST   /api/customer/transactions/:id/documents/resubmit
```

### Receipt Endpoints

```typescript
// Customer endpoints
GET    /api/customer/transactions/:id/receipts/initial
GET    /api/customer/transactions/:id/receipts/final
GET    /api/customer/receipts/:receiptNumber/download

// Admin endpoints
POST   /api/admin/receipts/generate
GET    /api/admin/receipts/:id
```

### Source of Funds Endpoints

```typescript
POST   /api/customer/transactions/:id/source-of-funds
GET    /api/customer/transactions/:id/source-of-funds
PUT    /api/customer/transactions/:id/source-of-funds
```

### Third-Party Verification Endpoints

```typescript
// PTA Auto-verification
POST   /api/verification/pta/auto-verify
POST   /api/verification/bvn/validate
POST   /api/verification/nin/validate
POST   /api/verification/passport/validate
```

### Updated Transaction Endpoints

```typescript
// Add these fields to existing create/update endpoints
POST   /api/customer/transactions
PUT    /api/customer/transactions/:id

// New body fields:
{
  // Mandatory document numbers
  bvnNumber: string,
  ninNumber: string,
  formANumber: string,
  passportNumber: string,
  passportIssueDate: Date,
  passportExpiryDate: Date,

  // BTA specific
  tccNumber?: string,
  companyLetterUrl?: string,

  // General
  invoiceUrl?: string,
  informationConfirmed: boolean,

  // Pickup
  pickupDate?: Date,
  pickupTime?: string,
}
```

---

## 📧 Email Notifications to Implement

### 1. Transaction Submitted Confirmation
**Trigger**: After customer submits transaction with documents
**Template**: `transaction-submitted.html`
**Content**:
- Transaction reference number
- Expected review timeline (24-48 hours)
- List of submitted documents
- Next steps
- Contact information

### 2. Documents Approved
**Trigger**: Admin approves documents
**Template**: `documents-approved.html`
**Content**:
- Approval notification
- "Please proceed to payment" CTA
- Payment instructions
- Virtual account details (from Providus)
- Payment deadline (48 hours)

### 3. Documents Rejected
**Trigger**: Admin rejects documents
**Template**: `documents-rejected.html`
**Content**:
- Rejection notification
- Reason for rejection
- List of issues found
- Re-submission instructions
- Support contact

### 4. Initial Receipt
**Trigger**: Payment received successfully
**Template**: `initial-receipt.html`
**Content**:
- Receipt attachment (PDF)
- Transaction reference
- Amount paid
- Payment method
- Status: "Processing"
- Download link

### 5. Final Receipt
**Trigger**: Transaction completed/settled
**Template**: `final-receipt.html`
**Content**:
- Final receipt attachment (PDF)
- Transaction summary
- Exchange rate applied
- Amount disbursed
- Beneficiary details
- Completion date
- Download link

---

## 🔨 Services to Create/Update

### 1. DocumentApprovalService
**Location**: `src/modules/transactions/services/document-approval.service.ts`

```typescript
class DocumentApprovalService {
  async approveDocuments(transactionId: string, approvedBy: string): Promise<Transaction>
  async rejectDocuments(transactionId: string, reason: string, rejectedBy: string): Promise<Transaction>
  async requestResubmission(transactionId: string, issues: string[], requestedBy: string): Promise<Transaction>
  async getPendingApprovals(limit: number, offset: number): Promise<{ transactions: Transaction[], total: number }>
}
```

### 2. ReceiptGenerationService
**Location**: `src/modules/transactions/services/receipt-generation.service.ts`

```typescript
class ReceiptGenerationService {
  async generateInitialReceipt(transactionId: string): Promise<TransactionReceipt>
  async generateFinalReceipt(transactionId: string): Promise<TransactionReceipt>
  async stampReceipt(receiptId: string, stampedBy: string): Promise<string>
  async getReceipt(receiptNumber: string): Promise<TransactionReceipt>
}
```

### 3. SourceOfFundsService
**Location**: `src/modules/transactions/services/source-of-funds.service.ts`

```typescript
class SourceOfFundsService {
  async createDeclaration(transactionId: string, data: CreateSourceOfFundsDto): Promise<SourceOfFundsDeclaration>
  async getDeclaration(transactionId: string): Promise<SourceOfFundsDeclaration | null>
  async updateDeclaration(transactionId: string, data: UpdateSourceOfFundsDto): Promise<SourceOfFundsDeclaration>
}
```

### 4. ThirdPartyVerificationService
**Location**: `src/modules/verification/services/third-party-verification.service.ts`

```typescript
class ThirdPartyVerificationService {
  async verifyBVN(bvnNumber: string, firstName: string, lastName: string): Promise<BVNVerificationResult>
  async verifyNIN(ninNumber: string, firstName: string, lastName: string): Promise<NINVerificationResult>
  async verifyPassport(passportNumber: string, firstName: string, lastName: string): Promise<PassportVerificationResult>
  async autoVerifyPTA(transactionId: string): Promise<PTAVerificationResult>
}
```

### 5. Update TransactionService
**Location**: `src/modules/customer/services/transaction.service.ts`

Add validation for:
- Mandatory fields (BVN, NIN, Form A, Passport with dates)
- Information confirmation checkbox
- Transaction-type specific requirements (PTA vs BTA)

---

## 🎨 PDF Template for Receipts

### Initial Receipt Template
**File**: `src/templates/receipts/initial-receipt.html`

**Content**:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Professional receipt styling */
    body { font-family: Arial, sans-serif; }
    .header { text-align: center; border-bottom: 2px solid #000; }
    .logo { width: 200px; }
    .stamp { position: absolute; right: 50px; top: 100px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="header">
    <img src="logo.png" class="logo" />
    <h1>SOHCAHTOA FX</h1>
    <p>Transaction Receipt (Initial)</p>
  </div>

  <div class="stamp">
    <img src="stamp.png" />
  </div>

  <div class="content">
    <p><strong>Receipt Number:</strong> {{ receiptNumber }}</p>
    <p><strong>Date Issued:</strong> {{ issuedDate }}</p>
    <p><strong>Transaction Reference:</strong> {{ transactionRef }}</p>
    <p><strong>Amount Paid:</strong> ₦{{ amount }}</p>
    <p><strong>Payment Method:</strong> {{ paymentMethod }}</p>
    <p><strong>Status:</strong> Processing</p>
  </div>

  <div class="footer">
    <p>This receipt confirms payment has been received. Final receipt will be issued upon transaction completion.</p>
    <p><strong>Signature:</strong> ___________________</p>
    <p><strong>Date:</strong> {{ signedDate }}</p>
  </div>
</body>
</html>
```

### Final Receipt Template
Similar structure but with complete transaction details and exchange rate information.

---

## 🔄 Updated Transaction Workflow Logic

### Current Flow:
```
DRAFT → AWAITING_VERIFICATION → DEPOSIT_CONFIRMED → COMPLETED
```

### New Flow:
```
1. DRAFT (Customer fills form)
   ↓
2. DOCUMENTS_SUBMITTED (All docs uploaded with numbers)
   ↓
3. AWAITING_DOCUMENT_APPROVAL (Admin reviews)
   ↓
   ├─ DOCUMENTS_APPROVED → Email: "Proceed to payment"
   │  ↓
   │  4. AWAITING_DEPOSIT (Virtual account generated)
   │  ↓
   │  5. DEPOSIT_CONFIRMED (Payment received)
   │  ↓
   │  6. Initial Receipt Generated & Sent
   │  ↓
   │  7. DISBURSEMENT_IN_PROGRESS
   │  ↓
   │  8. COMPLETED
   │  ↓
   │  9. Final Receipt Generated & Sent
   │
   └─ DOCUMENTS_REJECTED → Email: "Resubmit documents"
      ↓
      Back to DOCUMENTS_SUBMITTED
```

### For PTA (Auto-verified):
```
1. DRAFT
   ↓
2. DOCUMENTS_SUBMITTED
   ↓
3. AUTO_VERIFICATION_IN_PROGRESS (Third-party APIs)
   ↓
   ├─ VERIFICATION_PASSED → Skip to AWAITING_DEPOSIT
   │
   └─ VERIFICATION_FAILED → AWAITING_DOCUMENT_APPROVAL (Manual review)
```

---

## 🧪 Testing Plan

### Unit Tests
- [ ] Document approval service
- [ ] Receipt generation service
- [ ] Source of funds service
- [ ] Third-party verification service
- [ ] Email notification service

### Integration Tests
- [ ] Complete transaction flow (PTA with auto-verify)
- [ ] Complete transaction flow (BTA with manual approval)
- [ ] Document rejection and resubmission flow
- [ ] Receipt generation and download
- [ ] Email notifications sent correctly

### E2E Tests
- [ ] Customer submits transaction → Receives confirmation email
- [ ] Admin approves documents → Customer receives approval email
- [ ] Customer makes payment → Receives initial receipt
- [ ] Transaction completes → Receives final receipt
- [ ] Document rejection → Resubmission flow

---

## 📅 Implementation Timeline Estimate

### Phase 1: Database & Core (1-2 weeks)
- [ ] Update Prisma schema
- [ ] Run migrations
- [ ] Create new services (DocumentApproval, Receipt, SourceOfFunds)

### Phase 2: API Endpoints (1 week)
- [ ] Document approval endpoints
- [ ] Receipt endpoints
- [ ] Source of funds endpoints
- [ ] Update transaction create/update endpoints

### Phase 3: Email & PDF (1 week)
- [ ] Email templates
- [ ] PDF receipt generation
- [ ] Email sending integration

### Phase 4: Third-Party Integration (1-2 weeks)
- [ ] BVN API integration
- [ ] NIN API integration
- [ ] Passport API integration
- [ ] PTA auto-verification logic

### Phase 5: Testing & Polish (1 week)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Bug fixes

**Total Estimated Time: 5-7 weeks**

---

## 🎯 Quick Wins (Can implement immediately)

1. **Add document number fields**
   - Quick schema update
   - Frontend form fields
   - Validation

2. **Information confirmation checkbox**
   - Simple boolean field
   - Frontend checkbox
   - Validation before submission

3. **Pickup date/time fields**
   - Two new fields (date + time)
   - Frontend date/time pickers

4. **Invoice upload**
   - Reuse existing document upload system
   - Add INVOICE document type

5. **Email notifications (basic)**
   - Use existing notification service
   - Create email templates

---

## 📝 Notes for Mobile Designer Meeting

### Topics to Discuss:
1. **Document Number Input Fields**
   - Where to place (inline with upload or separate section)
   - Validation messaging
   - Auto-formatting (BVN: 11 digits, NIN: 11 digits, etc.)

2. **Passport Date Pickers**
   - Issue date vs Expiry date placement
   - Validation (expiry must be future date)

3. **Invoice Upload Flow**
   - Separate step or inline with beneficiary details?
   - Preview functionality

4. **Confirmation Checkbox**
   - Placement before final submission
   - Wording

5. **Pickup DateTime Selection**
   - Combined picker or separate fields
   - Available time slots display

6. **Source of Funds Declaration**
   - Form design
   - Signature capture (initials vs upload)

7. **Receipt Display**
   - In-app preview
   - Download button placement
   - Email attachment

8. **Timeline Messaging**
   - Where to show "24-48 hour review" message
   - Progress indicators

9. **Document Approval Status**
   - Visual indicators (pending/approved/rejected)
   - Notification badges

10. **Minimal Disruption Strategy**
    - Phased rollout plan
    - Which changes can be additive
    - Which require flow changes

---

**Document Created**: 2026-03-14
**Status**: Planning Phase
**Next Steps**: Review with team, prioritize implementation phases
