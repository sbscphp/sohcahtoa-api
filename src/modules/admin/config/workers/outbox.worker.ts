import { PrismaClient } from "@prisma/client";
import { createLogger } from "../../../../shared/utils";
import { ServiceName, EventType } from "../../../../shared/types";
import { getDatabase } from "../../../../config/database";
import { eventBus } from "../../../../events/event-bus";

const prisma = getDatabase();

const logger = createLogger(ServiceName.ADMIN);

export const processOutboxEvents = async (prismaInstance: PrismaClient) => {
    const events = await prismaInstance.outboxEvent.findMany({
        where: { status: "PENDING" },
        take: 50,
        orderBy: { createdAt: "asc" },
    });

    for (const event of events) {
        try {
            // Publish event using the in-memory event bus
            eventBus.publish(event.eventType, {
                eventId: event.id,
                source: event.source,
                timestamp: event.createdAt.toISOString(),
                aggregateId: event.aggregateId,
                payload: event.payload,
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
            await prismaInstance.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: "FAILED",
                    retryCount: { increment: 1 },
                },
            });

            logger.warn("Outbox publish failed", {
                eventId: event.id,
                retryCount: event.retryCount + 1,
                message: (error as Error).message,
            });
        }
    }
};

setInterval(() => {
    processOutboxEvents(prisma).catch(err =>
        logger.error("Outbox worker crashed", {
            message: err.message,
        }),
    );
}, 5000);
