-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'COMPLIANCE_OFFICER', 'OPERATIONS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('TRANSACTION_APPROVE', 'TRANSACTION_REJECT', 'DEPOSIT_CONFIRM', 'DOCUMENT_APPROVE', 'DOCUMENT_REJECT', 'COMPLIANCE_REVIEW', 'USER_SUSPEND', 'USER_ACTIVATE', 'LIMITS_OVERRIDE', 'CASH_PICKUP_ISSUE', 'PREPAID_CARD_ISSUE');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('OTP', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'MAGIC_LINK');

-- CreateEnum
CREATE TYPE "AmlFlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmlFlagType" AS ENUM ('THRESHOLD_EXCEEDED', 'SUSPICIOUS_PATTERN', 'HIGH_RISK_COUNTRY', 'FREQUENT_TRANSACTIONS', 'STRUCTURING', 'POLITICALLY_EXPOSED_PERSON', 'SANCTIONS_LIST', 'ADVERSE_MEDIA');

-- CreateEnum
CREATE TYPE "CustomerFlagStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "branches" TEXT[],
    "departments" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "altPhoneNumber" TEXT,
    "position" TEXT,
    "department" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "password" TEXT,
    "roleId" TEXT,
    "role" "AdminRole",
    "permissions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "pendingApprovals" INTEGER NOT NULL DEFAULT 0,
    "completedTransactions" INTEGER NOT NULL DEFAULT 0,
    "rejectedTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(18,2) NOT NULL,
    "amlFlags" INTEGER NOT NULL DEFAULT 0,
    "pendingReviews" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_flags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AmlFlagType" NOT NULL,
    "severity" "AmlFlagSeverity" NOT NULL,
    "status" "CustomerFlagStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "customer_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_roleId_idx" ON "admin_users"("roleId");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_idx" ON "admin_actions"("adminId");

-- CreateIndex
CREATE INDEX "admin_actions_resourceType_resourceId_idx" ON "admin_actions"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "admin_actions_actionType_idx" ON "admin_actions"("actionType");

-- CreateIndex
CREATE INDEX "task_assignments_adminId_idx" ON "task_assignments"("adminId");

-- CreateIndex
CREATE INDEX "task_assignments_status_idx" ON "task_assignments"("status");

-- CreateIndex
CREATE INDEX "task_assignments_priority_idx" ON "task_assignments"("priority");

-- CreateIndex
CREATE INDEX "dashboards_date_idx" ON "dashboards"("date");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_key" ON "tokens"("token");

-- CreateIndex
CREATE INDEX "tokens_userId_idx" ON "tokens"("userId");

-- CreateIndex
CREATE INDEX "tokens_token_idx" ON "tokens"("token");

-- CreateIndex
CREATE INDEX "tokens_type_idx" ON "tokens"("type");

-- CreateIndex
CREATE INDEX "tokens_expiresAt_idx" ON "tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "customer_flags_status_idx" ON "customer_flags"("status");

-- CreateIndex
CREATE INDEX "customer_flags_type_idx" ON "customer_flags"("type");

-- CreateIndex
CREATE INDEX "customer_flags_severity_idx" ON "customer_flags"("severity");

-- CreateIndex
CREATE INDEX "customer_flags_userId_idx" ON "customer_flags"("userId");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
