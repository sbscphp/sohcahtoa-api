# Transaction Workflow Requirements - Updated

## Overview
This document outlines the updated transaction workflow requirements to ensure compliance and improve customer experience.

---

## Core Workflow Changes

### 1. Document Approval Before Payment
- **Requirement**: All documents must be approved BEFORE customer proceeds to payment
- **Flow**:
  1. Customer submits transaction request with documents
  2. Documents undergo verification/approval
  3. Email notification sent to customer (approval/rejection)
  4. If approved → Customer proceeds to payment
  5. If rejected → Customer re-submits documents

### 2. Timeline Communication
- **Requirement**: Inform customers of expected review timeline
- **Implementation**:
  - Add SLA messaging in submission confirmation
  - Example: "Your documents will be reviewed within 24-48 hours"
  - Send reminder if approaching deadline

---

## Mandatory Fields for ALL Transaction Types

### Core Identity Documents (Required for all transactions):
1. **BVN** (Bank Verification Number)
   - Add input field for BVN number
   - API validation enabled

2. **NIN** (National Identification Number)
   - Add input field for NIN number
   - API validation enabled

3. **Form A ID**
   - Document upload
   - Add input field for Form A number

4. **International Passport**
   - Document upload
   - Add input fields:
     - Passport number
     - Issue date
     - Expiry date

---

## Transaction Type Specific Requirements

### PTA (Personal Travel Allowance)
**Changes:**
- ✅ Replace TIN with NIN
- ✅ BVN (with input field for API validation)
- ✅ NIN (with input field for API validation)
- ✅ Form A ID
- ✅ International Passport (with number, issue date, expiry date)
- **Automation**: Third-party APIs verify all requirements automatically
- **No manual approval needed if API verification passes**

### BTA (Business Travel Allowance)
**Changes:**
- ✅ Keep TIN (with input field for API validation)
- ✅ Replace "Upload Form A" with "Upload TCC (Tax Clearance Certificate)"
- ✅ Add: Company/Business confirmation letter (upload)
  - Letter should confirm payment purpose
- ✅ BVN (with input field)
- ✅ NIN (with input field)
- ✅ International Passport (with number, issue date, expiry date)

### School Fees
**Changes:**
- Page title: "School Fees"
- Select admission type specifies what's being paid for
- ✅ All mandatory fields (BVN, NIN, Form A, Passport)
- ✅ Beneficiary invoice upload (for verification)
- ✅ Confirmation checkbox: "I confirm the information provided is correct"

### Medical Bills (International Payment)
**Requirements:**
- ✅ All mandatory fields
- ✅ Use international money transfer parameters (check bank requirements)
- ✅ Invoice upload option for internet banking transaction confirmation
- ✅ Beneficiary details verification via uploaded invoice

### Selling FX
**Requirements:**
- ✅ All mandatory fields
- ✅ For Residents selling $10k+:
  - **Source of Fund Declaration Form** (inbuilt)
  - Form template:
    ```
    SOURCE OF FUNDS DECLARATION

    I, [Full Name], hereby declare that the funds being exchanged are sourced from:

    [Source description field]

    Signature: [Customer initials or uploaded signature]
    Date: [Auto-filled]
    ```
- ✅ If documents exist in DB, auto-populate fields

---

## Expatriate Onboarding
**Specific Requirements:**
1. International Passport
2. Work Permit (upload + number input)
3. Tax ID for Expatriate (input field)
4. BVN (input field)

---

## Cash Pickup Requirements
**For all transactions requiring pickup:**
- ✅ Pickup location
- ✅ Date of collection (date picker)
- ✅ Time of collection (time picker)

---

## Receipt & Documentation

### Initial Receipt (After First Payment Success)
- **Trigger**: First transaction inflow success
- **Content**:
  - Transaction reference number
  - Amount paid
  - Date/time
  - Payment method
  - Status: "Pending processing"
- **Delivery**: Email + downloadable PDF
- **Format**: Stamped and signed with issue date

### Final Receipt (After FX Settlement)
- **Trigger**: Complete FX flow completion/settlement
- **Content**:
  - All transaction details
  - Exchange rate applied
  - Amount disbursed
  - Beneficiary details
  - Completion date/time
- **Delivery**: Email + downloadable PDF
- **Format**: Stamped and signed with issue date

### Receipt Download Option
- Available in customer dashboard
- For both initial and final receipts
- PDF format with official stamp and signature

---

## Beneficiary Verification

### Invoice Upload
- **Purpose**: Easier beneficiary details verification
- **Requirement**: Invoice must contain beneficiary details
- **Use cases**:
  - School fees
  - Medical bills
  - Business payments
  - Any international transfer

### Confirmation Requirement
- **Checkbox**: "I confirm that the information provided is correct"
- **Placement**: Before final submission
- **Mandatory**: Cannot proceed without confirmation

---

## Email Notifications

### Document Approval Email
**Trigger**: After document review completion
**Content:**
- Subject: "Document Review Complete - [Transaction Ref]"
- Body:
  - Approval status (Approved/Rejected)
  - If Approved:
    - Next steps: "Please proceed to payment"
    - Payment instructions
    - Timeline: "Complete payment within 48 hours"
  - If Rejected:
    - Reason for rejection
    - Required corrections
    - Re-submission instructions

### Review Timeline Notification
**Trigger**: Transaction submission
**Content:**
- Subject: "Transaction Received - [Transaction Ref]"
- Body:
  - Acknowledgment of submission
  - Expected review timeline (24-48 hours)
  - What to expect next
  - Contact information for queries

---

## Database Schema Changes Required

### 1. Transaction Model Updates
```typescript
// Add new fields
interface Transaction {
  // Existing fields...

  // Mandatory document numbers
  bvnNumber?: string;
  ninNumber?: string;
  formANumber?: string;
  passportNumber?: string;
  passportIssueDate?: Date;
  passportExpiryDate?: Date;

  // BTA specific
  tccNumber?: string;
  companyLetterUrl?: string;

  // Invoice
  invoiceUrl?: string;

  // Confirmation
  informationConfirmed?: boolean;
  informationConfirmedAt?: Date;

  // Pickup details
  pickupDate?: Date;
  pickupTime?: string;

  // Document approval
  documentApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  documentApprovedAt?: Date;
  documentApprovedBy?: string;
  documentRejectionReason?: string;

  // Receipts
  initialReceiptUrl?: string;
  finalReceiptUrl?: string;
}
```

### 2. Source of Funds Declaration Model (New)
```typescript
model SourceOfFundsDeclaration {
  id                String    @id @default(cuid())
  transactionId     String    @unique
  transaction       Transaction @relation(fields: [transactionId], references: [id])

  fullName          String
  sourceDescription String    @db.Text
  signatureType     String    // 'INITIALS' | 'UPLOADED'
  signatureUrl      String?   // If uploaded
  initials          String?   // If using initials

  declaredAt        DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### 3. Receipt Model (New)
```typescript
model TransactionReceipt {
  id              String    @id @default(cuid())
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id])

  type            String    // 'INITIAL' | 'FINAL'
  receiptNumber   String    @unique
  receiptUrl      String

  amount          Decimal   @db.Decimal(18, 2)
  currency        String
  status          String

  issuedAt        DateTime  @default(now())
  stampedBy       String    // System user who stamped

  createdAt       DateTime  @default(now())
}
```

### 4. ExpatriateProfile Model Updates
```typescript
// Add to existing profile or create new
interface ExpatriateProfile {
  workPermitUrl?: string;
  workPermitNumber?: string;
  taxIdForExpatriate?: string;
  // ... other fields
}
```

---

## API Endpoints Required

### Document Management
- `POST /api/admin/transactions/:id/documents/approve` - Approve documents
- `POST /api/admin/transactions/:id/documents/reject` - Reject documents
- `GET /api/customer/transactions/:id/document-status` - Check approval status

### Receipts
- `GET /api/customer/receipts/:transactionId/initial` - Get initial receipt
- `GET /api/customer/receipts/:transactionId/final` - Get final receipt
- `POST /api/admin/receipts/generate` - Generate stamped receipt

### Source of Funds
- `POST /api/customer/transactions/:id/source-of-funds` - Submit declaration
- `GET /api/customer/transactions/:id/source-of-funds` - Get declaration

### Third-Party Verification (PTA)
- `POST /api/verification/pta/verify` - Auto-verify PTA transaction
- `POST /api/verification/bvn/validate` - Validate BVN
- `POST /api/verification/nin/validate` - Validate NIN

---

## Updated Transaction Flow

```
1. Customer creates transaction
   ↓
2. Customer uploads required documents
   - BVN (with number for API validation)
   - NIN (with number for API validation)
   - Form A (with number)
   - Passport (with number, issue, expiry dates)
   - Transaction-specific docs
   - Invoice (where applicable)
   ↓
3. Customer confirms information accuracy (checkbox)
   ↓
4. Transaction submitted
   ↓
5. Email sent: "We'll review within 24-48 hours"
   ↓
6. [FOR PTA]: Automatic API verification
   - If passes → Auto-approve
   - If fails → Manual review
   ↓
7. [FOR OTHER TYPES]: Manual document review
   ↓
8. Document approval decision
   ↓
9. Email sent to customer:
   - If APPROVED: "Proceed to payment"
   - If REJECTED: "Please correct and resubmit"
   ↓
10. Customer makes payment
   ↓
11. Initial receipt generated and sent
   ↓
12. Transaction processed
   ↓
13. FX disbursed to beneficiary
   ↓
14. Final receipt generated and sent
   ↓
15. Transaction COMPLETED
```

---

## Implementation Priority

### Phase 1 - Critical (High Priority)
1. ✅ Add mandatory document fields (BVN, NIN, Form A, Passport with dates)
2. ✅ Document approval workflow before payment
3. ✅ Email notifications for approval/rejection
4. ✅ Timeline communication
5. ✅ PTA vs BTA specific changes

### Phase 2 - Important
1. ✅ Receipt generation system
2. ✅ Invoice upload functionality
3. ✅ Information confirmation checkbox
4. ✅ Pickup date/time fields
5. ✅ Source of funds declaration (for high-value FX sales)

### Phase 3 - Enhancement
1. ✅ Third-party API integration for PTA auto-verification
2. ✅ Expatriate onboarding flow
3. ✅ Auto-population from existing DB data
4. ✅ Receipt download functionality

---

## Testing Checklist

- [ ] BVN/NIN API validation working
- [ ] Document approval workflow complete
- [ ] Email notifications sent correctly
- [ ] PTA auto-verification (if APIs integrated)
- [ ] BTA specific document requirements
- [ ] School fees with invoice upload
- [ ] Receipt generation (initial + final)
- [ ] Receipt download
- [ ] Source of funds declaration for high-value
- [ ] Expatriate onboarding
- [ ] Pickup date/time selection
- [ ] Information confirmation checkbox

---

## Notes for Mobile Designer Session
1. Discuss UI/UX for document number input fields
2. Passport issue/expiry date pickers
3. Invoice upload flow
4. Confirmation checkbox placement
5. Pickup date/time selection UI
6. Source of funds declaration form design
7. Receipt display and download functionality
8. Email notification templates review
9. Timeline communication messaging
10. Minimal disruption to existing progress

---

**Document Version**: 1.0
**Last Updated**: 2026-03-14
**Status**: Requirements Documented - Pending Implementation
