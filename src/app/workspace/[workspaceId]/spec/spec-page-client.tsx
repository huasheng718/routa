"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PieChart } from "lucide-react";
import { resolveApiPath } from "@/client/config/backend";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { WorkspaceSwitcher } from "@/client/components/workspace-switcher";
import { useWorkspaces } from "@/client/hooks/use-workspaces";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { useTranslation } from "@/i18n";
import type { FeatureSurfaceIndexResponse, SpecIssue } from "./spec-board-model";
import { CreateIssueDialog } from "./spec-create-issue-dialog";
import { SpecDetailPane } from "./spec-detail-pane";
import { SpecFamilyExplorer } from "./spec-family-explorer";
import {
  buildIssueGitHubTaskFields,
  buildIssuesTaskLabels,
  buildIssuesTaskObjective,
  buildIssuesTaskScope,
  buildIssuesTaskTitle,
  buildIssuesWorkspaceTitle,
  compactText,
  EMPTY_CREATE_ISSUE_FORM,
  emptySurfaceIndexResponse,
  extractErrorMessage,
  MERGED_ISSUES_ACTION_KEY,
  normalizeSurfaceIndexPayload,
  priorityFromIssues,
  readJson,
  validateSpecIssueAttachments,
  type CodebasePayload,
  type CreateIssueForm,
  type TaskPayload,
  type WorkspacePayload,
} from "./spec-page-helpers";
import { SpecStatusBoard } from "./spec-status-board";
import { SpecToolbar } from "./spec-toolbar";
import { useSpecBoardViewModel } from "./use-spec-board-view-model";

export function SpecBoardPanel({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const [allIssues, setAllIssues] = useState<SpecIssue[]>([]);
  const [surfaceIndex, setSurfaceIndex] = useState<FeatureSurfaceIndexResponse>(emptySurfaceIndexResponse());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bodyLoadingFilename, setBodyLoadingFilename] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [creatingKanbanTaskFilename, setCreatingKanbanTaskFilename] = useState<string | null>(null);
  const [createKanbanTaskError, setCreateKanbanTaskError] = useState<string | null>(null);
  const [openingWorkspaceFilename, setOpeningWorkspaceFilename] = useState<string | null>(null);
  const [openWorkspaceError, setOpenWorkspaceError] = useState<string | null>(null);
  const [createIssueDialogOpen, setCreateIssueDialogOpen] = useState(false);
  const [createIssueForm, setCreateIssueForm] = useState<CreateIssueForm>(EMPTY_CREATE_ISSUE_FORM);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [createIssueError, setCreateIssueError] = useState<string | null>(null);

  const {
    boardModel,
    filters,
    setFilters,
    resetFilters,
    filteredIssues,
    selectedIssue,
    setSelectedIssue,
    selectedIssueFilenames,
    selectedIssues,
    visibleFamilies,
    selectedIssueRelations,
    handleSelectLinkedIssue,
    handleSelectIssue,
    handleToggleIssueSelection,
    handleClearSelectedIssues,
  } = useSpecBoardViewModel({
    allIssues,
    surfaceIndex,
    detailPaneRef,
  });

  const mergeLoadedIssue = useCallback((loadedIssue: SpecIssue) => {
    setAllIssues((current) => current.map((issue) => (
      issue.filename === loadedIssue.filename ? { ...issue, ...loadedIssue } : issue
    )));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const issuesPath = resolveApiPath(`/spec/issues?workspaceId=${encodeURIComponent(workspaceId)}&includeBody=false`);
        const surfacePath = resolveApiPath(`/spec/surface-index?workspaceId=${encodeURIComponent(workspaceId)}`);

        const [issuesResponse, surfaceResponse] = await Promise.all([
          desktopAwareFetch(issuesPath, {
            cache: "no-store",
            signal: controller.signal,
          }),
          desktopAwareFetch(surfacePath, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const issuesPayload = await issuesResponse.json().catch(() => null);
        const surfacePayload = await surfaceResponse.json().catch(() => null);

        if (!issuesResponse.ok) {
          throw new Error(extractErrorMessage(issuesPayload, t.specBoard.failedToLoad));
        }

        if (controller.signal.aborted) {
          return;
        }

        const issues = Array.isArray(issuesPayload?.issues) ? issuesPayload.issues as SpecIssue[] : [];
        const surfaces = surfaceResponse.ok
          ? normalizeSurfaceIndexPayload(surfacePayload, t)
          : emptySurfaceIndexResponse([extractErrorMessage(surfacePayload, t.specBoard.surfaceMapUnavailable)]);

        setAllIssues(issues);
        setSurfaceIndex(surfaces);
      } catch (issueError) {
        if (controller.signal.aborted || (issueError instanceof Error && issueError.name === "AbortError")) {
          return;
        }

        setError(issueError instanceof Error ? issueError.message : String(issueError));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [t, t.specBoard.failedToLoad, t.specBoard.surfaceMapUnavailable, workspaceId]);

  useEffect(() => {
    if (!selectedIssue || selectedIssue.bodyLoaded || selectedIssue.body) {
      setBodyLoadingFilename(null);
      setBodyError(null);
      return;
    }

    const controller = new AbortController();
    setBodyLoadingFilename(selectedIssue.filename);
    setBodyError(null);

    void (async () => {
      try {
        const issuePath = resolveApiPath(
          `/spec/issues?workspaceId=${encodeURIComponent(workspaceId)}&filename=${encodeURIComponent(selectedIssue.filename)}`,
        );
        const response = await desktopAwareFetch(issuePath, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, t.specBoard.failedToLoad));
        }

        const nextIssue = payload?.issue as SpecIssue | undefined;
        if (!nextIssue || nextIssue.filename !== selectedIssue.filename) {
          throw new Error(t.specBoard.failedToLoad);
        }
        if (controller.signal.aborted) {
          return;
        }

        mergeLoadedIssue(nextIssue);
      } catch (issueError) {
        if (controller.signal.aborted || (issueError instanceof Error && issueError.name === "AbortError")) {
          return;
        }
        setBodyError(issueError instanceof Error ? issueError.message : String(issueError));
      } finally {
        if (!controller.signal.aborted) {
          setBodyLoadingFilename(null);
        }
      }
    })();

    return () => controller.abort();
  }, [mergeLoadedIssue, selectedIssue, t.specBoard.failedToLoad, workspaceId]);

  useEffect(() => {
    setOpenWorkspaceError(null);
    setCreateKanbanTaskError(null);
  }, [selectedIssue?.filename]);

  const loadFullIssue = useCallback(async (issue: SpecIssue, fallback: string): Promise<SpecIssue> => {
    if (issue.bodyLoaded || issue.body) {
      return issue;
    }

    const issuePath = resolveApiPath(
      `/spec/issues?workspaceId=${encodeURIComponent(workspaceId)}&filename=${encodeURIComponent(issue.filename)}`,
    );
    const issueResponse = await desktopAwareFetch(issuePath, { cache: "no-store" });
    const issuePayload = await readJson(issueResponse);
    if (!issueResponse.ok) {
      throw new Error(extractErrorMessage(issuePayload, fallback));
    }

    const loadedIssue = (issuePayload as { issue?: SpecIssue })?.issue;
    if (loadedIssue?.filename !== issue.filename) {
      return issue;
    }

    const mergedIssue = { ...issue, ...loadedIssue };
    mergeLoadedIssue(loadedIssue);
    return mergedIssue;
  }, [mergeLoadedIssue, workspaceId]);

  const loadFullIssues = useCallback(async (issues: SpecIssue[], fallback: string): Promise<SpecIssue[]> => {
    const loadedIssues: SpecIssue[] = [];
    for (const issue of issues) {
      loadedIssues.push(await loadFullIssue(issue, fallback));
    }
    return loadedIssues;
  }, [loadFullIssue]);

  const handleOpenCreateIssueDialog = useCallback(() => {
    setCreateIssueForm(EMPTY_CREATE_ISSUE_FORM);
    setCreateIssueError(null);
    setCreateIssueDialogOpen(true);
  }, []);

  const handleCloseCreateIssueDialog = useCallback(() => {
    if (creatingIssue) {
      return;
    }

    setCreateIssueDialogOpen(false);
    setCreateIssueError(null);
  }, [creatingIssue]);

  const handleCreateIssue = useCallback(async () => {
    const title = compactText(createIssueForm.title);
    if (!title) {
      setCreateIssueError(t.specBoard.createIssueTitleRequired);
      return;
    }
    const attachmentError = validateSpecIssueAttachments(createIssueForm.attachments, t);
    if (attachmentError) {
      setCreateIssueError(attachmentError);
      return;
    }

    setCreatingIssue(true);
    setCreateIssueError(null);

    try {
      const formData = new FormData();
      formData.append("workspaceId", workspaceId);
      formData.append("title", title);
      formData.append("severity", createIssueForm.severity);
      formData.append("tags", createIssueForm.tags);
      formData.append("body", createIssueForm.body.trim());
      formData.append("kind", "issue");
      formData.append("status", "open");
      formData.append("reportedBy", "human");
      const area = compactText(createIssueForm.area);
      if (area) {
        formData.append("area", area);
      }
      for (const file of createIssueForm.attachments) {
        formData.append("attachments", file, file.name);
        formData.append("attachmentNames", file.name);
      }

      const response = await desktopAwareFetch(resolveApiPath("/spec/issues"), {
        method: "POST",
        body: formData,
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, t.specBoard.createIssueFailed));
      }

      const createdIssue = (payload as { issue?: SpecIssue })?.issue;
      if (!createdIssue?.filename) {
        throw new Error(t.specBoard.createIssueFailed);
      }

      setAllIssues((current) => [
        createdIssue,
        ...current.filter((issue) => issue.filename !== createdIssue.filename),
      ]);
      resetFilters();
      setSelectedIssue(createdIssue);
      setCreateIssueDialogOpen(false);
      setCreateIssueForm(EMPTY_CREATE_ISSUE_FORM);
    } catch (createError) {
      setCreateIssueError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setCreatingIssue(false);
    }
  }, [
    createIssueForm,
    resetFilters,
    setSelectedIssue,
    t,
    workspaceId,
  ]);

  const handleCreateKanbanTaskFromIssues = useCallback(async (issues: SpecIssue[]) => {
    if (creatingKanbanTaskFilename || issues.length === 0) {
      return;
    }

    const actionKey = issues.length > 1 ? MERGED_ISSUES_ACTION_KEY : (issues[0] as SpecIssue).filename;
    setCreatingKanbanTaskFilename(actionKey);
    setCreateKanbanTaskError(null);

    try {
      const issuesForTask = await loadFullIssues(issues, t.specBoard.createKanbanTaskFailed);
      const taskResponse = await desktopAwareFetch(resolveApiPath("/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: buildIssuesTaskTitle(issuesForTask, t),
          objective: buildIssuesTaskObjective(issuesForTask, t, issuesForTask.length > 1
            ? t.specBoard.mergeCreateKanbanTaskIntro
            : t.specBoard.createKanbanTaskIntro),
          scope: buildIssuesTaskScope(issuesForTask),
          acceptanceCriteria: [
            t.specBoard.createKanbanTaskAcceptanceIssueLinked,
            t.specBoard.createKanbanTaskAcceptanceReady,
          ],
          priority: priorityFromIssues(issuesForTask),
          labels: buildIssuesTaskLabels(issuesForTask),
          ...buildIssueGitHubTaskFields(issuesForTask),
          creationSource: "manual",
        }),
      });
      const taskPayload = await readJson(taskResponse);
      if (!taskResponse.ok) {
        throw new Error(extractErrorMessage(taskPayload, t.specBoard.createKanbanTaskFailed));
      }

      const createdTask = (taskPayload as { task?: TaskPayload })?.task;
      if (!createdTask?.id) {
        throw new Error(t.specBoard.createKanbanTaskFailed);
      }

      router.push(`/workspace/${encodeURIComponent(workspaceId)}/kanban?taskId=${encodeURIComponent(createdTask.id)}`);
    } catch (createTaskError) {
      const message = createTaskError instanceof Error ? createTaskError.message : String(createTaskError);
      setCreateKanbanTaskError(`${t.specBoard.createKanbanTaskFailed}: ${message}`);
    } finally {
      setCreatingKanbanTaskFilename(null);
    }
  }, [creatingKanbanTaskFilename, loadFullIssues, router, t, workspaceId]);

  const handleCreateKanbanTaskFromIssue = useCallback((issue: SpecIssue) => {
    void handleCreateKanbanTaskFromIssues([issue]);
  }, [handleCreateKanbanTaskFromIssues]);

  const handleCreateKanbanTaskFromSelectedIssues = useCallback(() => {
    void handleCreateKanbanTaskFromIssues(selectedIssues);
  }, [handleCreateKanbanTaskFromIssues, selectedIssues]);

  const handleOpenWorkspaceFromIssues = useCallback(async (issues: SpecIssue[]) => {
    if (openingWorkspaceFilename || issues.length === 0) {
      return;
    }

    const actionKey = issues.length > 1 ? MERGED_ISSUES_ACTION_KEY : (issues[0] as SpecIssue).filename;
    setOpeningWorkspaceFilename(actionKey);
    setOpenWorkspaceError(null);

    let createdWorkspaceId: string | null = null;
    try {
      const issuesForTask = await loadFullIssues(issues, t.specBoard.openWorkspaceFailed);

      const codebasesPath = resolveApiPath(`/workspaces/${encodeURIComponent(workspaceId)}/codebases`);
      const sourceCodebasesResponse = await desktopAwareFetch(codebasesPath, { cache: "no-store" });
      const sourceCodebasesPayload = await readJson(sourceCodebasesResponse);
      if (!sourceCodebasesResponse.ok) {
        throw new Error(extractErrorMessage(sourceCodebasesPayload, t.specBoard.openWorkspaceFailed));
      }
      const sourceCodebases = Array.isArray((sourceCodebasesPayload as { codebases?: unknown })?.codebases)
        ? (sourceCodebasesPayload as { codebases: CodebasePayload[] }).codebases
        : [];

      const workspaceResponse = await desktopAwareFetch(resolveApiPath("/workspaces"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: buildIssuesWorkspaceTitle(issuesForTask, t) }),
      });
      const workspacePayload = await readJson(workspaceResponse);
      if (!workspaceResponse.ok) {
        throw new Error(extractErrorMessage(workspacePayload, t.specBoard.openWorkspaceFailed));
      }

      const workspace = (workspacePayload as { workspace?: WorkspacePayload })?.workspace;
      if (!workspace?.id) {
        throw new Error(t.specBoard.openWorkspaceFailed);
      }
      createdWorkspaceId = workspace.id;

      const copiedCodebaseIds: string[] = [];
      for (const codebase of sourceCodebases) {
        if (!codebase?.repoPath) {
          continue;
        }

        const copyResponse = await desktopAwareFetch(resolveApiPath(`/workspaces/${encodeURIComponent(workspace.id)}/codebases`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoPath: codebase.repoPath,
            branch: codebase.branch,
            label: codebase.label,
          }),
        });
        const copyPayload = await readJson(copyResponse);
        if (!copyResponse.ok) {
          throw new Error(extractErrorMessage(copyPayload, t.specBoard.openWorkspaceFailed));
        }

        const copiedCodebase = (copyPayload as { codebase?: CodebasePayload })?.codebase;
        if (copiedCodebase?.id) {
          copiedCodebaseIds.push(copiedCodebase.id);
        }
      }

      const taskResponse = await desktopAwareFetch(resolveApiPath("/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          title: buildIssuesTaskTitle(issuesForTask, t),
          objective: buildIssuesTaskObjective(issuesForTask, t, issuesForTask.length > 1
            ? t.specBoard.mergeOpenWorkspaceTaskIntro
            : t.specBoard.openWorkspaceTaskIntro),
          scope: buildIssuesTaskScope(issuesForTask),
          acceptanceCriteria: [
            t.specBoard.openWorkspaceAcceptanceIssueLinked,
            t.specBoard.openWorkspaceAcceptanceCodebaseReady,
          ],
          priority: priorityFromIssues(issuesForTask),
          labels: buildIssuesTaskLabels(issuesForTask),
          ...(copiedCodebaseIds.length > 0 ? { codebaseIds: copiedCodebaseIds } : {}),
          ...buildIssueGitHubTaskFields(issuesForTask),
          creationSource: "manual",
        }),
      });
      const taskPayload = await readJson(taskResponse);
      if (!taskResponse.ok) {
        throw new Error(extractErrorMessage(taskPayload, t.specBoard.openWorkspaceFailed));
      }

      const workspaceTask = (taskPayload as { task?: TaskPayload })?.task;
      if (!workspaceTask?.id) {
        throw new Error(t.specBoard.openWorkspaceFailed);
      }

      router.push(`/workspace/${encodeURIComponent(workspace.id)}/kanban?taskId=${encodeURIComponent(workspaceTask.id)}`);
    } catch (openError) {
      if (createdWorkspaceId) {
        await desktopAwareFetch(resolveApiPath(`/workspaces/${encodeURIComponent(createdWorkspaceId)}`), {
          method: "DELETE",
        }).catch(() => null);
      }
      const message = openError instanceof Error ? openError.message : String(openError);
      setOpenWorkspaceError(`${t.specBoard.openWorkspaceFailed}: ${message}`);
    } finally {
      setOpeningWorkspaceFilename(null);
    }
  }, [loadFullIssues, openingWorkspaceFilename, router, t, workspaceId]);

  const handleOpenWorkspaceFromIssue = useCallback((issue: SpecIssue) => {
    void handleOpenWorkspaceFromIssues([issue]);
  }, [handleOpenWorkspaceFromIssues]);

  const handleOpenWorkspaceFromSelectedIssues = useCallback(() => {
    void handleOpenWorkspaceFromIssues(selectedIssues);
  }, [handleOpenWorkspaceFromIssues, selectedIssues]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <SpecToolbar
        filters={filters}
        filteredCount={filteredIssues.length}
        totalCount={allIssues.length}
        issues={allIssues}
        surfaceWarnings={surfaceIndex.warnings}
        onFiltersChange={setFilters}
        onCreateIssue={handleOpenCreateIssueDialog}
      />

      {loading ? (
        <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-2xl border border-black/6 bg-white/75 text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
          <span className="animate-pulse">{t.common.loading}</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex min-h-[20rem] flex-1 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/90 px-6 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
          <SpecStatusBoard
            issues={filteredIssues}
            selectedIssue={selectedIssue}
            selectedIssueFilenames={selectedIssueFilenames}
            onSelectIssue={handleSelectIssue}
            onToggleIssueSelection={handleToggleIssueSelection}
          />

          <section className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <SpecFamilyExplorer
              families={visibleFamilies}
              relationsByFilename={boardModel.relationsByFilename}
              selectedIssue={selectedIssue}
              selectedIssueFilenames={selectedIssueFilenames}
              onSelectIssue={handleSelectIssue}
              onToggleIssueSelection={handleToggleIssueSelection}
            />

            <div ref={detailPaneRef} className="min-w-0 scroll-mt-3">
              <SpecDetailPane
                workspaceId={workspaceId}
                issue={selectedIssue}
                selectedIssues={selectedIssues}
                relations={selectedIssueRelations}
                surfaceHits={selectedIssue ? boardModel.surfaceHitsByFilename.get(selectedIssue.filename) ?? [] : []}
                surfaceWarnings={surfaceIndex.warnings}
                onSelectLinkedIssue={handleSelectLinkedIssue}
                onCreateKanbanTaskFromIssue={handleCreateKanbanTaskFromIssue}
                onOpenWorkspaceFromIssue={handleOpenWorkspaceFromIssue}
                onCreateKanbanTaskFromSelectedIssues={handleCreateKanbanTaskFromSelectedIssues}
                onOpenWorkspaceFromSelectedIssues={handleOpenWorkspaceFromSelectedIssues}
                onClearSelectedIssues={handleClearSelectedIssues}
                onCreateIssue={handleOpenCreateIssueDialog}
                creatingKanbanTask={creatingKanbanTaskFilename != null}
                openingWorkspace={openingWorkspaceFilename != null}
                createKanbanTaskError={createKanbanTaskError}
                openWorkspaceError={openWorkspaceError}
                bodyLoading={bodyLoadingFilename === selectedIssue?.filename}
                bodyError={bodyError}
              />
            </div>
          </section>
        </div>
      ) : null}

      {createIssueDialogOpen ? (
        <CreateIssueDialog
          form={createIssueForm}
          creating={creatingIssue}
          error={createIssueError}
          onFormChange={setCreateIssueForm}
          onError={setCreateIssueError}
          onCancel={handleCloseCreateIssueDialog}
          onSubmit={handleCreateIssue}
        />
      ) : null}
    </div>
  );
}

export function SpecPageClient() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const rawWorkspaceId = params.workspaceId as string;
  const workspaceId =
    rawWorkspaceId === "__placeholder__" && typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? rawWorkspaceId)
      : rawWorkspaceId;

  const workspacesHook = useWorkspaces();
  const workspace = workspacesHook.workspaces.find((item) => item.id === workspaceId);

  const handleWorkspaceSelect = useCallback((nextWorkspaceId: string) => {
    router.push(`/workspace/${nextWorkspaceId}/spec`);
  }, [router]);

  const handleWorkspaceCreate = useCallback(async (title: string) => {
    const workspaceResult = await workspacesHook.createWorkspace(title);
    if (workspaceResult) {
      router.push(`/workspace/${workspaceResult.id}/spec`);
    }
  }, [router, workspacesHook]);

  if (workspacesHook.loading && workspaceId !== "default") {
    return (
      <div className="desktop-theme flex h-screen items-center justify-center bg-desktop-bg-primary">
        <div className="flex items-center gap-3 text-desktop-text-secondary">
          <PieChart className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" />
          {t.workspace.loadingWorkspace}
        </div>
      </div>
    );
  }

  return (
    <DesktopAppShell
      workspaceId={workspaceId}
      workspaceTitle={workspace?.title ?? (workspaceId === "default" ? t.workspace.defaultWorkspace : workspaceId)}
      workspaceSwitcher={(
        <WorkspaceSwitcher
          workspaces={workspacesHook.workspaces}
          activeWorkspaceId={workspaceId}
          activeWorkspaceTitle={workspace?.title ?? (workspaceId === "default" ? t.workspace.defaultWorkspace : workspaceId)}
          onSelect={handleWorkspaceSelect}
          onCreate={handleWorkspaceCreate}
          loading={workspacesHook.loading}
          compact
          desktop
        />
      )}
    >
      <div className="flex h-full min-h-0 bg-[#f3f5f8] text-slate-900 dark:bg-[#0a0f16] dark:text-slate-50">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            <SpecBoardPanel workspaceId={workspaceId} />
          </div>
        </main>
      </div>
    </DesktopAppShell>
  );
}
