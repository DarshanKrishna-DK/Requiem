import type { RawMarket, Market } from "../types/market.js";

const MIN_LIQUIDITY_USD = 500;

const FILLER_WORDS = new Set([
  "will", "can", "touch", "reach", "get", "to", "at", "the",
  "a", "is", "be", "by", "on", "in", "of", "or", "and", "for",
  "before", "after", "above", "below", "hit", "win", "exceed",
]);

const TICKER_REGEX = /\b[A-Z]{2,5}\b/g;

const TICKER_EXPANSIONS: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  bnb: "binance",
  xrp: "ripple",
  doge: "dogecoin",
  ada: "cardano",
  dot: "polkadot",
  avax: "avalanche",
  matic: "polygon",
  link: "chainlink",
  uni: "uniswap",
  ltc: "litecoin",
  atom: "cosmos",
  near: "near",
  apt: "aptos",
  arb: "arbitrum",
  op: "optimism",
  sui: "sui",
  idr: "rupiah",
};

function expandNumber(token: string): string {
  const match = token.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/i);
  if (!match) return token;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") return String(num * 1000);
  if (suffix === "m") return String(num * 1_000_000);
  if (suffix === "b") return String(num * 1_000_000_000);
  return token;
}

export function adaptRawToMarket(raw: RawMarket): Market | null {
  if (raw.yes_price === null || raw.no_price === null) return null;
  if (raw.liquidity_usd === null || raw.liquidity_usd < MIN_LIQUIDITY_USD) return null;
  if (raw.expiry_at === null) return null;
  if (raw.expiry_at.getTime() <= Date.now()) return null;

  return {
    id: `${raw.platform}-${raw.external_id}`,
    title: raw.title,
    platform: raw.platform,
    yes_price: raw.yes_price,
    no_price: raw.no_price,
    liquidity: raw.liquidity_usd,
    expiry: raw.expiry_at,
  };
}

export function adaptAll(rawMarkets: RawMarket[]): Market[] {
  const markets: Market[] = [];
  for (const raw of rawMarkets) {
    const adapted = adaptRawToMarket(raw);
    if (adapted) markets.push(adapted);
  }
  return markets;
}

export function sanitizeTitle(title: string): string {
  let cleaned = title.toLowerCase();

  cleaned = cleaned.replace(/[\$€£]\s?(\d[\d,]*\.?\d*)/g, (_m, num) =>
    num.replace(/,/g, "")
  );
  cleaned = cleaned.replace(/(\d),(\d{3})/g, "$1$2");

  cleaned = cleaned.replace(/[^\w\s]/g, " ");

  const tokens = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FILLER_WORDS.has(w))
    .map((w) => TICKER_EXPANSIONS[w] || w)
    .map(expandNumber);

  return tokens.join(" ").trim();
}
