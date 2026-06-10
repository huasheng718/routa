import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanTab } from "../kanban-tab";
import type { KanbanBoardInfo, TaskInfo } from "../../types";
import { resetDesktopAwareFetchToGlobalFetch } from "./test-utils";

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

vi.mock("@/client/utils/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/client/utils/diagnostics")>("@/client/utils/diagnostics");
  return {
    ...actual,
    desktopAwareFetch,
  };
});

vi.mock("@/client/components/repo-picker", () => ({
  RepoPicker: () => <div data-testid="repo-picker-mock" />,
}));

vi.mock("../use-runtime-fitness-status", async () => {
  const { mockUseRuntimeFitnessStatus } = await import("./test-utils");
  return {
    useRuntimeFitnessStatus: mockUseRuntimeFitnessStatus,
  };
});

const board: KanbanBoardInfo = {
  id: "board-1",
  workspaceId: "workspace-1",
  name: "Default Board",
  isDefault: true,
  sessionConcurrencyLimit: 1,
  queue: {
    runningCount: 0,
    runningCards: [],
    queuedCount: 0,
    queuedCardIds: [],
    queuedCards: [],
    queuedPositions: {},
  },
  columns: [
    { id: "backlog", name: "Backlog", position: 0, stage: "backlog" },
  ],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createTask(id: string, title: string, overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id,
    title,
    objective: `${title} objective`,
    status: "PENDING",
    boardId: board.id,
    columnId: "backlog",
    position: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  resetDesktopAwareFetchToGlobalFetch(desktopAwareFetch);
  window.history.replaceState({}, "", "/workspace/workspace-1/kanban");
});

describe("KanbanTab URL state", () => {
  it("syncs card detail open and close with the taskId query param", async () => {
    render(
      <KanbanTab
        workspaceId="workspace-1"
        boards={[board]}
        tasks={[createTask("task-1", "Story One")]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[]}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开 Story One" }));
    await screen.findByRole("tablist", { name: "卡片详情" });

    expect(window.location.search).toContain("taskId=task-1");

    fireEvent.click(screen.getByRole("button", { name: "关闭卡片详情" }));

    await waitFor(() => {
      expect(screen.queryByRole("tablist", { name: "卡片详情" })).toBeNull();
    });
    expect(window.location.search).not.toContain("taskId=");
  });

  it("reopens the correct card detail when history navigation restores the taskId query param", async () => {
    render(
      <KanbanTab
        workspaceId="workspace-1"
        boards={[board]}
        tasks={[createTask("task-1", "Story One"), createTask("task-2", "Story Two")]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[]}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开 Story Two" }));
    await screen.findByDisplayValue("Story Two");

    fireEvent.click(screen.getByRole("button", { name: "关闭卡片详情" }));
    await waitFor(() => {
      expect(screen.queryByRole("tablist", { name: "卡片详情" })).toBeNull();
    });

    window.history.pushState({}, "", "/workspace/workspace-1/kanban?taskId=task-1");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await screen.findByRole("tablist", { name: "卡片详情" });
    expect(screen.getByDisplayValue("Story One")).toBeTruthy();
  });

  it("syncs board selection with boardId and restores a deep-linked board/task combination", async () => {
    const secondBoard: KanbanBoardInfo = {
      ...board,
      id: "board-2",
      name: "Review Board",
      isDefault: false,
    };

    window.history.replaceState({}, "", "/workspace/workspace-1/kanban?boardId=board-2&taskId=task-2");

    render(
      <KanbanTab
        workspaceId="workspace-1"
        boards={[board, secondBoard]}
        tasks={[
          createTask("task-1", "Story One", { boardId: board.id }),
          createTask("task-2", "Story Two", { boardId: secondBoard.id }),
        ]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[]}
        onRefresh={vi.fn()}
      />,
    );

    await screen.findByDisplayValue("Story Two");
    const boardSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(boardSelect.value).toBe("board-2");

    fireEvent.change(boardSelect, { target: { value: "board-1" } });

    await waitFor(() => {
      expect(screen.queryByRole("tablist", { name: "卡片详情" })).toBeNull();
    });
    expect(window.location.search).toContain("boardId=board-1");
    expect(window.location.search).not.toContain("taskId=");
  });

  it("clears stale detail state when switching workspaces in place", async () => {
    const workspaceTwoBoard: KanbanBoardInfo = {
      ...board,
      id: "board-2",
      workspaceId: "workspace-2",
      name: "Workspace Two Board",
    };

    const { rerender } = render(
      <KanbanTab
        workspaceId="workspace-1"
        boards={[board]}
        tasks={[createTask("task-1", "Story One")]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[]}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开 Story One" }));
    await screen.findByDisplayValue("Story One");
    expect(window.location.search).toContain("taskId=task-1");

    window.history.replaceState({}, "", "/workspace/workspace-2/kanban?taskId=task-1");
    rerender(
      <KanbanTab
        workspaceId="workspace-2"
        boards={[workspaceTwoBoard]}
        tasks={[createTask("task-2", "Story Two", { boardId: workspaceTwoBoard.id })]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[]}
        onRefresh={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Story One")).toBeNull();
    });

    expect(screen.getByText("Story Two")).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "卡片详情" })).toBeNull();
    expect(window.location.search).not.toContain("taskId=");
  });
});
