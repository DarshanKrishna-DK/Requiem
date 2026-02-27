# Project Requiem: Technical Documentation

Version: 1.1 (MVP + Smart Contract Layer)

------------------------------------------------------------------------

## Objective

A cross-platform trading terminal and DeFi protocol that aggregates
liquidity, prices, and market depth from Predict.fun, Probable, XO Market,
and Polymarket into a single unified interface — with an on-chain smart
contract layer on BNB Smart Chain for pooled arbitrage execution.

------------------------------------------------------------------------

# 1. System Architecture

The architecture follows a Serverless-First approach to ensure the
application remains lightweight locally while being scalable in
production.

## Frontend

-   Vite + React (Fast HMR for local development)
-   Tailwind CSS for UI styling
-   wagmi + viem for wallet connectivity (MetaMask / BNB Chain)

## Backend

-   Node.js (TypeScript) + Express for API orchestration

## Database

-   Supabase (PostgreSQL) for market metadata and user state

## Matching Engine

-   Hybrid (Fuzzy Matching + Small Language Model Verification)

## Data Ingestion

-   REST APIs (Predict.fun, Probable, XO Market, Polymarket)
-   Lightweight polling strategy
-   Logic offloaded to Supabase wherever possible

## Smart Contract Layer

-   Solidity 0.8.24 on BNB Smart Chain (Hardhat)
-   RequiemVault.sol — Non-custodial staking vault
-   ArbitrageRouter.sol — Cross-platform swap executor

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

### Polymarket

-   Public Gamma API at https://gamma-api.polymarket.com
-   GET /events with pagination (limit, offset) and filtering (active, closed)
-   Events contain nested markets array with: question, conditionId, outcomePrices, endDateIso, liquidity
-   outcomePrices is a JSON string array (e.g. `["0.65","0.35"]`) — parse to extract yes/no prices
-   endDateIso provides ISO-format expiry date
-   No authentication required for read access
-   Largest prediction market — significantly increases cross-platform match potential

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
-   Expand tickers: btc → bitcoin, eth → ethereum, sol → solana
-   Normalize numbers: 90k → 90000, $90,000 → 90000

Example: "Will BTC reach 90k?" → "bitcoin 90000"

------------------------------------------------------------------------

## 2.3 The Requiem Matching Engine

Three-tier verification system:

### Tier 1 -- Hard Anchor

Markets must have identical expiry timestamps or be within a 24-hour
margin to account for timezone differences.

### Tier 2 -- Fuzzy Score

Use natural library to calculate Jaro-Winkler distance.
Threshold: \> 0.88 to proceed to Tier 3.

### Tier 3 -- AI Verification

Single call to a free-tier LLM API (Gemini 1.5 Flash or Groq).

Prompt: "Act as a financial analyst. Do these two prediction questions
resolve to the exact same outcome? \[Market A\] vs \[Market B\]. Answer
only TRUE or FALSE."

Output: TRUE or FALSE

------------------------------------------------------------------------

## 2.4 The Requiem Router (Smart Contract Layer)

To ensure Requiem is "Built on BNB," we introduce a Solidity layer for
on-chain execution. This transforms Requiem from a website into a
composable DeFi protocol.

### RequiemVault.sol — Staking & Liquidity Pooling

-   Non-custodial vault where users deposit stablecoins (USDT/USDC BEP-20)
-   Tracks per-user shares proportional to deposits
-   Share price increases as arbitrage profits are returned to the pool
-   Accumulates "Requiem Points" for each depositor (off-chain significance)
-   `deposit(uint256 amount)` — deposit stablecoins, receive shares
-   `withdraw(uint256 shares)` — burn shares, receive proportional stablecoins + earned profit
-   `executeArbitrage(...)` — owner/router-only function to use pooled funds for arbitrage
-   On-chain proof: every deposit, withdrawal, and arbitrage is emitted as an event (BscScan transparent)
-   Events: `Deposited`, `Withdrawn`, `ArbitrageExecuted`, `RewardsDistributed`

### ArbitrageRouter.sol — Arbitrage Execution Contract

-   Owner/operator restricted — only authorized addresses can trigger trades
-   `triggerArbitrage(vault, amount, target, data)` — pulls funds from vault, executes swap, returns profit
-   Minimum profit threshold (configurable, default 0.5%) prevents unprofitable trades
-   Emits `ArbitrageTriggered` event with full details for on-chain audit trail
-   Gas-optimized for BNB Smart Chain's low fees (~$0.01 per tx)

### Batch-Execution Pool Workflow

1. Users deposit stablecoins into RequiemVault
2. Matching engine identifies cross-platform arbitrage (e.g. Bitcoin cheap on Probable, expensive on XO)
3. ArbitrageRouter triggers a batch trade using pooled funds
4. Profit is returned to the vault, increasing share price for all stakers
5. Users can withdraw at any time with their proportional share of profits

### Deployment

-   Hardhat project in `contracts/` directory
-   Targets BNB Testnet (chainId 97) and BNB Mainnet (chainId 56)
-   OpenZeppelin contracts for security (Ownable, ReentrancyGuard, SafeERC20)

------------------------------------------------------------------------

# 3. Database Schema (Supabase)

## raw_markets

Stores the latest data from each platform.

``` sql
CREATE TABLE raw_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT,
  external_id TEXT,
  title TEXT,
  yes_price DECIMAL,
  no_price DECIMAL,
  liquidity_usd DECIMAL,
  expiry_at TIMESTAMPTZ,
  status TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, external_id)
);
```

Platform values: 'predict', 'probable', 'xo', 'polymarket'

## aggregated_markets

This table is queried by the frontend.

``` sql
CREATE TABLE aggregated_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title TEXT UNIQUE,
  total_liquidity DECIMAL DEFAULT 0,
  weighted_yes_price DECIMAL,
  weighted_no_price DECIMAL,
  expiry_at TIMESTAMPTZ,
  platform_count INTEGER DEFAULT 0,
  platforms JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## market_group_members

Join table linking raw markets to their aggregated group.

``` sql
CREATE TABLE market_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES aggregated_markets(id),
  raw_market_id UUID REFERENCES raw_markets(id),
  UNIQUE(group_id, raw_market_id)
);
```

------------------------------------------------------------------------

# 4. User Value Proposition

## Arbitrage Identification

Highlights price discrepancies between platforms.

Example: Buy Yes on Probable at 0.60\
Sell No on XO at 0.43

## On-Chain Arbitrage Execution

Users can deposit into the RequiemVault and earn from pooled arbitrage
profits — no need to manually trade on 4 separate platforms.

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
-   Implement Node.js fetchers for Predict.fun (REST), Probable (REST), XO Market (REST), and Polymarket (REST)
-   Verify API connectivity and filter active markets

## Phase 2

-   Implement expiry filtering
-   Implement sanitization script
-   Integrate Tier 1 & Tier 2 matching logic

## Phase 3

-   Build grouping engine with Jaro-Winkler fuzzy matching
-   Cross-platform market pairing with Union-Find clustering

## Phase 4

-   Supabase live sync (upsert raw + aggregated markets)
-   Weighted average price calculation

## Phase 5

-   Build React Arbitrage Dashboard (Vite + Tailwind)
-   Card-based layout showing aggregated liquidity
-   Display aggregated price, highlight best buy platform
-   Search bar filtered by ticker

## Phase 6

-   Write and compile Solidity contracts (RequiemVault, ArbitrageRouter)
-   Deploy to BNB Testnet
-   Frontend wallet integration (wagmi + viem, MetaMask)
-   Deposit/withdraw UI, vault stats panel

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

-   Smart order routing via ArbitrageRouter
-   Automated arbitrage execution (cron-based trigger)
-   Portfolio tracking
-   WebSocket streaming
-   Advanced arbitrage alerts
-   AI-assisted trade suggestions (Tier 3 verification)
-   Requiem governance token (on-chain DAO)

------------------------------------------------------------------------

Project Name: Requiem\
Version: 1.1 MVP + Smart Contract Layer\
Built on: BNB Smart Chain
