import { useEffect, useRef, useState } from "react";

type SseStatus = "connecting" | "open" | "closed" | "error";

export function useSse<TEventMap extends Record<string, unknown>>(
  url: string,
  handlers: Partial<{ [K in keyof TEventMap]: (data: TEventMap[K]) => void }>
) {
  const [status, setStatus] = useState<SseStatus>("connecting");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");

      es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setStatus("open");

      es.onerror = () => {
        setStatus("error");
        // EventSource auto-retries, but it can get stuck depending on proxies.
        // We force a reconnect cycle after a short delay.
        es?.close();
        setStatus("closed");
        if (!stopped) {
          retryTimer = setTimeout(connect, 1000);
        }
      };

      // Attach typed handlers for named events
      for (const [eventName, fn] of Object.entries(handlers)) {
        if (!fn) continue;
        es.addEventListener(eventName, (evt) => {
          try {
            const data = JSON.parse((evt as MessageEvent).data);
            (fn as (d: unknown) => void)(data);
          } catch {
            // ignore bad JSON
          }
        });
      }
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      esRef.current = null;
      setStatus("closed");
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status };
}
