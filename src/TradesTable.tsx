import { useState, useEffect, useRef, useMemo } from "react";

export interface Trade {
  timestamp: string;
  kind: string;
  volumeUsd: number;
  volumeBase: number;
  volumeQuote: number;
  priceUsd: number;
  txHash: string;
  maker: string;
}

interface TradesTableProps {
  poolAddress: string;
  liveTrades: Trade[];
}

function timeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 0) return "now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNum(n: number, decimals = 2): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + "M";
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  if (n < 0.0001 && n > 0) return n.toExponential(2);
  return n.toFixed(decimals);
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr || "";
  return addr.slice(0, 6) + "...";
}

function txUrl(txHash: string): string {
  if (!txHash) return "";
  if (txHash.startsWith("http")) {
    const parts = txHash.split("/");
    const sig = parts[parts.length - 1];
    if (sig) return `https://solscan.io/tx/${sig}`;
  }
  return `https://solscan.io/tx/${txHash}`;
}

async function fetchTrades(address: string): Promise<Trade[]> {
  const res = await fetch(`/trades?address=${address}`);
  if (!res.ok) return [];
  return res.json();
}

const cellStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #1a1a1a",
  whiteSpace: "nowrap",
};

const headerStyle: React.CSSProperties = {
  ...cellStyle,
  color: "#666",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  position: "sticky",
  top: 0,
  background: "#0d0d0d",
};

export default function TradesTable({ poolAddress, liveTrades }: TradesTableProps) {
  const [historicalTrades, setHistoricalTrades] = useState<Trade[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    fetchTrades(poolAddress).then(setHistoricalTrades).catch(() => {});

    intervalRef.current = setInterval(() => {
      fetchTrades(poolAddress).then(setHistoricalTrades).catch(() => {});
    }, 15000);

    return () => clearInterval(intervalRef.current);
  }, [poolAddress]);

  const trades = useMemo(() => {
    const seen = new Set<string>();
    const merged: Trade[] = [];

    for (const t of liveTrades) {
      if (t.txHash && !seen.has(t.txHash)) {
        seen.add(t.txHash);
        merged.push(t);
      }
    }

    for (const t of historicalTrades) {
      if (!t.txHash || !seen.has(t.txHash)) {
        if (t.txHash) seen.add(t.txHash);
        merged.push(t);
      }
    }

    return merged.slice(0, 50);
  }, [liveTrades, historicalTrades]);

  return (
    <div
      style={{
        maxHeight: 350,
        overflowY: "auto",
        border: "1px solid #1a1a1a",
        borderRadius: 6,
        fontSize: 13,
        fontFamily: "monospace",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, textAlign: "left" }}>Date</th>
            <th style={{ ...headerStyle, textAlign: "left" }}>Type</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>USD</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Amount</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>SOL</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Price</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Trader</th>
            <th style={{ ...headerStyle, textAlign: "center" }}>TXN</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy = t.kind === "buy";
            const color = isBuy ? "#00c853" : "#ff1744";

            return (
              <tr key={t.txHash || i} style={{ color: "#a0a0a0" }}>
                <td style={{ ...cellStyle, textAlign: "left" }}>
                  {timeAgo(t.timestamp)}
                </td>
                <td style={{ ...cellStyle, textAlign: "left", color }}>
                  {isBuy ? "↑ Buy" : "↓ Sell"}
                </td>
                <td style={{ ...cellStyle, textAlign: "right", color }}>
                  {formatNum(t.volumeUsd)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {formatNum(t.volumeBase)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {formatNum(t.volumeQuote, 4)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  ${formatNum(t.priceUsd, 6)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  <a
                    href={`https://solscan.io/account/${t.maker}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#a0a0a0", textDecoration: "none" }}
                  >
                    {shortenAddress(t.maker)}
                  </a>
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  {t.txHash ? (
                    <a
                      href={txUrl(t.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#666", textDecoration: "none" }}
                    >
                      ↗
                    </a>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
