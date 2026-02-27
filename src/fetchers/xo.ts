import axios from "axios";
import { env } from "../config/env.js";
import type { RawMarket, FetcherResult } from "../types/market.js";

interface XOOutcome {
  id: number;
  title: string;
  currentPrice: string;
  volumeTraded: string;
  volumeTradedInUSD: string;
  index: number;
}

interface XOMarket {
  id: number;
  title: string;
  status: string;
  type: "BINARY" | "MULTIPLE";
  expiresAt: string | null;
  totalVolumeInUSD: string;
  outcomes: XOOutcome[];
}

interface XOMarketsResponse {
  data: XOMarket[];
  meta: {
    page: number;
    take: number;
    itemCount: number;
    pageCount: number;
    hasNextPage: boolean;
  };
}

const WEI_DIVISOR = 1e18;
const PAGE_SIZE = 50;
const EXCLUDED_STATUSES = "PENDING,UPDATE_REQUIRED,CANCELLED,RESOLVED";

function weiToDecimal(wei: string): number | null {
  const n = parseFloat(wei);
  if (isNaN(n)) return null;
  return +(n / WEI_DIVISOR).toFixed(4);
}

function normalize(market: XOMarket): RawMarket {
  let yesPrice: number | null = null;
  let noPrice: number | null = null;

  if (market.type === "BINARY" && market.outcomes.length >= 2) {
    const sorted = [...market.outcomes].sort((a, b) => a.index - b.index);
    yesPrice = weiToDecimal(sorted[0].currentPrice);
    noPrice = weiToDecimal(sorted[1].currentPrice);
  } else if (market.outcomes.length > 0) {
    const prices = market.outcomes.map((o) => weiToDecimal(o.currentPrice) ?? 0);
    yesPrice = Math.max(...prices);
    noPrice = +(1 - yesPrice).toFixed(4);
  }

  return {
    external_id: String(market.id),
    title: market.title,
    platform: "xo",
    yes_price: yesPrice,
    no_price: noPrice,
    liquidity_usd: market.totalVolumeInUSD
      ? parseFloat(market.totalVolumeInUSD)
      : null,
    expiry_at: market.expiresAt ? new Date(market.expiresAt) : null,
    status: market.status,
  };
}

export async function fetchXOMarkets(): Promise<FetcherResult> {
  const tag = "[xo]";
  const baseUrl = env.XO_API_URL;
  console.log(`${tag} Fetching markets from ${baseUrl}...`);

  try {
    const allMarkets: XOMarket[] = [];
    let page = 1;

    while (true) {
      const { data: resp } = await axios.get<XOMarketsResponse>(
        `${baseUrl}/markets`,
        {
          params: {
            page,
            take: PAGE_SIZE,
            sortBy: "liquidity",
            sortOrder: "DESC",
            excludedStatuses: EXCLUDED_STATUSES,
          },
          timeout: 15000,
        }
      );

      allMarkets.push(...resp.data);
      console.log(
        `${tag} Page ${page}/${resp.meta.pageCount}: fetched ${resp.data.length} markets`
      );

      if (!resp.meta.hasNextPage) break;
      page++;
    }

    const now = Date.now();
    const active = allMarkets.filter((m) => {
      if (m.status !== "ACTIVE") return false;
      if (m.expiresAt && new Date(m.expiresAt).getTime() <= now) return false;
      return true;
    });

    const markets = active.map(normalize);
    console.log(
      `${tag} Done. ${markets.length} active markets (of ${allMarkets.length} total fetched)`
    );
    return { platform: "xo", markets, skipped: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error: ${message}`);
    return { platform: "xo", markets: [], skipped: false, error: message };
  }
}
