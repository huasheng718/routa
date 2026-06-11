import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/context";
import { KanbanSourceRequirements } from "../kanban-source-requirements";
import type { TaskInfo } from "../../types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: "task-source",
    title: "Spec task",
    objective: "Spec task objective",
    status: "PENDING",
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("KanbanSourceRequirements", () => {
  it("renders source requirements from task context search spec", () => {
    render(
      <I18nProvider>
        <KanbanSourceRequirements
          task={createTask({
            contextSearchSpec: {
              relatedFiles: [
                "docs/issues/2026-04-11-spec-board.md",
                "src/app/page.tsx",
                "docs/issues/2026-04-12-linked-issue.md",
              ],
            },
          })}
          compact={false}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("来源需求")).toBeTruthy();
    expect(screen.getByText("2026-04-11-spec-board.md")).toBeTruthy();
    expect(screen.getByText("2026-04-12-linked-issue.md")).toBeTruthy();
    expect(screen.queryByText("src/app/page.tsx")).toBeNull();
  });
});
