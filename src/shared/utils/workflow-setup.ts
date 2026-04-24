import { WorkflowType, WorkflowProcessType, WorkflowTemplateStatus } from "@prisma/client";
import { getDatabase } from "../../config/database";
import { createLogger } from "./logger";

const logger = createLogger("WorkflowSetup");

/**
 * Initializes the standard transaction workflow if it doesn't already exist.
 * This is designed to be run once during application startup.
 */
export async function setupTransactionWorkflow() {
  const prisma = getDatabase();
  const templateName = "Standard Transaction Workflow";
  const actionName = "Transaction Approval";

  try {
    // 1. Check if the workflow already exists
    const existing = await prisma.workflowTemplate.findFirst({
      where: {
        OR: [
          { name: templateName },
          { action: actionName }
        ]
      }
    });

    if (existing) {
      logger.info(`Transaction workflow already exists (ID: ${existing.id}). Skipping initialization.`);
      return;
    }

    logger.info("Initializing standard transaction workflow...");

    // 2. Find an admin user to be the creator
    const creator = await prisma.adminUser.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    if (!creator) {
      logger.warn("No active admin user found. Transaction workflow setup deferred until an admin is available.");
      return;
    }

    // 3. Create the Workflow Template and Stages
    await prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: {
          name: templateName,
          description: "Standard linear workflow for transaction review and approval. Requires Compliance Review followed by Operations Approval.",
          type: WorkflowType.APPROVAL,
          processType: WorkflowProcessType.RIGID_LINEAR,
          action: actionName,
          status: WorkflowTemplateStatus.ACTIVE,
          createdBy: creator.id,
          stages: {
            create: [
              {
                name: "Compliance Review",
                type: WorkflowType.REVIEW,
                order: 1,
                escalationMinutes: 60,
              },
              {
                name: "Operations Approval",
                type: WorkflowType.APPROVAL,
                order: 2,
                escalationMinutes: 120,
              }
            ]
          }
        },
        include: {
          stages: true
        }
      });

      // 4. Assign all current active admins to the stages
      const admins = await tx.adminUser.findMany({
        where: { isActive: true },
        take: 10 // Assign up to 10 admins to ensure the workflow is functional
      });

      for (const stage of template.stages) {
        for (const admin of admins) {
          await tx.workflowAssignee.create({
            data: {
              stageId: stage.id,
              adminId: admin.id,
              order: 1
            }
          });
        }
      }
    });

    logger.info("Standard transaction workflow initialized successfully.");
  } catch (error) {
    logger.error("Failed to set up transaction workflow:", error);
    // We don't throw the error here to avoid blocking server startup
  }
}
