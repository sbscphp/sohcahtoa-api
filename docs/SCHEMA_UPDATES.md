# Prisma Schema Updates for Transaction Workflow Changes

## Overview
This document contains the exact Prisma schema changes needed to support the new transaction workflow requirements.

---

## 1. New Enums

Add these enums to your `schema.prisma` file:

```prisma
// Document approval status
enum DocumentApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  REQUIRES_RESUBMISSION
}

// Receipt types
enum ReceiptType {
  INITIAL
  FINAL
}
```

---

## 2. Update Transaction Model

Add these fields to the existing `Transaction` model:

```prisma
model Transaction {
  // ... all existing fields remain ...

  // ========================================
  // NEW FIELDS FOR COMPLIANCE REQUIREMENTS
  // ========================================

  // Mandatory Document Numbers (for all transaction types)
  bvnNumber              String?
  ninNumber              String?
  formANumber            String?
  passportNumber         String?
  passportIssueDate      DateTime?
  passportExpiryDate     DateTime?

  // BTA Specific Fields
  tccNumber              String?              // Tax Clearance Certificate number
  companyLetterUrl       String?              // Company confirmation letter

  // Invoice & Confirmation
  invoiceUrl             String?              // Beneficiary invoice upload
  informationConfirmed   Boolean              @default(false)
  informationConfirmedAt DateTime?

  // Pickup Details (for cash pickup transactions)
  pickupDate             DateTime?
  pickupTime             String?              // Store as string "14:30"

  // Document Approval Workflow
  documentApprovalStatus DocumentApprovalStatus @default(PENDING)
  documentApprovedAt     DateTime?
  documentApprovedBy     String?              // Admin user ID who approved
  documentRejectionReason String?             @db.Text
  documentReviewSLA      DateTime?            // Expected review completion (submission + 48hrs)

  // Receipt References
  initialReceiptUrl      String?
  initialReceiptNumber   String?
  finalReceiptUrl        String?
  finalReceiptNumber     String?

  // ========================================
  // NEW RELATIONS
  // ========================================
  sourceOfFundsDeclaration SourceOfFundsDeclaration?
  receipts               TransactionReceipt[]
}
```

---

## 3. New Model: SourceOfFundsDeclaration

For residents selling $10k+ FX:

```prisma
model SourceOfFundsDeclaration {
  id                String      @id @default(uuid())
  transactionId     String      @unique
  transaction       Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  // Declaration details
  fullName          String
  sourceDescription String      @db.Text          // Detailed description of fund source
  signatureType     String                        // 'INITIALS' or 'UPLOADED'
  signatureUrl      String?                       // If signature is uploaded
  initials          String?                       // If using initials

  // Metadata
  declaredAt        DateTime    @default(now())
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([transactionId])
  @@map("source_of_funds_declarations")
}
```

---

## 4. New Model: TransactionReceipt

For initial and final transaction receipts:

```prisma
model TransactionReceipt {
  id              String      @id @default(uuid())
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  // Receipt details
  type            ReceiptType                   // INITIAL or FINAL
  receiptNumber   String      @unique           // e.g., "RCP-20260314-0001"
  receiptUrl      String                        // S3/Cloudinary URL to PDF

  // Transaction snapshot at receipt time
  amount          Decimal     @db.Decimal(18, 2)
  currency        String
  status          String                        // Transaction status at receipt time

  // Additional details (for FINAL receipt)
  exchangeRate    Decimal?    @db.Decimal(18, 6)
  beneficiaryName String?
  beneficiaryBank String?

  // Stamping information
  issuedAt        DateTime    @default(now())
  stampedBy       String                        // Admin/system user who issued receipt

  // Metadata
  metadata        Json?                         // Additional receipt data
  createdAt       DateTime    @default(now())

  @@index([transactionId])
  @@index([receiptNumber])
  @@index([type])
  @@map("transaction_receipts")
}
```

---

## 5. New Model: ExpatriateProfile

For expatriate-specific onboarding:

```prisma
model ExpatriateProfile {
  id                   String   @id @default(uuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Work Permit details
  workPermitUrl        String?
  workPermitNumber     String?
  workPermitIssueDate  DateTime?
  workPermitExpiryDate DateTime?

  // Tax information
  taxIdForExpatriate   String?

  // Metadata
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([userId])
  @@map("expatriate_profiles")
}
```

---

## 6. Update User Model

Add relation to ExpatriateProfile (if not already present):

```prisma
model User {
  // ... existing fields ...

  // Add this relation
  expatriateProfile ExpatriateProfile?

  // ... rest of existing relations ...
}
```

---

## 7. Update TransactionDocument Model (Optional Enhancement)

Add document number field for better tracking:

```prisma
model TransactionDocument {
  // ... existing fields ...

  // NEW: Document number/identifier
  documentNumber String?              // e.g., BVN number, Passport number, etc.

  // ... rest of existing fields ...
}
```

---

## 8. Update TransactionStatus Enum (Optional)

Add new statuses for document approval workflow:

```prisma
enum TransactionStatus {
  DRAFT
  DOCUMENTS_SUBMITTED                 // NEW
  AWAITING_DOCUMENT_APPROVAL          // NEW
  DOCUMENTS_APPROVED                  // NEW
  DOCUMENTS_REJECTED                  // NEW
  AUTO_VERIFICATION_IN_PROGRESS       // NEW (for PTA)
  AWAITING_VERIFICATION
  VERIFICATION_IN_PROGRESS
  VERIFICATION_COMPLETED
  AWAITING_DEPOSIT
  DEPOSIT_PENDING
  DEPOSIT_CONFIRMED
  COMPLIANCE_REVIEW
  ADMIN_APPROVAL_PENDING
  APPROVED
  DISBURSEMENT_IN_PROGRESS
  COMPLETED
  REJECTED
  CANCELLED
}
```

---

## Migration Steps

### Step 1: Backup Database
```bash
# Create a backup before migrating
docker exec sochatoa-postgres pg_dump -U postgres sochatoa_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Update schema.prisma

Copy the changes above into your `prisma/schema.prisma` file.

### Step 3: Create Migration

```bash
# Option A: Create migration only (review SQL first)
npx prisma migrate dev --create-only --name add_transaction_workflow_compliance

# Review the generated SQL in:
# prisma/migrations/[timestamp]_add_transaction_workflow_compliance/migration.sql

# Option B: Create and apply immediately
npx prisma migrate dev --name add_transaction_workflow_compliance
```

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Restart Application

```bash
docker-compose restart api
```

---

## Default Values for Existing Data

After migration, existing transactions will have:
- `documentApprovalStatus` = `PENDING`
- `informationConfirmed` = `false`
- All optional fields = `NULL`

You may want to run a data migration script to set appropriate values for completed transactions:

```typescript
// scripts/migrate-existing-transactions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Set completed transactions to APPROVED status
  await prisma.transaction.updateMany({
    where: {
      status: 'COMPLETED',
      documentApprovalStatus: 'PENDING'
    },
    data: {
      documentApprovalStatus: 'APPROVED',
      informationConfirmed: true
    }
  });

  console.log('Existing transactions updated');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Validation Rules

### BVN Number
- Length: Exactly 11 digits
- Format: Numeric only
- Regex: `^[0-9]{11}$`

### NIN Number
- Length: Exactly 11 digits
- Format: Numeric only
- Regex: `^[0-9]{11}$`

### Passport Number
- Length: 7-9 characters
- Format: Alphanumeric
- Regex: `^[A-Z0-9]{7,9}$`

### TCC Number
- Format: Varies by issuing authority
- Length: 10-20 characters

### Passport Dates
- Issue Date: Must be in the past
- Expiry Date: Must be in the future (at least 6 months from transaction date)

---

## Index Recommendations

The schema above includes these indexes for performance:

```prisma
// Transaction indexes
@@index([documentApprovalStatus])     // For admin pending approvals query
@@index([documentReviewSLA])          // For SLA monitoring

// SourceOfFundsDeclaration indexes
@@index([transactionId])              // Foreign key lookup

// TransactionReceipt indexes
@@index([transactionId])              // Foreign key lookup
@@index([receiptNumber])              // Unique receipt lookup
@@index([type])                       // Filter by receipt type

// ExpatriateProfile indexes
@@index([userId])                     // Foreign key lookup
```

---

## Rollback Plan

If you need to rollback:

```bash
# Restore from backup
docker exec -i sochatoa-postgres psql -U postgres sochatoa_db < backup_YYYYMMDD_HHMMSS.sql

# Or rollback last migration
npx prisma migrate resolve --rolled-back [migration_name]
```

---

## Testing Queries

After migration, test with these queries:

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
AND column_name IN ('bvn_number', 'nin_number', 'document_approval_status');

-- Check new tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('source_of_funds_declarations', 'transaction_receipts', 'expatriate_profiles');

-- Check enums created
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'DocumentApprovalStatus');
```

---

**Important Notes:**
1. Always backup before migration
2. Test in development environment first
3. Review generated SQL before applying to production
4. Monitor application logs after deployment
5. Have rollback plan ready

---

**Created**: 2026-03-14
**Status**: Ready for Review
**Next Step**: Apply to development environment for testing
