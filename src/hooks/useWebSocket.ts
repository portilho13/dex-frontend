import { useEffect, useRef, useCallback } from "react";

export interface WSMessage {
  type: string;
  pool: string;
  price?: number;
  timestamp?: number;
  kind?: string;
  volumeUsd?: number;
  volumeBase?: number;
  volumeSol?: number;
  priceUsd?: number;
  txHash?: string;
  maker?: string;
}

export interface PriceTick {
  type: string;
  pool: string;
  price: number;
  timestamp: number;
}

export interface WSTrade {
  type: string;
  pool: string;
  kind: string;
  volumeUsd: number;
  volumeBase: number;
  volumeSol: number;
  priceUsd: number;
  txHash: string;
  maker: string;
  timestamp: number;
}

type MessageHandler = (msg: WSMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let cancelled = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      if (cancelled) {
        ws.close();
        return;
      }
      wsRef.current = ws;
    };

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      onMessageRef.current(msg);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const subscribe = useCallback((pool: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "subscribe", pool }));
    }
  }, []);

  const unsubscribe = useCallback((pool: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "unsubscribe", pool }));
    }
  }, []);

  return { subscribe, unsubscribe, wsRef };
}
