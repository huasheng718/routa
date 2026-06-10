"use client";

import { resolveApiPath } from "@/client/config/backend";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import type { KanbanFileChangeItem } from "../kanban-file-changes-types";

interface LoadKanbanFileDiffParams {
  file: KanbanFileChangeItem;
  taskId?: string;
  workspaceId: string;
  codebaseId?: string;
  staged?: boolean;
  fallbackError: string;
}

export async function loadKanbanFileDiff({
  file,
  taskId,
  workspaceId,
  codebaseId,
  staged = false,
  fallbackError,
}: LoadKanbanFileDiffParams): Promise<string | null> {
  const inlineDiff = file.patch ?? file.diff;
  if (typeof inlineDiff === "string") {
    return inlineDiff;
  }

  if (taskId) {
    const controller = new AbortController();
    const params = new URLSearchParams({
      path: file.path,
      status: file.status,
    });
    if (file.previousPath) {
      params.set("previousPath", file.previousPath);
    }
    const response = await desktopAwareFetch(
      resolveApiPath(`/api/tasks/${encodeURIComponent(taskId)}/changes/file?${params.toString()}`),
      { cache: "no-store", signal: controller.signal }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === "string" && data.error.trim() ? data.error : fallbackError);
    }
    return data.diff?.patch || null;
  }

  if (!codebaseId) {
    return null;
  }

  const params = new URLSearchParams({ path: file.path });
  if (staged) {
    params.set("staged", "true");
  }

  const response = await desktopAwareFetch(
    resolveApiPath(`/api/workspaces/${encodeURIComponent(workspaceId)}/codebases/${encodeURIComponent(codebaseId)}/git/diff?${params.toString()}`),
    { cache: "no-store" }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" && data.error.trim() ? data.error : fallbackError);
  }
  return data.diff || null;
}
