import { PrismaClient } from "@prisma/client";
import { createLogger } from "../../../../shared/utils";
import { ServiceName } from "../../../../shared/types";
import { getDatabase } from "../../../../config/database";
import { eventBus } from "../../../../events/event-bus";

const prisma = getDatabase();

const logger = createLogger(ServiceName.ADMIN);

export const processOutboxEvents = async (prismaInstance: PrismaClient) => {
    try {
        const events = await prismaInstance.outboxEvent.findMany({
            where: { status: "PENDING" },
            take: 50,
            orderBy: { createdAt: "asc" },
        });

        for (const event of events) {
            try {
                eventBus.publish(event.eventType as any, {
                    eventId: event.id,
                    source: event.source as ServiceName,
                    timestamp: new Date().toISOString(),
                    userId: event.aggregateId,
                    payload: event.payload as any,
                });

                // Mark as published
                await prismaInstance.outboxEvent.update({
                    where: { id: event.id },
                    data: {
                        status: "PUBLISHED",
                        publishedAt: new Date(),
                    },
                });

                logger.info("Outbox event published", {
                    eventId: event.id,
                    eventType: event.eventType,
                });
            } catch (error) {
                const errorMsg = (error as Error).message;
                const isConnectionError = 
                    errorMsg.includes("connection") || 
                    errorMsg.includes("closed") || 
                    errorMsg.includes("socket") || 
                    errorMsg.includes("DbError") || 
                    errorMsg.includes("FATAL");

                logger.warn("Outbox publish failed", {
                    eventId: event.id,
                    retryCount: event.retryCount + 1,
                    message: errorMsg,
                });

                if (isConnectionError) {
                    // Break the loop and throw to stop processing further events during a connection failure
                    throw error;
                }

                // Try to mark as failed if it wasn't a connection issue
                try {
                    await prismaInstance.outboxEvent.update({
                        where: { id: event.id },
                        data: {
                            status: "FAILED",
                            retryCount: { increment: 1 },
                        },
                    });
                } catch (updateError) {
                    logger.error("Failed to mark outbox event as FAILED", {
                        eventId: event.id,
                        message: (updateError as Error).message,
                    });
                }
            }
        }
    } catch (err: any) {
        logger.error("Error processing outbox events:", {
            message: err.message,
            stack: err.stack,
        });
    }
};

setInterval(() => {
    processOutboxEvents(prisma).catch(err =>
        logger.error("Outbox worker crashed", {
            message: err.message,
        }),
    );
}, 5000);

