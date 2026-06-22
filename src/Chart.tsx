import { useRef, useEffect, useCallback, useState } from "react";
import { useChart, type Candle, type OHLCInfo } from "./hooks/useChart";
import type { PriceTick } from "./hooks/useWebSocket";

export interface TimeframeOption {
  label: string;
  aggregate: string;
  timeframe: string;
  seconds: number;
}

export const TIMEFRAMES: TimeframeOption[] = [
  { label: "1s", aggregate: "", timeframe: "", seconds: 1 },
  { label: "1m", aggregate: "1", timeframe: "minute", seconds: 60 },
  { label: "5m", aggregate: "5", timeframe: "minute", seconds: 300 },
  { label: "15m", aggregate: "15", timeframe: "minute", seconds: 900 },
  { label: "1H", aggregate: "1", timeframe: "hour", seconds: 3600 },
  { label: "4H", aggregate: "4", timeframe: "hour", seconds: 14400 },
  { label: "12H", aggregate: "12", timeframe: "hour", seconds: 43200 },
  { label: "1D", aggregate: "1", timeframe: "day", seconds: 86400 },
];

interface ChartProps {
  poolAddress: string;
  timeframe: TimeframeOption;
  lastTick: PriceTick | null;
  multiplier: number;
}

function formatValue(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (Math.abs(n) < 0.0001) return n.toExponential(4);
  if (Math.abs(n) < 1) return n.toPrecision(5);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return v.toFixed(2);
}

function applyMultiplier(candles: Candle[], m: number): Candle[] {
  if (m === 1) return candles;
  return candles.map((c) => ({
    ...c,
    o: c.o * m,
    h: c.h * m,
    l: c.l * m,
    c: c.c * m,
  }));
}

async function fetchCandles(
  address: string,
  tf: TimeframeOption
): Promise<Candle[]> {
  const res = await fetch(
    `/ohlcv?address=${address}&aggregate=${tf.aggregate}&timeframe=${tf.timeframe}`
  );
  if (!res.ok) throw new Error(`Failed to fetch candles: ${res.status}`);
  return res.json();
}

export default function Chart({ poolAddress, timeframe, lastTick, multiplier }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ohlc, setOhlc] = useState<OHLCInfo | null>(null);
  const [logScale, setLogScale] = useState(false);
  const loadedRef = useRef(false);

  const onOHLC = useCallback((info: OHLCInfo | null) => {
    setOhlc(info);
  }, []);

  const { setCandles, updatePrice, toggleLogScale } = useChart(
    containerRef,
    timeframe.seconds,
    onOHLC,
    multiplier > 1
  );

  useEffect(() => {
    loadedRef.current = false;
    if (!timeframe.aggregate) {
      loadedRef.current = true;
      return;
    }

    fetchCandles(poolAddress, timeframe)
      .then((candles) => {
        setCandles(applyMultiplier(candles, multiplier));
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });

    const interval = setInterval(() => {
      fetchCandles(poolAddress, timeframe)
        .then((candles) => setCandles(applyMultiplier(candles, multiplier)))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [poolAddress, timeframe, setCandles, multiplier]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (lastTick && lastTick.pool === poolAddress) {
      updatePrice(lastTick.price * multiplier, lastTick.timestamp);
    }
  }, [lastTick, poolAddress, updatePrice, multiplier]);

  const handleLogToggle = () => {
    const isLog = toggleLogScale();
    if (isLog !== undefined) setLogScale(isLog);
  };

  const changeColor = ohlc && ohlc.change >= 0 ? "#00c853" : "#ff1744";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 0",
          fontSize: 13,
          fontFamily: "monospace",
          flexWrap: "wrap",
        }}
      >
        {ohlc && (
          <>
            <span>
              <span style={{ color: "#666" }}>O </span>
              <span style={{ color: "#d0d0d0" }}>{formatValue(ohlc.open)}</span>
            </span>
            <span>
              <span style={{ color: "#666" }}>H </span>
              <span style={{ color: "#d0d0d0" }}>{formatValue(ohlc.high)}</span>
            </span>
            <span>
              <span style={{ color: "#666" }}>L </span>
              <span style={{ color: "#d0d0d0" }}>{formatValue(ohlc.low)}</span>
            </span>
            <span>
              <span style={{ color: "#666" }}>C </span>
              <span style={{ color: "#d0d0d0" }}>{formatValue(ohlc.close)}</span>
            </span>
            <span>
              <span style={{ color: "#666" }}>Vol </span>
              <span style={{ color: "#d0d0d0" }}>{formatVolume(ohlc.volume)}</span>
            </span>
            <span style={{ color: changeColor }}>
              {ohlc.change >= 0 ? "+" : ""}
              {formatValue(ohlc.change)} ({ohlc.changePercent >= 0 ? "+" : ""}
              {ohlc.changePercent.toFixed(2)}%)
            </span>
          </>
        )}
        <button
          onClick={handleLogToggle}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            background: logScale ? "#333" : "#1a1a1a",
            border: logScale ? "1px solid #555" : "1px solid #333",
            borderRadius: 4,
            color: logScale ? "#fff" : "#666",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          log
        </button>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: "500px" }} />
    </div>
  );
}
