export type StockPriceMap = Record<string, number | null>;

export type StockQuote = {
  code: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changeRate: number | null;
  fetchedAt: string;
  source: string;
  marketStatus?: string;
  name?: string;
  exchange?: string;
};

export type StockQuoteMap = Record<string, StockQuote | null>;

export type StockPriceProvider = {
  fetchQuotes: (codes: string[]) => Promise<StockQuoteMap>;
};

export function normalizeStockCodes(codes: string[]) {
  return Array.from(
    new Set(
      codes
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  );
}

export function quotesToPrices(quotes: StockQuoteMap): StockPriceMap {
  return Object.fromEntries(Object.entries(quotes).map(([code, quote]) => [code, quote?.price ?? null]));
}
