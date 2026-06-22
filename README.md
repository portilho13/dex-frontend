# dex-frontend

React frontend for the dex price chart viewer. Renders live candlestick charts, token info, and trade history using data from the Go backend.

## Project Structure

```
src/
├── main.tsx                # React entry point
├── index.css               # Global styles (dark theme)
├── App.tsx                 # Layout, WebSocket owner, state management
├── Chart.tsx               # Chart container, OHLC header, timeframe definitions
├── CoinInfo.tsx            # Token info bar (image, name, price, stats)
├── TradesTable.tsx         # Trade history table (live + historical)
└── hooks/
    ├── useChart.ts         # lightweight-charts lifecycle, candle + volume rendering
    └── useWebSocket.ts     # WebSocket connection, message routing
```

## How It Works

### App.tsx — State Owner

Top-level component that owns all shared state:

- **WebSocket** — single connection, persists across timeframe/mode changes
- **Pool address** — preloaded with a default, or entered by the user
- **Timeframe** — 1s, 1m, 5m, 15m, 1H, 4H, 12H, 1D
- **Price/MCap mode** — raw price or price multiplied by total supply
- **Live trades** — received via WebSocket, merged into TradesTable

WebSocket messages are routed by type: `"price"` updates the chart, `"trade"` prepends to the trades table. The WebSocket subscribe retries every 500ms until the connection is ready, handling the case where the page loads with a preloaded pool address before the WS connects.

### Chart.tsx — Candlestick Chart

Fetches historical candles from `/ohlcv` once on mount. After that, all new candles are formed from live WebSocket price ticks.

- **Timeframe buttons** — each remounts the chart via React `key` prop, fetching fresh history
- **OHLC header** — shows O/H/L/C, volume, % change on crosshair hover
- **Log scale toggle** — linear vs logarithmic Y-axis
- **MCap multiplier** — multiplies all OHLC values by total supply when active

### useChart.ts — Chart Engine

Manages the TradingView lightweight-charts instance with two series:

- **Candlestick** — price data with 8 decimal precision (or K/M/B formatter in MCap mode)
- **Histogram** — volume bars pinned to bottom 15%

Live candle formation: each tick is bucketed into a time window based on the selected interval. Same bucket → updates high/low/close. New bucket → opens a new candle. The chart scrolls to show the last 120 candles on initial load.

### useWebSocket.ts — WebSocket Hook

Single connection at `ws://{host}/ws`. Supports two message types:

- `"price"` — `{pool, price, timestamp}` for live chart updates
- `"trade"` — `{pool, kind, volumeBase, volumeSol, txHash, maker, timestamp}` for live trade entries

### CoinInfo.tsx — Token Info Bar

Fetches from `/pool-info` and displays token image, name, symbol, price, 24h change, market cap, FDV, volume, and liquidity. Falls back to showing the pool address if the API fails (pool not on GeckoTerminal).

### TradesTable.tsx — Trade History

Merges two sources:

- **Historical** — polled from `/trades` every 15 seconds
- **Live** — received via WebSocket from App

Deduplicated by transaction hash. Each row links the trader to Solscan account page and the transaction to Solscan tx page. Auto-scrollable with sticky header.

## Limitations

- **Historical data depends on GeckoTerminal** — if a pool isn't indexed by GeckoTerminal, only live WebSocket candles will show (no history)
- **No drawing tools or indicators** — lightweight-charts is the free/open-source TradingView library. Trendlines, RSI, MACD etc. require the commercial TradingView Charting Library
- **Live candle accuracy** — candles are built from 1-second price snapshots, not from actual trade data. Wicks may miss intra-second price extremes
- **MCap calculation** — total supply is derived from FDV/price via GeckoTerminal. If GeckoTerminal doesn't have the pool, MCap mode shows raw price instead
- **Trade amounts** — live trades from WebSocket only include signature and buy/sell type, not exact amounts. Full trade details come from GeckoTerminal polling with 15s delay
- **Single pool view** — only one pool can be viewed at a time. No multi-chart or watchlist
- **No persistent state** — refreshing the page resets to the default pool and timeframe

## Dev Proxy

`vite.config.ts` proxies these routes to the Go backend at `localhost:8080`:

| Path | Type |
|---|---|
| `/ws` | WebSocket |
| `/ohlcv` | REST |
| `/trades` | REST |
| `/pool-info` | REST |

## Running

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Requires the backend running on port 8080.

## Building

```bash
npm run build
```

Output in `dist/`. Serve with Nginx or any static file server.
