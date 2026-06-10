import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanEnhancedFileChangesPanel } from "../kanban-enhanced-file-changes-panel";

// Mock the hooks
vi.mock("../../hooks/use-git-operations", () => ({
  useGitOperations: () => ({
    stageFiles: vi.fn(),
    unstageFiles: vi.fn(),
    createCommit: vi.fn(),
    discardChanges: vi.fn(),
    getCommits: vi.fn().mockResolvedValue([]),
    getFileDiff: vi.fn(),
    getCommitDiff: vi.fn(),
    exportChanges: vi.fn(),
    pullCommits: vi.fn(),
    rebaseBranch: vi.fn(),
    resetBranch: vi.fn(),
    loading: false,
  }),
}));

vi.mock("../../hooks/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("../kanban-file-diff-loader", () => ({
  loadKanbanFileDiff: vi.fn().mockResolvedValue("mock diff"),
}));

describe("KanbanEnhancedFileChangesPanel", () => {
  it("should render in embedded mode without errors", () => {
    const { container } = render(
      <KanbanEnhancedFileChangesPanel
        workspaceId="test-workspace"
        embedded={true}
        loading={false}
      />
    );

    // Should render without crashing
    expect(container).toBeDefined();
  });

  it("should render workflow actions in sidebar mode", () => {
    const mockRepo = {
      codebaseId: "test-codebase",
      repoPath: "/test/repo",
      label: "Test Repo",
      branch: "main",
      status: { clean: false, ahead: 0, behind: 0, modified: 1, untracked: 0 },
      files: [],
      unstagedFiles: [],
      stagedFiles: [],
      commits: [],
      targetBranch: "main",
    };

    render(
      <KanbanEnhancedFileChangesPanel
        workspaceId="test-workspace"
        repos={[mockRepo]}
        embedded={false}
        open={true}
        onClose={vi.fn()}
        loading={false}
      />
    );

    expect(screen.queryByText("重置并继续工作")).not.toBeNull();
    const archiveButton = screen.getByRole("button", { name: /归档并开启新空间/i });
    expect((archiveButton as HTMLButtonElement).disabled).toBe(true);
    expect(archiveButton.getAttribute("title")).toBe("归档流程暂未开放");
  });
});
