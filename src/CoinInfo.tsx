import { useState, useEffect } from "react";

interface PoolInfo {
  name: string;
  baseSymbol: string;
  baseImage: string;
  priceUsd: string;
  fdv: number;
  marketCap: number;
  priceChange24h: string;
  volume24h: string;
  liquidity: string;
}

interface CoinInfoProps {
  poolAddress: string;
}

function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(2) + "K";
  return "$" + n.toFixed(2);
}

function formatPrice(p: string): string {
  const n = parseFloat(p);
  if (isNaN(n)) return p;
  if (n < 0.0001) return "$" + n.toExponential(4);
  if (n < 1) return "$" + n.toPrecision(5);
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function fetchPoolInfo(address: string): Promise<PoolInfo | null> {
  const res = await fetch(`/pool-info?address=${address}`);
  if (!res.ok) return null;
  return res.json();
}

const statStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const labelStyle: React.CSSProperties = {
  color: "#555",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const valueStyle: React.CSSProperties = {
  color: "#d0d0d0",
  fontSize: 14,
};

export default function CoinInfo({ poolAddress }: CoinInfoProps) {
  const [info, setInfo] = useState<PoolInfo | null>(null);

  useEffect(() => {
    fetchPoolInfo(poolAddress).then(setInfo).catch(() => setInfo(null));
  }, [poolAddress]);

  if (!info) return null;

  const change = parseFloat(info.priceChange24h || "0");
  const changeColor = change >= 0 ? "#00c853" : "#ff1744";
  const vol = parseFloat(info.volume24h || "0");
  const liq = parseFloat(info.liquidity || "0");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "12px 0",
        borderBottom: "1px solid #1a1a1a",
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {info.baseImage && (
          <img
            src={info.baseImage}
            alt={info.baseSymbol}
            style={{ width: 32, height: 32, borderRadius: "50%" }}
          />
        )}
        <div>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
            {info.name || info.baseSymbol}
          </div>
          {info.baseSymbol && (
            <div style={{ color: "#666", fontSize: 12 }}>{info.baseSymbol}</div>
          )}
        </div>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>Price</span>
        <span style={valueStyle}>{formatPrice(info.priceUsd)}</span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>24h</span>
        <span style={{ ...valueStyle, color: changeColor }}>
          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>Market Cap</span>
        <span style={valueStyle}>{info.marketCap > 0 ? formatUSD(info.marketCap) : "—"}</span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>FDV</span>
        <span style={valueStyle}>{info.fdv > 0 ? formatUSD(info.fdv) : "—"}</span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>24h Vol</span>
        <span style={valueStyle}>{vol > 0 ? formatUSD(vol) : "—"}</span>
      </div>

      <div style={statStyle}>
        <span style={labelStyle}>Liquidity</span>
        <span style={valueStyle}>{liq > 0 ? formatUSD(liq) : "—"}</span>
      </div>
    </div>
  );
}
