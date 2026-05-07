import { normalizeStockCodes, type StockPriceProvider, type StockQuote } from "@/lib/stocks/price-provider";

type NaverStockBasicResponse = {
  itemCode?: string;
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousPrice?: {
    name?: string;
  };
  fluctuationsRatio?: string;
  marketStatus?: string;
  localTradedAt?: string;
  stockExchangeName?: string;
};

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
      Referer: "https://m.stock.naver.com/",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`Naver HTTP ${response.status}`);

  return response.json() as Promise<NaverStockBasicResponse>;
}

function parseNumber(value?: string) {
  const price = Number.parseFloat((value || "").replace(/,/g, ""));
  return Number.isNaN(price) ? null : price;
}

function signedValue(value: number | null, direction?: string) {
  if (value == null) return null;
  if (direction === "FALLING") return -Math.abs(value);
  if (direction === "RISING") return Math.abs(value);
  return 0;
}

function toStockQuote(code: string, data: NaverStockBasicResponse): StockQuote | null {
  const price = parseNumber(data.closePrice);
  if (price == null) return null;

  const direction = data.compareToPreviousPrice?.name;
  const change = signedValue(parseNumber(data.compareToPreviousClosePrice), direction);
  const changeRate = signedValue(parseNumber(data.fluctuationsRatio), direction);

  return {
    code: data.itemCode || code,
    price,
    previousClose: change == null ? null : price - change,
    change,
    changeRate,
    fetchedAt: data.localTradedAt || new Date().toISOString(),
    source: "naver",
    marketStatus: data.marketStatus,
    name: data.stockName,
    exchange: data.stockExchangeName,
  };
}

export const naverPriceProvider: StockPriceProvider = {
  async fetchQuotes(codes) {
    const normalizedCodes = normalizeStockCodes(codes);
    const results = await Promise.all(
      normalizedCodes.map(async (code) => {
        try {
          const data = await fetchJson(`https://m.stock.naver.com/api/stock/${code}/basic`);
          return [code, toStockQuote(code, data)] as const;
        } catch {
          return [code, null] as const;
        }
      }),
    );

    return Object.fromEntries(results);
  },
};
