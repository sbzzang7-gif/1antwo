import { NextRequest, NextResponse } from "next/server";
import { naverPriceProvider } from "@/lib/stocks/naver-price-provider";
import { normalizeStockCodes, quotesToPrices } from "@/lib/stocks/price-provider";

export async function GET(request: NextRequest) {
  const codes = normalizeStockCodes((request.nextUrl.searchParams.get("codes") || "").split(","));

  if (!codes.length) {
    return NextResponse.json({ error: "codes 파라미터 필요" }, { status: 400 });
  }

  const quotes = await naverPriceProvider.fetchQuotes(codes);

  return NextResponse.json({ prices: quotesToPrices(quotes), quotes });
}
