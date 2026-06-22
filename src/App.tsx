import { useState, useCallback, useEffect, useRef } from "react";
import Chart, { TIMEFRAMES, type TimeframeOption } from "./Chart";
import CoinInfo from "./CoinInfo";
import TradesTable, { type Trade } from "./TradesTable";
import { useWebSocket, type PriceTick, type WSTrade, type WSMessage } from "./hooks/useWebSocket";

type ChartMode = "price" | "mcap";

const btnStyle = (active: boolean) => ({
  padding: "6px 12px",
  background: active ? "#333" : "#1a1a1a",
  border: active ? "1px solid #555" : "1px solid #333",
  borderRadius: 4,
  color: active ? "#fff" : "#888",
  cursor: "pointer" as const,
  fontSize: 13,
});

async function fetchSupply(address: string): Promise<number> {
  const res = await fetch(`/pool-info?address=${address}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.totalSupply || 0;
}

export default function App() {
  const defaultPool = "93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu";
  const [input, setInput] = useState(defaultPool);
  const [poolAddress, setPoolAddress] = useState(defaultPool);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAMES[1]);
  const [lastTick, setLastTick] = useState<PriceTick | null>(null);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [mode, setMode] = useState<ChartMode>("mcap");
  const [totalSupply, setTotalSupply] = useState(0);
  const poolRef = useRef(poolAddress);
  poolRef.current = poolAddress;

  const onMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "price") {
      setLastTick(msg as PriceTick);
    } else if (msg.type === "trade" && msg.pool === poolRef.current) {
      const t = msg as WSTrade;
      const trade: Trade = {
        timestamp: new Date(t.timestamp).toISOString(),
        kind: t.kind,
        volumeUsd: t.volumeUsd || 0,
        volumeBase: t.volumeBase || 0,
        volumeQuote: t.volumeSol || 0,
        priceUsd: t.priceUsd || 0,
        txHash: t.txHash || "",
        maker: t.maker || "",
      };
      setLiveTrades((prev) => [trade, ...prev].slice(0, 100));
    }
  }, []);

  const { subscribe, unsubscribe, wsRef } = useWebSocket(onMessage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && trimmed !== poolAddress) {
      if (poolAddress) unsubscribe(poolAddress);
      setLiveTrades([]);
      setPoolAddress(trimmed);
    }
  };

  useEffect(() => {
    if (!poolAddress) return;

    fetchSupply(poolAddress)
      .then(setTotalSupply)
      .catch(() => setTotalSupply(0));

    let retryTimer: ReturnType<typeof setTimeout>;

    const waitAndSubscribe = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        subscribe(poolAddress);
      } else if (ws) {
        ws.addEventListener("open", () => subscribe(poolAddress), {
          once: true,
        });
      } else {
        retryTimer = setTimeout(waitAndSubscribe, 500);
      }
    };

    waitAndSubscribe();

    return () => {
      clearTimeout(retryTimer);
      unsubscribe(poolAddress);
    };
  }, [poolAddress, subscribe, unsubscribe, wsRef]);

  const multiplier = mode === "mcap" && totalSupply > 0 ? totalSupply : 1;

  return (
    <div style={{ background: "#0d0d0d", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>dex</h1>

        <form onSubmit={handleSubmit} style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pool address"
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 6,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Load
          </button>
        </form>

        {poolAddress && (
          <>
            <CoinInfo poolAddress={poolAddress} />
            <div style={{ display: "flex", gap: 4, marginBottom: 12, alignItems: "center" }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => { setLastTick(null); setTimeframe(tf); }}
                  style={btnStyle(tf.label === timeframe.label)}
                >
                  {tf.label}
                </button>
              ))}
              <div style={{ marginLeft: 16, display: "flex", gap: 0, border: "1px solid #333", borderRadius: 4, overflow: "hidden" }}>
                <button
                  onClick={() => setMode("price")}
                  style={{
                    padding: "6px 12px",
                    background: mode === "price" ? "#333" : "#1a1a1a",
                    border: "none",
                    color: mode === "price" ? "#fff" : "#888",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Price
                </button>
                <button
                  onClick={() => setMode("mcap")}
                  style={{
                    padding: "6px 12px",
                    background: mode === "mcap" ? "#333" : "#1a1a1a",
                    border: "none",
                    borderLeft: "1px solid #333",
                    color: mode === "mcap" ? "#fff" : "#888",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  MCap
                </button>
              </div>
            </div>
            <Chart
              key={`${poolAddress}-${timeframe.label}-${mode}`}
              poolAddress={poolAddress}
              timeframe={timeframe}
              lastTick={lastTick}
              multiplier={multiplier}
            />
            <div style={{ marginTop: 16 }}>
              <TradesTable poolAddress={poolAddress} liveTrades={liveTrades} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
