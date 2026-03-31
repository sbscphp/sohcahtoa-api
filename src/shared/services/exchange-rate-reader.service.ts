import { getDatabase } from "../../config/database";
import { NotFoundError } from "../utils/errors";
import { createLogger } from "../utils/logger";

const prisma = getDatabase();
const logger = createLogger("exchange-rate-reader");

export type CalculateAmountResult = {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  sellRate: number;
  buyRate: number;
  convertedAmount: number;
  rateValidUntil: Date;
};

/**
 * Currently active exchange rates (valid window + isActive), with public-facing fields only.
 */
export async function getActiveExchangeRates(fromCurrency?: string, toCurrency?: string) {
  logger.info("Fetching active exchange rates", {
    fromCurrency,
    toCurrency,
  });

  const now = new Date();
  const where: {
    isActive: boolean;
    validFrom: { lte: Date };
    validUntil: { gt: Date };
    fromCurrency?: string;
    toCurrency?: string;
  } = {
    isActive: true,
    validFrom: { lte: now },
    validUntil: { gt: now },
  };

  if (fromCurrency) where.fromCurrency = fromCurrency.toUpperCase();
  if (toCurrency) where.toCurrency = toCurrency.toUpperCase();

  const rates = await prisma.exchangeRate.findMany({
    where,
    select: {
      id: true,
      fromCurrency: true,
      toCurrency: true,
      buyRate: true,
      sellRate: true,
      validFrom: true,
      validUntil: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  logger.info(`Found ${rates.length} active rates`, {
    fromCurrency,
    toCurrency,
    rateCount: rates.length,
    currencies: rates.map((r) => `${r.fromCurrency}/${r.toCurrency}`),
  });

  return rates;
}

/**
 * Convert an amount using the latest active row's sell rate for the pair.
 */
export async function calculateAmountUsingActiveSellRate(
  fromCurrency: string,
  toCurrency: string,
  amount: number
): Promise<CalculateAmountResult> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  logger.info("Calculating transaction amount", {
    fromCurrency: from,
    toCurrency: to,
    amount,
  });

  const now = new Date();
  const rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gt: now },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!rate) {
    logger.error("No active exchange rate found", {
      fromCurrency: from,
      toCurrency: to,
    });
    throw new NotFoundError(`No active exchange rate found for ${from} to ${to}`);
  }

  const sellRate = rate.sellRate != null ? Number(rate.sellRate) : NaN;
  const buyRate = rate.buyRate != null ? Number(rate.buyRate) : NaN;
  const convertedAmount = amount * sellRate;

  logger.info("Amount calculated successfully", {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    amount,
    sellRate,
    buyRate,
    convertedAmount,
    rateId: rate.id,
  });

  return {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    amount,
    sellRate,
    buyRate,
    convertedAmount,
    rateValidUntil: rate.validUntil,
  };
}
