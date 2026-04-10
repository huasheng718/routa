"use client";

import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { RepoSelection } from "@/client/components/repo-picker";
import { desktopAwareFetch } from "@/client/utils/diagnostics";

export async function ensureWorkspaceCodebase(
  workspaceId: string | null | undefined,
  selection: RepoSelection | null,
  codebases: CodebaseData[],
  refreshCodebases?: () => Promise<void>,
): Promise<void> {
  if (!workspaceId || !selection?.path) {
    return;
  }

  const alreadyLinked = codebases.some((codebase) => codebase.repoPath === selection.path);
  if (alreadyLinked) {
    return;
  }

  const response = await desktopAwareFetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/codebases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repoPath: selection.path,
      branch: selection.branch || undefined,
      label: selection.name || undefined,
    }),
  });

  if (response.ok || response.status === 409) {
    await refreshCodebases?.();
    return;
  }

  const data = await response.json().catch(() => ({}));
  throw new Error(
    typeof data?.error === "string" ? data.error : "Failed to persist workspace codebase",
  );
}
