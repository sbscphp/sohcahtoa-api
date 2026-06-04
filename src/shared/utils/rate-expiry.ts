import { getDatabase } from "../../config/database";
import { createLogger } from "./logger";

const logger = createLogger("rate-expiry-utility");

export async function expireExpiredRates(): Promise<void> {
  const prisma = getDatabase();
  const now = new Date();
  try {
    const expiredCount = await prisma.exchangeRate.updateMany({
      where: {
        isActive: true,
        validUntil: { lte: now },
      },
      data: {
        isActive: false,
      },
    });
    if (expiredCount.count > 0) {
      logger.info(`Expired ${expiredCount.count} exchange rates (set isActive to false)`);
    }
  } catch (error) {
    logger.error("Failed to expire rates", error);
  }
}
