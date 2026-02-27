import natural from "natural";
import { sanitizeTitle } from "../adapters/market-adapter.js";
import type { Market, MatchedGroup, Platform } from "../types/market.js";

const EXPIRY_TOLERANCE_MS = 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.88;

function groupByExpiry(markets: Market[]): Market[][] {
  const sorted = [...markets].sort(
    (a, b) => a.expiry.getTime() - b.expiry.getTime()
  );

  const groups: Market[][] = [];
  let current: Market[] = [];

  for (const m of sorted) {
    if (
      current.length === 0 ||
      m.expiry.getTime() - current[0].expiry.getTime() <= EXPIRY_TOLERANCE_MS
    ) {
      current.push(m);
    } else {
      groups.push(current);
      current = [m];
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

interface CandidatePair {
  a: Market;
  b: Market;
  score: number;
  sanitizedA: string;
  sanitizedB: string;
}

function findCrossplatformPairs(group: Market[]): CandidatePair[] {
  const pairs: CandidatePair[] = [];
  const sanitized = new Map<string, string>();

  for (const m of group) {
    if (!sanitized.has(m.id)) {
      sanitized.set(m.id, sanitizeTitle(m.title));
    }
  }

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i];
      const b = group[j];

      if (a.platform === b.platform) continue;

      const sA = sanitized.get(a.id)!;
      const sB = sanitized.get(b.id)!;
      const score = natural.JaroWinklerDistance(sA, sB);

      if (score >= SIMILARITY_THRESHOLD) {
        pairs.push({ a, b, score, sanitizedA: sA, sanitizedB: sB });
      }
    }
  }

  return pairs;
}

function mergeIntoGroups(pairs: CandidatePair[]): Map<string, Set<string>> {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px !== py) parent.set(px, py);
  }

  for (const p of pairs) {
    union(p.a.id, p.b.id);
  }

  const clusters = new Map<string, Set<string>>();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root)!.add(id);
  }

  return clusters;
}

function buildMatchedGroup(markets: Market[]): MatchedGroup {
  const canonical = markets.reduce((best, m) =>
    m.title.length > best.title.length ? m : best
  );

  const totalLiquidity = markets.reduce((sum, m) => sum + m.liquidity, 0);

  const bestYes = markets.reduce((best, m) =>
    m.yes_price < best.yes_price ? m : best
  );
  const bestNo = markets.reduce((best, m) =>
    m.no_price < best.no_price ? m : best
  );

  const medianExpiry = markets
    .map((m) => m.expiry.getTime())
    .sort((a, b) => a - b);
  const expiry = new Date(medianExpiry[Math.floor(medianExpiry.length / 2)]);

  return {
    canonical_title: canonical.title,
    markets,
    total_liquidity: totalLiquidity,
    expiry,
    best_yes: { platform: bestYes.platform, price: bestYes.yes_price },
    best_no: { platform: bestNo.platform, price: bestNo.no_price },
  };
}

export interface MatchResult {
  matched: MatchedGroup[];
  unmatched: Market[];
  pairLog: {
    titleA: string;
    titleB: string;
    platformA: Platform;
    platformB: Platform;
    score: number;
  }[];
}

export function matchMarkets(markets: Market[]): MatchResult {
  const expiryGroups = groupByExpiry(markets);
  const allPairs: CandidatePair[] = [];
  const matchedIds = new Set<string>();
  const matched: MatchedGroup[] = [];

  const marketById = new Map<string, Market>();
  for (const m of markets) marketById.set(m.id, m);

  for (const group of expiryGroups) {
    if (group.length < 2) continue;

    const platforms = new Set(group.map((m) => m.platform));
    if (platforms.size < 2) continue;

    const pairs = findCrossplatformPairs(group);
    allPairs.push(...pairs);

    if (pairs.length === 0) continue;

    const clusters = mergeIntoGroups(pairs);

    for (const memberIds of clusters.values()) {
      if (memberIds.size < 2) continue;

      const groupMarkets = [...memberIds]
        .map((id) => marketById.get(id)!)
        .filter(Boolean);

      const platformSet = new Set(groupMarkets.map((m) => m.platform));
      if (platformSet.size < 2) continue;

      matched.push(buildMatchedGroup(groupMarkets));
      for (const id of memberIds) matchedIds.add(id);
    }
  }

  const unmatched = markets.filter((m) => !matchedIds.has(m.id));

  const pairLog = allPairs.map((p) => ({
    titleA: p.a.title,
    titleB: p.b.title,
    platformA: p.a.platform,
    platformB: p.b.platform,
    score: p.score,
  }));

  return { matched, unmatched, pairLog };
}
