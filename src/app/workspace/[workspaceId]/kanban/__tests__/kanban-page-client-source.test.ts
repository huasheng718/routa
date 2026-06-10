import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../kanban-page-client.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("kanban page desktop fetch wiring", () => {
  it("uses resolveApiPath with desktopAwareFetch for page-level data loading and warmup", () => {
    expect(source).toContain("import { resolveApiPath } from \"@/client/config/backend\";");
    expect(source).toContain("desktopAwareFetch(resolveApiPath(`/kanban/boards?workspaceId=${encodeURIComponent(workspaceId)}`)");
    expect(source).toContain("desktopAwareFetch(resolveApiPath(`/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)");
    expect(source).toContain("desktopAwareFetch(resolveApiPath(`/sessions?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`)");
    expect(source).toContain("desktopAwareFetch(\n          resolveApiPath(`/specialists?workspaceId=${encodeURIComponent(workspaceId)}&locale=${encodeURIComponent(specialistLanguage)}`)");
    expect(source).toContain("desktopAwareFetch(resolveApiPath(\"/acp/warmup\"), {");
    expect(source).toContain("resolveApiPath(`/workspaces/${encodeURIComponent(workspaceId)}/codebases/changes`)");

    expect(source).not.toContain("const res = await fetch(`/api/kanban/boards?workspaceId=${encodeURIComponent(workspaceId)}`");
    expect(source).not.toContain("const res = await fetch(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`");
    expect(source).not.toContain("const res = await fetch(`/api/sessions?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`");
    expect(source).not.toContain("const res = await fetch(\n          `/api/specialists?workspaceId=${encodeURIComponent(workspaceId)}&locale=${encodeURIComponent(specialistLanguage)}`");
    expect(source).not.toContain("void fetch(\"/api/acp/warmup\", {");
  });

  it("forwards Kanban task-adaptive harness options into ACP session creation", () => {
    expect(source).toContain("options?.taskAdaptiveHarness,");
  });

  it("does not auto-sync or auto-scan repositories on page mount", () => {
    expect(source).not.toContain("autoSyncedWorkspaceRef");
    expect(source).not.toContain("syncWorkspaceRepos");
    expect(source).not.toContain("syncCodebaseToLatest");
    expect(source).not.toContain("pull: true");
    expect(source).toContain("onRepoChangesRequest={loadRepoChanges}");
  });

  it("routes fitness events to runtime fitness refresh instead of full kanban refresh", () => {
    expect(source).toContain("const [fitnessRefreshKey, setFitnessRefreshKey] = useState(0);");
    expect(source).toContain("onFitnessChanged: handleFitnessChanged,");
    expect(source).toContain("fitnessRefreshSignal={fitnessRefreshKey}");
    expect(source).not.toContain("refreshSignal={refreshKey}\n            boards={boards}");
  });

  it("aborts stale session list refreshes", () => {
    expect(source).toContain("// Fetch sessions\n  useEffect(() => {\n    const controller = new AbortController();");
    expect(source).toContain("resolveApiPath(`/sessions?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`), {\n          cache: \"no-store\",\n          signal: controller.signal,");
    expect(source).toContain("if (controller.signal.aborted) return;\n        setSessions");
    expect(source).toContain("return () => controller.abort();\n  }, [workspaceId, refreshKey]);");
  });
});
