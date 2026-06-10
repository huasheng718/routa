"use client";

import { useEffect, useState } from "react";
import type { TaskRunInfo } from "../types";
import { resolveApiPath } from "@/client/config/backend";
import { desktopAwareFetch } from "@/client/utils/diagnostics";

export type TaskRunsError = {
  code: "TASK_RUNS_LOAD_FAILED";
  status?: number;
  detail?: string;
};

export function useTaskRuns(taskId: string, refreshKey?: string | number) {
  const [runs, setRuns] = useState<TaskRunInfo[] | null>(null);
  const [error, setError] = useState<TaskRunsError | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setError(null);
        const response = await desktopAwareFetch(resolveApiPath(`/tasks/${encodeURIComponent(taskId)}/runs`), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          setError({
            code: "TASK_RUNS_LOAD_FAILED",
            status: response.status,
            detail: typeof payload?.error === "string" ? payload.error : undefined,
          });
          setRuns(null);
          return;
        }

        const payload = await response.json() as { runs?: TaskRunInfo[] };
        setRuns(Array.isArray(payload.runs) ? payload.runs : []);
      } catch (nextError) {
        if (controller.signal.aborted) return;
        setError({
          code: "TASK_RUNS_LOAD_FAILED",
          detail: nextError instanceof Error ? nextError.message : undefined,
        });
        setRuns(null);
      }
    })();

    return () => controller.abort();
  }, [taskId, refreshKey]);

  return { runs, error };
}
