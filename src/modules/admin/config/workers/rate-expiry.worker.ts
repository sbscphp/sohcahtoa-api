import { expireExpiredRates } from "../../../../shared/utils/rate-expiry";
import { createLogger } from "../../../../shared/utils/logger";
import { ServiceName } from "../../../../shared/types";

const logger = createLogger(ServiceName.ADMIN);
const CHECK_INTERVAL = 30 * 1000; // 30 seconds

export async function processRateExpiry() {
  try {
    await expireExpiredRates();
  } catch (err: any) {
    logger.error("Error processing rate expiry in background worker:", {
      message: err.message,
      stack: err.stack,
    });
  }
}

// Start background worker loop
setInterval(() => {
  processRateExpiry().catch((err) =>
    logger.error("Rate expiry worker crashed:", {
      message: err.message,
    })
  );
}, CHECK_INTERVAL);
