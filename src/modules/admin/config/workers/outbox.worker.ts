import { PrismaClient } from "@prisma/client";
import { createLogger } from "../../../shared/utils";
import { ServiceName, EventType } from "../../../shared/types";
import { publishEvent } from "../kafka";
import { getDatabase } from "../../../../config/database";
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
            await publishEvent({
                eventId: event.id,
                eventType: event.eventType as any,
                source: event.source as ServiceName,
                timestamp: new Date().toISOString(),
                userId: event.aggregateId,
                data: event.payload as any,
            });

            await prismaInstance.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: "PUBLISHED",
                    publishedAt: new Date(),
                },
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
