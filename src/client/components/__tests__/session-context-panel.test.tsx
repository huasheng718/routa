import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

vi.mock("@/client/utils/diagnostics", () => ({
  desktopAwareFetch,
  shouldSuppressTeardownError: () => false,
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: {
      common: {
        loading: "Loading",
        delete: "Delete",
      },
      sessions: {
        rename: "Rename",
        focus: "Focus",
        child: "Child",
        hierarchy: "Hierarchy",
        kanbanStory: "Kanban Story",
        previousLane: "Previous Lane",
        previousRunInLane: "Previous Run In Lane",
        currentLaneSession: "Current lane session",
        open: "Open",
        openSession: "Open Session",
        unknownLane: "Unknown lane",
        nextLane: "Next lane",
        handoffIncoming: "Incoming",
        handoffOutgoing: "Outgoing",
        stepLabel: "Step {n}",
        recentSessions: "Recent Sessions",
        showAll: "Show All",
        justNow: "just now",
        minutesAgo: "m ago",
        hoursAgo: "h ago",
        daysAgo: "d ago",
        taskIdLabel: "Task {id}",
        siblingSessionsCount: "{count} sibling sessions",
        childSessionsCount: "{count} child sessions",
      },
      kanban: {
        handoffRequestEnvironmentPreparation: "Environment preparation",
        handoffRequestRuntimeContext: "Runtime context",
        handoffRequestClarification: "Clarification",
        handoffRequestRerunCommand: "Rerun command",
        handoffRequestUnknown: "Handoff request",
        handoffStatusRequested: "Requested",
        handoffStatusDelivered: "Delivered",
        handoffStatusCompleted: "Completed",
        handoffStatusBlocked: "Blocked",
        handoffStatusFailed: "Failed",
        handoffStatusUnknown: "Unknown",
        taskRunStatusRunning: "Running",
        taskRunStatusCompleted: "Completed",
        taskRunStatusFailed: "Failed",
        taskRunStatusTimedOut: "Timed out",
        taskRunStatusTransitioned: "Transitioned",
        taskRunStatusUnknown: "Unknown",
      },
    },
  }),
}));

import { SessionContextPanel } from "../session-context-panel";

describe("SessionContextPanel", () => {
  beforeEach(() => {
    desktopAwareFetch.mockReset();
    desktopAwareFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          sessionId: "session-current",
          name: "Current Session",
          cwd: "/tmp/project",
          workspaceId: "default",
          provider: "codex",
          role: "ROUTA",
          createdAt: "2026-04-09T10:00:00.000Z",
        },
        children: [],
        siblings: [],
        recentInWorkspace: [
          {
            sessionId: "session-ordinary",
            name: "Fix login regression",
            cwd: "/tmp/project",
            workspaceId: "default",
            provider: "codex",
            role: "ROUTA",
            createdAt: "2026-04-09T09:00:00.000Z",
          },
          {
            sessionId: "session-team",
            name: "Team run incident triage",
            cwd: "/tmp/project",
            workspaceId: "default",
            provider: "codex",
            role: "ROUTA",
            createdAt: "2026-04-09T08:00:00.000Z",
          },
        ],
        kanbanContext: {
          taskId: "task-1",
          taskTitle: "Review login flow",
          columnId: "review",
          currentLaneSession: null,
          previousLaneSession: null,
          previousLaneRun: null,
          relatedHandoffs: [],
        },
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders recent session switching as an inline expandable list and keeps Show All in the kanban story context", async () => {
    const onSelectSession = vi.fn();

    render(
      <SessionContextPanel
        sessionId="session-current"
        workspaceId="default"
        onSelectSession={onSelectSession}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Recent Sessions/i })).toBeTruthy();
    });

    expect(screen.getByRole("link", { name: "Show All" }).getAttribute("href")).toBe("/workspace/default/sessions");
    expect(screen.queryByText("Fix login regression")).toBeNull();
    expect(screen.queryByText("Team run incident triage")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Recent Sessions/i }));
    expect(screen.getByText("Fix login regression")).toBeTruthy();
    fireEvent.click(screen.getByText("Fix login regression"));
    expect(onSelectSession).toHaveBeenCalledWith("session-ordinary");
  });
});
