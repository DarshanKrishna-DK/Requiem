import { fetchPredictMarkets } from "./fetchers/predict.js";
import { fetchProbableMarkets } from "./fetchers/probable.js";
import { fetchXOMarkets } from "./fetchers/xo.js";
import { fetchPolymarketMarkets } from "./fetchers/polymarket.js";
import type { RawMarket, FetcherResult } from "./types/market.js";

function formatExpiry(date: Date | null): string {
  if (!date) return "N/A";
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatPrice(price: number | null): string {
  if (price === null) return "-";
  return price.toFixed(2);
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function isNotExpired(market: RawMarket): boolean {
  if (!market.expiry_at) return true;
  return market.expiry_at.getTime() > Date.now();
}

async function main() {
  console.log("\n=== Requiem Phase 1: API Connectivity Test ===\n");

  const results = await Promise.allSettled([
    fetchPredictMarkets(),
    fetchProbableMarkets(),
    fetchXOMarkets(),
    fetchPolymarketMarkets(),
  ]);

  const fetched: FetcherResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const platforms = ["predict", "probable", "xo", "polymarket"] as const;
    return {
      platform: platforms[i],
      markets: [],
      skipped: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const allMarkets = fetched.flatMap((f) => f.markets).filter(isNotExpired);

  console.log("\n--- Active Markets (filtered) ---\n");

  if (allMarkets.length === 0) {
    console.log("  No markets found.\n");
  } else {
    for (const m of allMarkets) {
      const platform = padRight(`[${m.platform}]`, 12);
      const title =
        m.title.length > 60 ? m.title.slice(0, 57) + "..." : m.title;
      const price = `Yes: ${formatPrice(m.yes_price)} / No: ${formatPrice(m.no_price)}`;
      console.log(
        `${platform} | ${padRight(title, 62)} | ${padRight(price, 20)} | Expiry: ${padRight(formatExpiry(m.expiry_at), 24)} | ${m.status}`
      );
    }
  }

  console.log("\n--- Summary ---\n");

  for (const f of fetched) {
    const count = f.markets.filter(isNotExpired).length;
    const suffix = f.skipped
      ? ` (${f.skipReason})`
      : f.error
        ? ` (error: ${f.error})`
        : "";
    console.log(`  ${padRight(f.platform + ":", 12)} ${count} markets${suffix}`);
  }

  const total = allMarkets.length;
  console.log(`\n  Total:       ${total} active markets\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
