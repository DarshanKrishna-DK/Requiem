# Project Requiem: Technical Documentation

Version: 1.0 (MVP)

------------------------------------------------------------------------

## Objective

A cross-platform trading terminal that aggregates liquidity, prices, and
market depth from Probable, Predict.fun, and XO Market into a single
unified interface.

------------------------------------------------------------------------

# 1. System Architecture

The architecture follows a Serverless-First approach to ensure the
application remains lightweight locally while being scalable in
production.

## Frontend

-   Vite + React (Fast HMR for local development)
-   Tailwind CSS for UI styling

## Backend

-   Node.js (TypeScript) + Express for API orchestration

## Database

-   Supabase (PostgreSQL) for market metadata and user state

## Matching Engine

-   Hybrid (Fuzzy Matching + Small Language Model Verification)

## Data Ingestion

-   REST APIs (Predict.fun, Probable, XO Market)
-   Lightweight polling strategy
-   Logic offloaded to Supabase wherever possible

------------------------------------------------------------------------

# 2. Core Modules

## 2.1 The Ingestion Engine (Fetchers)

Requiem uses native API calls to minimize CPU usage.

Each platform has a dedicated Fetcher class that normalizes output into
a unified RawMarket interface.

### RawMarket Interface

{ external_id, title, platform, yes_price, no_price, liquidity,
expiry_timestamp }

### Predict.fun

-   Testnet REST API at https://api-testnet.predict.fun (no auth)
-   Mainnet REST API at https://api.predict.fun (API key required)
-   GET /v1/markets for market listings, filter by tradingStatus/status

### Probable

-   Public Market API at https://market-api.probable.markets/public/api/v1
-   Orderbook CLOB API at https://api.probable.markets/public/api/v1
-   Events endpoint returns markets with endDate, liquidity, token IDs
-   Midpoint endpoint provides current price per token (no auth for read)
-   SDK available: @prob/clob (npm, optional)

### XO Market

-   Undocumented public REST API at https://api-mainnet.xo.market/api
-   GET /markets with pagination (page, take) and sorting params
-   Returns structured JSON: id, title, status, expiresAt, outcomes with prices, totalVolumeInUSD
-   Outcome prices in 18-decimal wei format (divide by 1e18 for probability)
-   Supports BINARY and MULTIPLE market types
-   No authentication required

------------------------------------------------------------------------

## 2.2 The Normalization Pipeline

Raw data is cleaned before matching to avoid unnecessary processing.

### Filtering

Discard any market where: expiry_timestamp \<= Date.now()

### Sanitization

-   Convert all strings to lowercase
-   Remove punctuation
-   Remove filler words: \[will, can, touch, reach, get, to, at, the, a,
    is\]
-   Extract tickers (BTC, ETH, SOL) using regex

Example: "Will BTC reach 90k?" → "btc 90k"

------------------------------------------------------------------------

## 2.3 The Requiem Matching Engine

Three-tier verification system:

### Tier 1 -- Hard Anchor

Markets must have identical expiry timestamps or be within a 1-hour
margin to account for timezone differences.

### Tier 2 -- Fuzzy Score

Use natural or fuse.js library to calculate Jaro-Winkler distance.
Threshold: \> 0.88 to proceed to Tier 3.

### Tier 3 -- AI Verification

Single call to a free-tier LLM API (Gemini 1.5 Flash or Groq).

Prompt: "Act as a financial analyst. Do these two prediction questions
resolve to the exact same outcome? \[Market A\] vs \[Market B\]. Answer
only TRUE or FALSE."

Output: TRUE or FALSE

------------------------------------------------------------------------

# 3. Database Schema (Supabase)

## raw_markets

Stores the latest data from each platform.

``` sql
CREATE TABLE raw_markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT,
  external_id TEXT,
  title TEXT,
  yes_price DECIMAL,
  no_price DECIMAL,
  liquidity_usd DECIMAL,
  expiry_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## aggregated_terminals

This table is queried by the frontend.

``` sql
CREATE TABLE aggregated_terminals (
  id UUID PRIMARY KEY,
  canonical_title TEXT,
  total_liquidity DECIMAL,
  weighted_avg_price DECIMAL,
  platform_links JSONB
);
```

## raw_data (Blueprint Schema)

  Column          Type        Description
  --------------- ----------- ----------------------------
  id              UUID        Primary Key
  platform_id     Text        ID from source
  platform_name   Text        'probable', 'predict', 'xo'
  raw_title       Text        Original question
  expiry          Timestamp   Resolution time

## aggregated_markets (Blueprint Schema)

Stores canonical_title and unique terminal_id. Use a join table to link
multiple raw_data entries to one terminal_id.

------------------------------------------------------------------------

# 4. User Value Proposition

## Arbitrage Identification

Highlights price discrepancies between platforms.

Example: Buy Yes on Probable at 0.60\
Sell No on XO at 0.43

## Slippage Optimization

For large trades, Requiem calculates how to split orders across
platforms to achieve best average execution price.

## Unified Market Depth

Displays total global liquidity across platforms for higher confidence
in crowd wisdom.

------------------------------------------------------------------------

# 5. Development Roadmap (MVP)

## Phase 1

-   Setup TypeScript project with tsx runner
-   Implement Node.js fetchers for Predict.fun (REST), Probable (REST), and XO Market (REST)
-   Verify API connectivity and filter active markets

## Phase 2

-   Implement expiry filtering
-   Implement sanitization script
-   Integrate Tier 1 & Tier 2 matching logic

## Phase 3

-   Build React Terminal View
-   Card-based layout showing aggregated liquidity
-   Display aggregated price
-   Highlight best buy platform

## Phase 4

-   Integrate SLM verification layer
-   Eliminate false positives

------------------------------------------------------------------------

# 6. Performance Optimization Guidelines

## Batch Processing

Fetch all markets, group them by expiry_date, then run fuzzy matching
within groups to reduce computation overhead.

## Memory Management

Use batch inserts or streaming for Supabase to keep the Node.js process
under 500MB RAM.

## Hardware Context

Development machine: 10th Gen i7 (4 cores) 16GB RAM Design must remain
lightweight and efficient.

------------------------------------------------------------------------

# Future Scope

-   Smart order routing
-   Cross-platform execution engine
-   Portfolio tracking
-   WebSocket streaming
-   Advanced arbitrage alerts
-   AI-assisted trade suggestions

------------------------------------------------------------------------

Project Name: Requiem\
Version: 1.0 MVP
