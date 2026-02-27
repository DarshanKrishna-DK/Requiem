# Project Requiem: Vibecoding Roadmap (V1.1)

Theme: Aggregated Liquidity, Zero Friction\
Primary Goal: Build a scalable trading terminal using 100% free cloud
tools and API-first logic.

------------------------------------------------------------------------

## Overview

This roadmap defines the execution plan for Requiem using a vibecoding
methodology.

Constraints: - Use only free cloud tools - API-first integration for
all platforms (Predict.fun, Probable, XO Market) -
Lightweight local runtime (10th Gen i7, 16GB RAM) - Track only
meaningful markets (Liquidity \> \$500) - Focus on active, non-expired
markets only

------------------------------------------------------------------------

# Phase 1: Connectivity & Pre-Filter (The "Vibe Check")

## Objective

Verify raw API connectivity and immediately filter irrelevant markets at
the source.

## Core Logic

-   Request data from:
    -   Predict.fun (REST API -- testnet, no auth required)
    -   Probable (REST API -- public Market API + CLOB midpoint endpoint)
    -   XO Market (REST API -- https://api-mainnet.xo.market/api)
-   Apply filters:
    -   active = true
    -   expiry \> now()
    -   excludedStatuses: PENDING, UPDATE_REQUIRED, CANCELLED, RESOLVED

Filtering should occur: - At API query level if supported - During
first mapping layer for scraped data

## Cursor Task

Create: src/test_ingestion.ts

Prompt: "Fetch active markets from Predict.fun testnet REST API,
Probable public Market API, and XO Market REST API. Filter out expired
entries. Log results as: \[Platform\] \| Title: \[X\] \| Expiry: \[Y\]."

## Verification

Console output shows: - Only upcoming markets - No expired entries -
Clean readable logs - Data from all 3 platforms

------------------------------------------------------------------------

# Phase 2: The Ingestion Adapter

## Objective

Standardize platform-specific JSON into a unified Requiem Market format.

## Core Logic

-   Filter Liquidity \> 500 USD
-   Normalize field names
    -   question → title
    -   end_date → expiry
    -   liquidity_usd → liquidity
-   Discard low-liquidity noise

## Unified Market Interface

interface Market { id: string title: string platform: string yes_price:
number no_price: number liquidity: number expiry: Date }

## Cursor Task

"Define a Market interface. Write three adapter functions to convert
Predict.fun, Probable, and XO Market responses into this format.
Discard any market with liquidity \< 500."

## Verification

Running script prints: - Clean array of Market objects - Mixed
platforms - Uniform structure - Liquidity \> 500 only

------------------------------------------------------------------------

# Phase 3: The Grouping Engine (The "Brain")

## Objective

Identify mathematically whether two titles represent the same financial
question.

## Core Logic

Step 1: Group by exact expiry_date (The Anchor)

Step 2: Within each expiry group: - Apply Jaro-Winkler fuzzy
similarity - Threshold \> 0.88

Library: - natural (recommended)

## Cursor Task

"Implement matchMarkets(markets: Market\[\]). Group by expiry. Inside
groups, use the natural library to find pairs with \>0.88 similarity.
Log matches like: Matched: Probable 'BTC 90k' with XO 'Bitcoin 90,000'."

## Verification

Input mock list: - BTC reach 90k - Bitcoin 90000 - ETH 5k

Expected output: - BTC pair grouped - ETH separate

------------------------------------------------------------------------

# Phase 4: Supabase Live Sync

## Objective

Move aggregation logic to the cloud and calculate weighted metrics.

## Core Logic

1.  Upsert matched groups into Supabase
2.  Maintain canonical_title per group
3.  Calculate Weighted Average Price:

P_avg = (Σ (Price × Liquidity)) / (Σ Liquidity)

4.  Store:

-   total_liquidity
-   weighted_avg_price
-   platform identifiers

## Cursor Task

"Connect to Supabase. Write an upsert function for matched groups. If
market exists, update yes_price and liquidity. Calculate and store the
global weighted average price."

## Verification

Supabase dashboard shows: - Aggregated records - Correct weighted
pricing - Updated liquidity totals

------------------------------------------------------------------------

# Phase 5: The Arbitrage Dashboard (UI)

## Objective

Deliver a high-performance, minimal friction trading terminal.

## Tech Stack

-   Vite
-   React
-   Tailwind CSS

## Core Logic

Each card must show: 1. Canonical Title 2. Global Liquidity 3. Price
comparison table 4. Highlight Best Buy platform (green) 5. Search bar
(Filter by ticker)

Arbitrage Highlight Rule: - If one platform YES price is significantly
lower than others - Highlight as opportunity

## Cursor Task

"Build a React grid. Each card represents an aggregated market. Show
canonical title, global liquidity, and platform price table. Highlight
the Best Buy platform in green. Add search bar filtering by ticker."

## Verification

Open: http://localhost:5173

You should see: - Aggregated cards - Search functionality - Best price
visually highlighted

------------------------------------------------------------------------

# Performance & Scalability Considerations

## API-First Design

-   REST APIs for all three platforms: Predict.fun, Probable, and XO Market
-   Poll interval: 30--60 seconds

## Memory Constraints

-   Keep Node process under 500MB RAM
-   Use batch inserts to Supabase
-   Avoid storing raw full JSON payloads

## Cloud Offloading

-   Weighted math executed before UI render
-   Supabase handles persistent state
-   Frontend only reads aggregated endpoints

------------------------------------------------------------------------

# Final MVP Completion Criteria

Requiem V1.1 MVP is complete when:

-   Active markets ingested from 3 platforms
-   Low-liquidity noise removed
-   Identical markets grouped correctly
-   Weighted average pricing calculated
-   Supabase live sync operational
-   Arbitrage dashboard visually functional
-   Best price identified across platforms

------------------------------------------------------------------------

Project Name: Requiem Version: Vibecoding Roadmap V1.1 Theme: Aggregated
Liquidity, Zero Friction
