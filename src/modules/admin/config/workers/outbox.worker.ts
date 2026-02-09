import { PrismaClient } from "@prisma/client";
import { createLogger } from "../../../../shared/utils";
import { ServiceName } from "../../../../shared/types";
import { eventBus } from "../../../../events/event-bus";
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
