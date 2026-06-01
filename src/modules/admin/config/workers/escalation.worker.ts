import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../../config/database";
import { sendEmail } from "../../../../config/email";
import { createLogger } from "../../../../shared/utils/logger";
import { ServiceName } from "../../../../shared/types";

const prisma = getDatabase();
const logger = createLogger(ServiceName.ADMIN);

// Running interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

export async function processTransientEscalations(prismaInstance: PrismaClient) {
  try {
    // Target transactions that are paid (deposit confirmed) but not completed, rejected, or cancelled.
    const pendingStatuses = [
      "DEPOSIT_CONFIRMED",
      "AWAITING_DISBURSEMENT",
      "APPROVED",
      "DISBURSEMENT_IN_PROGRESS",
      "PENDING_RECORD_VALIDATION"
    ];

    const transactions = await prismaInstance.transaction.findMany({
      where: {
        status: { in: pendingStatuses as any }
      },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        history: {
          where: {
            action: { in: ["DEPOSIT_CONFIRMED", "ESCALATION_EMAIL_SENT"] }
          }
        }
      }
    });

    const now = new Date();

    for (const tx of transactions) {
      // Find when the Naira deposit was confirmed in the history log.
      const depositHistory = tx.history.find(h => h.action === "DEPOSIT_CONFIRMED");
      const confirmedAt = depositHistory ? new Date(depositHistory.createdAt) : new Date(tx.updatedAt);

      const diffMs = now.getTime() - confirmedAt.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / (60 * 1000)));

      // Check which levels of escalation have already been sent for this transaction.
      const sentEscalations = tx.history
        .filter(h => h.action === "ESCALATION_EMAIL_SENT")
        .map(h => h.newValue);

      // Fetch current stage and check for custom escalation admin protocol
      let stageEscalationEmail: string | null = null;
      let stageEscalationName = "";

      if (tx.currentWorkflowStageId) {
        const stage: any = await (prismaInstance as any).workflowStage.findUnique({
          where: { id: tx.currentWorkflowStageId },
          include: {
            escalationAdmin: true
          }
        });
        if (stage?.escalationAdmin?.email) {
          stageEscalationEmail = stage.escalationAdmin.email;
          stageEscalationName = stage.escalationAdmin.fullName;
        }
      }

      // Customer details for email templates
      const customerName = tx.user?.profile 
        ? `${tx.user.profile.firstName} ${tx.user.profile.lastName}`.trim()
        : tx.user?.email || "Valued Customer";
      
      const referenceId = tx.referenceNumber;
      const amount = tx.nairaEquivalent ? Number(tx.nairaEquivalent).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00";
      const timestamp = confirmedAt.toLocaleString();
      const ctaLink = `${process.env.ADMIN_PORTAL_URL || "http://localhost:3000"}/admin/transactions/${tx.id}`;

      // Email sender helper
      const sendEscalation = async (level: string, subject: string, recipientEmail: string, htmlContent: string) => {
        const mailSent = await sendEmail({
          to: recipientEmail,
          subject,
          html: htmlContent
        });

        if (mailSent) {
          await prismaInstance.transactionHistory.create({
            data: {
              transactionId: tx.id,
              action: "ESCALATION_EMAIL_SENT",
              previousValue: null,
              newValue: level,
              notes: `Escalation ${level} email sent to ${recipientEmail} after ${diffMins} minutes.`,
            }
          });
          logger.info(`Escalation ${level} email sent for tx: ${referenceId} to ${recipientEmail}`);
        } else {
          logger.warn(`Failed to send Escalation ${level} email for tx: ${referenceId}`);
        }
      };

      // Helper to fetch department email from DB or fallback to environment variables / defaults
      const getDeptEmail = async (deptName: string, envVar: string, defaultEmail: string) => {
        const envVal = process.env[envVar];
        if (envVal) return envVal;
        
        const dept = await prismaInstance.department.findFirst({
          where: { name: { equals: deptName, mode: "insensitive" } }
        });
        return dept?.departmentEmail || defaultEmail;
      };

      // LEVEL 3 Escalation: After 1h 30m (90 minutes)
      if (diffMins >= 90) {
        if (!sentEscalations.includes("LEVEL_3")) {
          const toEmail = stageEscalationEmail || await getDeptEmail("Management", "ESCALATION_EMAIL_MANAGEMENT", "management@sochatoa.com");
          const salutation = stageEscalationName ? `Dear ${stageEscalationName},` : "Dear Management Team,";
          
          const subject = "Unfulfilled BDC Transaction - Management Escalation";
          const html = `
            <p>${salutation}</p>
            <p>This is to formally escalate a pending BDC transaction that has remained unresolved in the transient wallet for over 1 hour 30 minutes after receipt of customer payment.</p>
            <p>Despite prior operational and compliance notifications, the transaction is yet to be fulfilled.</p>
            <p><strong>Transaction Details:</strong></p>
            <ul>
              <li><strong>Customer Name:</strong> ${customerName}</li>
              <li><strong>Transaction Reference:</strong> ${referenceId}</li>
              <li><strong>Amount:</strong> NGN ${amount}</li>
              <li><strong>Time Received:</strong> ${timestamp}</li>
            </ul>
            <p><a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background-color:#d9534f;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">View Transaction</a></p>
            <p>Kindly note this for immediate intervention and resolution.</p>
            <p>Thank you.</p>
          `;
          await sendEscalation("LEVEL_3", subject, toEmail, html);
        }
      }
      // LEVEL 2 Escalation: After 1h (60 minutes)
      else if (diffMins >= 60) {
        if (!sentEscalations.includes("LEVEL_2")) {
          const toEmail = stageEscalationEmail || await getDeptEmail("Compliance", "ESCALATION_EMAIL_COMPLIANCE", "compliance@sochatoa.com");
          const salutation = stageEscalationName ? `Dear ${stageEscalationName},` : "Dear Compliance Team,";

          const subject = "Pending BDC Transaction - Compliance Escalation";
          const html = `
            <p>${salutation}</p>
            <p>This is an escalation notice regarding a BDC transaction that has remained pending in the transient wallet for over 1 hour after customer payment was received.</p>
            <p>The transaction is yet to be fulfilled and requires immediate review to ensure compliance with operational and regulatory timelines.</p>
            <p><strong>Transaction Details:</strong></p>
            <ul>
              <li><strong>Customer Name:</strong> ${customerName}</li>
              <li><strong>Transaction Reference:</strong> ${referenceId}</li>
              <li><strong>Amount:</strong> NGN ${amount}</li>
              <li><strong>Time Received:</strong> ${timestamp}</li>
            </ul>
            <p><a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background-color:#f0ad4e;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">View Transaction</a></p>
            <p>Kindly investigate and advise accordingly.</p>
            <p>Thank you.</p>
          `;
          await sendEscalation("LEVEL_2", subject, toEmail, html);
        }
      }
      // LEVEL 1 Escalation: After 30m (30 minutes)
      else if (diffMins >= 30) {
        if (!sentEscalations.includes("LEVEL_1")) {
          const toEmail = stageEscalationEmail || await getDeptEmail("Operations", "ESCALATION_EMAIL_OPERATIONS", "operations@sochatoa.com");
          const salutation = stageEscalationName ? `Dear ${stageEscalationName},` : "Dear Team,";

          const subject = "Pending FX Transaction – Action Required";
          const html = `
            <p>${salutation}</p>
            <p>This is to notify you that a customer’s Naira payment has remained in the transient wallet for more than 30 minutes without fulfilment of the corresponding FX order.</p>
            <p>Kindly review and process the transaction as soon as possible to avoid delays in customer fulfilment.</p>
            <p><strong>Transaction Details:</strong></p>
            <ul>
              <li><strong>Customer Name:</strong> ${customerName}</li>
              <li><strong>Transaction Reference:</strong> ${referenceId}</li>
              <li><strong>Amount:</strong> NGN ${amount}</li>
              <li><strong>Time Received:</strong> ${timestamp}</li>
            </ul>
            <p><a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background-color:#337ab7;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">View Transaction</a></p>
            <p>Please treat this as urgent.</p>
            <p>Thank you.</p>
          `;
          await sendEscalation("LEVEL_1", subject, toEmail, html);
        }
      }
    }
  } catch (err: any) {
    logger.error("Error processing transient escalations:", {
      message: err.message,
      stack: err.stack
    });
  }
}

// Start background worker loop
setInterval(() => {
  processTransientEscalations(prisma).catch(err =>
    logger.error("Transient escalation worker crashed:", {
      message: err.message
    })
  );
}, CHECK_INTERVAL);
