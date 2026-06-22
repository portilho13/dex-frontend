import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  ColorType,
} from "lightweight-charts";

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  unixTime: number;
}

interface LiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OHLCInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

type OHLCCallback = (info: OHLCInfo | null) => void;

export function useChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  intervalSeconds: number,
  onOHLC: OHLCCallback,
  isMcap: boolean
) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const liveCandleRef = useRef<LiveCandle | null>(null);
  const lastCloseRef = useRef<number>(0);
  const onOHLCRef = useRef(onOHLC);
  onOHLCRef.current = onOHLC;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0d" },
        textColor: "#a0a0a0",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        vertLine: { color: "#555" },
        horzLine: { color: "#555" },
      },
      timeScale: {
        borderColor: "#333",
        timeVisible: true,
        secondsVisible: intervalSeconds < 60,
      },
      rightPriceScale: {
        borderColor: "#333",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00c853",
      downColor: "#ff1744",
      borderDownColor: "#ff1744",
      borderUpColor: "#00c853",
      wickDownColor: "#ff1744",
      wickUpColor: "#00c853",
      priceFormat: isMcap
        ? {
            type: "custom",
            formatter: (price: number) => {
              if (price >= 1_000_000_000) return (price / 1_000_000_000).toFixed(2) + "B";
              if (price >= 1_000_000) return (price / 1_000_000).toFixed(2) + "M";
              if (price >= 1_000) return (price / 1_000).toFixed(2) + "K";
              return price.toFixed(2);
            },
            minMove: 0.01,
          }
        : {
            type: "price",
            precision: 8,
            minMove: 0.00000001,
          },
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        onOHLCRef.current(null);
        return;
      }
      const candle = param.seriesData.get(series) as CandlestickData<Time> | undefined;
      const vol = param.seriesData.get(volume) as { value?: number } | undefined;
      if (candle) {
        const change = candle.close - candle.open;
        const changePercent = candle.open !== 0 ? (change / candle.open) * 100 : 0;
        onOHLCRef.current({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value ?? 0,
          change,
          changePercent,
        });
      }
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      liveCandleRef.current = null;
    };
  }, [containerRef]);

  const setCandles = useCallback((candles: Candle[]) => {
    if (!seriesRef.current || !volumeRef.current) return;

    const sorted = [...candles].sort((a, b) => a.unixTime - b.unixTime);

    const candleData: CandlestickData<Time>[] = sorted.map((c) => ({
      time: c.unixTime as Time,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));

    const volumeData = sorted.map((c) => ({
      time: c.unixTime as Time,
      value: c.v,
      color: c.c >= c.o ? "rgba(0,200,83,0.3)" : "rgba(255,23,68,0.3)",
    }));

    seriesRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);

    if (chartRef.current && sorted.length > 0) {
      const visibleCount = 120;
      const from = sorted.length > visibleCount
        ? sorted.length - visibleCount
        : 0;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from,
        to: sorted.length + 10,
      });
    }

    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      lastCloseRef.current = last.c;
      liveCandleRef.current = {
        time: last.unixTime,
        open: last.o,
        high: last.h,
        low: last.l,
        close: last.c,
      };

      const change = last.c - last.o;
      const changePercent = last.o !== 0 ? (change / last.o) * 100 : 0;
      onOHLCRef.current({
        open: last.o,
        high: last.h,
        low: last.l,
        close: last.c,
        volume: last.v,
        change,
        changePercent,
      });
    }
  }, []);

  const updatePrice = useCallback(
    (price: number, timestampMs: number) => {
      if (!seriesRef.current) return;
      if (price <= 0) return;

      lastCloseRef.current = price;

      const candleTime =
        Math.floor(timestampMs / 1000 / intervalSeconds) * intervalSeconds;
      const live = liveCandleRef.current;

      if (live && live.time === candleTime) {
        live.high = Math.max(live.high, price);
        live.low = Math.min(live.low, price);
        live.close = price;
      } else {
        liveCandleRef.current = {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
        };
      }

      const c = liveCandleRef.current!;
      seriesRef.current.update({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });

      const change = c.close - c.open;
      const changePercent = c.open !== 0 ? (change / c.open) * 100 : 0;
      onOHLCRef.current({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: 0,
        change,
        changePercent,
      });
    },
    [intervalSeconds]
  );

  const toggleLogScale = useCallback(() => {
    if (!chartRef.current) return;
    const current = chartRef.current.options().rightPriceScale;
    const isLog = current?.mode === 1;
    chartRef.current.applyOptions({
      rightPriceScale: { mode: isLog ? 0 : 1 },
    });
    return !isLog;
  }, []);

  return { setCandles, updatePrice, toggleLogScale };
}
