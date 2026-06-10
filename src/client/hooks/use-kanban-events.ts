"use client";

import { useCallback, useEffect, useRef } from "react";
import { getDesktopApiBaseUrl } from "../utils/diagnostics";
import { resolveApiPath } from "../config/backend";

const FITNESS_REFRESH_THROTTLE_MS = 5_000;

interface UseKanbanEventsOptions {
  workspaceId: string;
  onInvalidate: () => void;
  onFitnessChanged?: () => void;
}

export function useKanbanEvents({ workspaceId, onInvalidate, onFitnessChanged }: UseKanbanEventsOptions): void {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitnessRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFitnessRefreshAtRef = useRef(0);
  const tearingDownRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const onInvalidateRef = useRef(onInvalidate);
  const onFitnessChangedRef = useRef(onFitnessChanged);
  const connectSseRef = useRef<() => void>(() => {});

  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    onFitnessChangedRef.current = onFitnessChanged;
  }, [onFitnessChanged]);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const base = getDesktopApiBaseUrl();
    const es = new EventSource(
      resolveApiPath(`api/kanban/events?workspaceId=${encodeURIComponent(workspaceId)}`, base),
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === "connected") {
          if (hasConnectedOnceRef.current) {
            onInvalidateRef.current();
          } else {
            hasConnectedOnceRef.current = true;
          }
          return;
        }
        if (data.type === "kanban:changed") {
          onInvalidateRef.current();
          return;
        }
        if (data.type === "fitness:changed") {
          const notifyFitnessChanged = onFitnessChangedRef.current;
          if (!notifyFitnessChanged) {
            return;
          }
          const now = Date.now();
          const elapsed = now - lastFitnessRefreshAtRef.current;
          if (elapsed >= FITNESS_REFRESH_THROTTLE_MS) {
            lastFitnessRefreshAtRef.current = now;
            notifyFitnessChanged();
            return;
          }
          if (fitnessRefreshTimerRef.current) {
            return;
          }
          fitnessRefreshTimerRef.current = setTimeout(() => {
            fitnessRefreshTimerRef.current = null;
            lastFitnessRefreshAtRef.current = Date.now();
            onFitnessChangedRef.current?.();
          }, FITNESS_REFRESH_THROTTLE_MS - elapsed);
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    es.onerror = () => {
      if (tearingDownRef.current || document.visibilityState === "hidden") {
        es.close();
        eventSourceRef.current = null;
        return;
      }
      es.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => connectSseRef.current(), 3000);
    };
  }, [workspaceId]);

  useEffect(() => {
    connectSseRef.current = connectSSE;
  }, [connectSSE]);

  useEffect(() => {
    if (workspaceId === "__placeholder__") return;

    tearingDownRef.current = false;
    hasConnectedOnceRef.current = false;
    lastFitnessRefreshAtRef.current = 0;
    connectSSE();

    return () => {
      tearingDownRef.current = true;
      hasConnectedOnceRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fitnessRefreshTimerRef.current) {
        clearTimeout(fitnessRefreshTimerRef.current);
        fitnessRefreshTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectSSE, workspaceId]);
}
