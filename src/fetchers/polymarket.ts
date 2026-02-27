import axios from "axios";
import { env } from "../config/env.js";
import type { RawMarket, FetcherResult } from "../types/market.js";

interface PolyMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string | null;
  endDateIso: string | null;
  outcomePrices: string;
  outcomes: string;
  volume: string;
  liquidity: number;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
}

interface PolyEvent {
  id: string;
  title: string;
  slug: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  endDate: string | null;
  markets: PolyMarket[];
}

const PAGE_SIZE = 100;
const MAX_EVENTS = 500; // Cap to avoid fetching 30K+ markets; top by liquidity

function parseOutcomePrices(raw: string): { yes: number; no: number } | null {
  try {
    const arr = JSON.parse(raw) as string[];
    if (arr.length < 2) return null;
    const yes = parseFloat(arr[0]);
    const no = parseFloat(arr[1]);
    if (isNaN(yes) || isNaN(no)) return null;
    return { yes: +yes.toFixed(4), no: +no.toFixed(4) };
  } catch {
    return null;
  }
}

function normalize(market: PolyMarket, eventLiquidity: number): RawMarket {
  const prices = parseOutcomePrices(market.outcomePrices);

  const expiry = market.endDateIso || market.endDate;

  const rawLiquidity = market.liquidity ?? market.liquidityNum ?? eventLiquidity;
  const liquidity = rawLiquidity != null ? Number(rawLiquidity) : null;

  return {
    external_id: market.conditionId || market.id,
    title: market.question,
    platform: "polymarket",
    yes_price: prices?.yes ?? null,
    no_price: prices?.no ?? null,
    liquidity_usd: isNaN(liquidity as number) ? null : liquidity,
    expiry_at: expiry ? new Date(expiry) : null,
    status: "ACTIVE",
  };
}

export async function fetchPolymarketMarkets(): Promise<FetcherResult> {
  const tag = "[polymarket]";
  const baseUrl = env.POLYMARKET_API_URL;
  console.log(`${tag} Fetching events from ${baseUrl}...`);

  try {
    const allMarkets: RawMarket[] = [];
    let offset = 0;
    let page = 1;

    while (true) {
      const { data: events } = await axios.get<PolyEvent[]>(
        `${baseUrl}/events`,
        {
          params: {
            active: true,
            closed: false,
            limit: PAGE_SIZE,
            offset,
            order: "liquidity",
            ascending: false,
          },
          timeout: 20000,
        }
      );

      if (!events || events.length === 0) break;

      for (const event of events) {
        if (!event.markets) continue;

        for (const market of event.markets) {
          if (!market.active || market.closed) continue;
          allMarkets.push(normalize(market, event.liquidity));
        }
      }

      console.log(
        `${tag} Page ${page}: ${events.length} events → ${allMarkets.length} markets so far`
      );

      if (events.length < PAGE_SIZE || offset + PAGE_SIZE >= MAX_EVENTS) break;
      offset += PAGE_SIZE;
      page++;
    }

    const now = Date.now();
    const active = allMarkets.filter((m) => {
      if (m.expiry_at && m.expiry_at.getTime() <= now) return false;
      return true;
    });

    console.log(
      `${tag} Done. ${active.length} active markets (of ${allMarkets.length} total)`
    );
    return { platform: "polymarket", markets: active, skipped: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error: ${message}`);
    return {
      platform: "polymarket",
      markets: [],
      skipped: false,
      error: message,
    };
  }
}
