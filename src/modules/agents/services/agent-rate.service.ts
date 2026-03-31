import {
  calculateAmountUsingActiveSellRate,
  getActiveExchangeRates,
} from "../../../shared/services/exchange-rate-reader.service";

class AgentRateService {
  getActiveRates(fromCurrency?: string, toCurrency?: string) {
    return getActiveExchangeRates(fromCurrency, toCurrency);
  }

  calculateAmount(fromCurrency: string, toCurrency: string, amount: number) {
    return calculateAmountUsingActiveSellRate(fromCurrency, toCurrency, amount);
  }
}

export default new AgentRateService();
