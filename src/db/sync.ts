import { supabase } from "./supabase.js";
import type { Market, MatchedGroup } from "../types/market.js";

const BATCH_SIZE = 50;

export async function upsertRawMarkets(markets: Market[]): Promise<{
  upserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let upserted = 0;

  for (let i = 0; i < markets.length; i += BATCH_SIZE) {
    const batch = markets.slice(i, i + BATCH_SIZE);

    const rows = batch.map((m) => {
      const [platform, ...extParts] = m.id.split("-");
      return {
        platform,
        external_id: extParts.join("-"),
        title: m.title,
        yes_price: m.yes_price,
        no_price: m.no_price,
        liquidity_usd: m.liquidity,
        expiry_at: m.expiry.toISOString(),
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      };
    });

    const { error, count } = await supabase
      .from("raw_markets")
      .upsert(rows, { onConflict: "platform,external_id" })
      .select();

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  return { upserted, errors };
}

function computeWeightedPrice(
  markets: Market[],
  field: "yes_price" | "no_price"
): number | null {
  const totalLiquidity = markets.reduce((sum, m) => sum + m.liquidity, 0);
  if (totalLiquidity === 0) return null;

  const weighted = markets.reduce(
    (sum, m) => sum + m[field] * m.liquidity,
    0
  );
  return +(weighted / totalLiquidity).toFixed(4);
}

export async function upsertAggregatedMarkets(
  groups: MatchedGroup[],
  allMarkets: Market[]
): Promise<{ upserted: number; linked: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;
  let linked = 0;

  for (const group of groups) {
    const weightedYes = computeWeightedPrice(group.markets, "yes_price");
    const weightedNo = computeWeightedPrice(group.markets, "no_price");

    const platforms = group.markets.map((m) => ({
      platform: m.platform,
      yes_price: m.yes_price,
      no_price: m.no_price,
      liquidity: m.liquidity,
      market_id: m.id,
    }));

    const { data: aggData, error: aggError } = await supabase
      .from("aggregated_markets")
      .upsert(
        {
          canonical_title: group.canonical_title,
          total_liquidity: group.total_liquidity,
          weighted_yes_price: weightedYes,
          weighted_no_price: weightedNo,
          expiry_at: group.expiry.toISOString(),
          platform_count: group.markets.length,
          platforms: JSON.stringify(platforms),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "canonical_title" }
      )
      .select()
      .single();

    if (aggError) {
      errors.push(`Agg "${group.canonical_title}": ${aggError.message}`);
      continue;
    }

    upserted++;
    const groupId = aggData.id;

    for (const market of group.markets) {
      const [platform, ...extParts] = market.id.split("-");
      const extId = extParts.join("-");

      const { data: rawRow } = await supabase
        .from("raw_markets")
        .select("id")
        .eq("platform", platform)
        .eq("external_id", extId)
        .single();

      if (rawRow) {
        const { error: linkError } = await supabase
          .from("market_group_members")
          .upsert(
            { group_id: groupId, raw_market_id: rawRow.id },
            { onConflict: "group_id,raw_market_id" }
          );

        if (linkError) {
          errors.push(`Link: ${linkError.message}`);
        } else {
          linked++;
        }
      }
    }
  }

  return { upserted, linked, errors };
}

export async function syncAll(
  markets: Market[],
  groups: MatchedGroup[]
): Promise<void> {
  const tag = "[sync]";

  console.log(`${tag} Upserting ${markets.length} raw markets...`);
  const rawResult = await upsertRawMarkets(markets);
  console.log(
    `${tag} Raw markets: ${rawResult.upserted} upserted` +
      (rawResult.errors.length > 0
        ? `, ${rawResult.errors.length} errors`
        : "")
  );
  for (const e of rawResult.errors) console.error(`  ${tag} ${e}`);

  if (groups.length > 0) {
    console.log(`${tag} Upserting ${groups.length} aggregated groups...`);
    const aggResult = await upsertAggregatedMarkets(groups, markets);
    console.log(
      `${tag} Aggregated: ${aggResult.upserted} groups, ${aggResult.linked} links` +
        (aggResult.errors.length > 0
          ? `, ${aggResult.errors.length} errors`
          : "")
    );
    for (const e of aggResult.errors) console.error(`  ${tag} ${e}`);
  } else {
    console.log(`${tag} No matched groups to upsert.`);
  }
}
