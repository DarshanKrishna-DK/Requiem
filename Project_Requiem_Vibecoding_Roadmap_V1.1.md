# Project Requiem: Vibecoding Roadmap (V1.1)

Theme: Aggregated Liquidity, Zero Friction\
Primary Goal: Build a scalable trading terminal and DeFi protocol using
100% free cloud tools and API-first logic, built on BNB Smart Chain.

------------------------------------------------------------------------

## Overview

This roadmap defines the execution plan for Requiem using a vibecoding
methodology.

Constraints: - Use only free cloud tools - API-first integration for
all platforms (Predict.fun, Probable, XO Market, Polymarket) -
Lightweight local runtime (10th Gen i7, 16GB RAM) - Track only
meaningful markets (Liquidity \> \$500) - Focus on active, non-expired
markets only - Smart contract layer on BNB Smart Chain for on-chain execution

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
    -   Polymarket (REST API -- https://gamma-api.polymarket.com)
-   Apply filters:
    -   active = true
    -   expiry \> now()
    -   excludedStatuses: PENDING, UPDATE_REQUIRED, CANCELLED, RESOLVED

Filtering should occur: - At API query level if supported - During
first mapping layer for scraped data

## Cursor Task

Create: src/test_ingestion.ts

Prompt: "Fetch active markets from Predict.fun testnet REST API,
Probable public Market API, XO Market REST API, and Polymarket Gamma API.
Filter out expired entries. Log results as: \[Platform\] \| Title: \[X\]
\| Expiry: \[Y\]."

## Verification

Console output shows: - Only upcoming markets - No expired entries -
Clean readable logs - Data from all 4 platforms

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

"Define a Market interface. Write four adapter functions to convert
Predict.fun, Probable, XO Market, and Polymarket responses into this
format. Discard any market with liquidity \< 500."

## Verification

Running script prints: - Clean array of Market objects - Mixed
platforms (4 sources) - Uniform structure - Liquidity \> 500 only

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
Log matches like: Matched: Probable 'BTC 90k' with Polymarket 'Bitcoin 90,000'."

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

Supabase dashboard shows: - Aggregated records from 4 platforms - Correct weighted
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

You should see: - Aggregated cards from 4 platforms - Search functionality - Best price
visually highlighted

------------------------------------------------------------------------

# Phase 6: The Requiem Router (Smart Contract Layer)

## Objective

Deploy BNB-native smart contracts for pooled liquidity and on-chain
arbitrage execution. Transform Requiem from a "website" into a composable
"protocol" that other developers can build on top of.

## Tech Stack

-   Solidity 0.8.24
-   Hardhat
-   OpenZeppelin Contracts
-   BNB Smart Chain (Testnet → Mainnet)
-   wagmi + viem (frontend wallet integration)

## Core Logic

### Smart Contracts

1. **RequiemVault.sol** — Non-custodial staking vault
   - Users deposit USDT (BEP-20) via `deposit(uint256 amount)`
   - Tracks per-user shares proportional to pool
   - Accumulates "Requiem Points" per depositor
   - `withdraw(uint256 shares)` returns proportional USDT + earned profit
   - `executeArbitrage(...)` callable only by the ArbitrageRouter
   - Every action emitted as an on-chain event for BscScan transparency

2. **ArbitrageRouter.sol** — Cross-platform swap executor
   - Owner/operator restricted
   - `triggerArbitrage(vault, amount, target, data)` pulls funds, executes swap, returns profit
   - Minimum profit threshold prevents unprofitable trades
   - Gas-optimized for BNB's low fees (~$0.01/tx)

### Frontend Integration

3. **Wallet Connect** — MetaMask via wagmi injected connector
4. **VaultPanel** — Deposit/withdraw UI, pool stats, user shares, Requiem Points
5. **WagmiProvider** wraps the entire React app (main.tsx)

### Batch-Execution Pool Workflow

1. Users deposit stablecoins into RequiemVault
2. Matching engine identifies arbitrage opportunity
3. ArbitrageRouter executes batch trade with pooled funds
4. Profit returned to vault → share price increases for all stakers
5. Users withdraw at any time with proportional profit

## Cursor Task

"Set up a Hardhat project in contracts/ targeting BNB Testnet. Write
RequiemVault.sol (deposit, withdraw, shares, points, executeArbitrage)
and ArbitrageRouter.sol (triggerArbitrage, operator restriction, min profit).
Use OpenZeppelin for Ownable, ReentrancyGuard, SafeERC20. Create deploy
script. In the frontend, add wagmi + viem, create WalletConnect button,
VaultPanel with deposit/withdraw, and useVault hook."

## Verification

-   `npx hardhat compile` succeeds with 0 errors
-   `npx hardhat run scripts/deploy.ts --network bscTestnet` deploys both contracts
-   Frontend shows Connect Wallet button, VaultPanel expands with deposit/withdraw
-   BscScan shows contract verification and event logs

------------------------------------------------------------------------

# Performance & Scalability Considerations

## API-First Design

-   REST APIs for all four platforms: Predict.fun, Probable, XO Market, and Polymarket
-   Poll interval: 30--60 seconds

## Memory Constraints

-   Keep Node process under 500MB RAM
-   Use batch inserts to Supabase
-   Avoid storing raw full JSON payloads

## Cloud Offloading

-   Weighted math executed before UI render
-   Supabase handles persistent state
-   Frontend only reads aggregated endpoints

## Gas Optimization

-   BNB Smart Chain selected for low transaction costs
-   Batch operations where possible
-   Minimum profit threshold to avoid unprofitable arbitrage

------------------------------------------------------------------------

# Final MVP Completion Criteria

Requiem V1.1 MVP is complete when:

-   Active markets ingested from 4 platforms (Predict.fun, Probable, XO Market, Polymarket)
-   Low-liquidity noise removed
-   Identical markets grouped correctly across platforms
-   Weighted average pricing calculated
-   Supabase live sync operational
-   Arbitrage dashboard visually functional
-   Best price identified across platforms
-   Smart contracts compiled and deployable to BNB Testnet
-   Frontend wallet integration operational (connect, deposit, withdraw)
-   On-chain proof of trades via BscScan event logs

------------------------------------------------------------------------

Project Name: Requiem
Version: Vibecoding Roadmap V1.1
Theme: Aggregated Liquidity, Zero Friction
Built on: BNB Smart Chain
