import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../kanban-tab.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("kanban tab source guards", () => {
  it("does not reload repository changes on every board refresh while the panel is open", () => {
    expect(source).toContain("if (!fileChangesOpen) return;\n    onRepoChangesRequest?.();");
    expect(source).toContain("}, [fileChangesOpen, onRepoChangesRequest]);");
    expect(source).not.toContain("}, [fileChangesOpen, onRepoChangesRequest, refreshSignal]);");
  });

  it("uses memoized column counts for move positioning", () => {
    expect(source).toContain("const boardTaskCountByColumn = useMemo(() => {");
    expect(source).toContain("const nextPosition = boardTaskCountByColumn.get(targetColumnId) ?? 0;");
    expect(source).not.toContain("const nextPosition = boardTasks.filter((task) => task.columnId === targetColumnId).length;");
  });

  it("uses localized worktree cleanup and fallback move errors", () => {
    expect(source).toContain("window.confirm(t.kanban.worktreeCleanupPrompt)");
    expect(source).toContain("data.error ?? t.kanban.failedToRemoveWorktree");
    expect(source).toContain("error instanceof Error ? error.message : t.kanban.failedToMoveTask");
    expect(source).not.toContain("\"This issue has an attached worktree. Clean it up now?\"");
    expect(source).not.toContain("\"Failed to remove worktree\"");
    expect(source).not.toContain("\"Failed to move task\"");
  });
});
