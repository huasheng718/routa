import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HarnessAutomationResponse } from "@/core/harness/automation-types";
import { HarnessAutomationPanel } from "../harness-automation-panel";

vi.mock("@/client/components/codemirror/code-viewer", () => ({
  CodeViewer: ({ code, filename }: { code: string; filename?: string }) => (
    <div data-testid="code-viewer">
      <span>{filename}</span>
      <pre>{code}</pre>
    </div>
  ),
}));

function createAutomationResponse(overrides: Partial<HarnessAutomationResponse> = {}): HarnessAutomationResponse {
  return {
    generatedAt: "2026-04-02T00:00:00.000Z",
    repoRoot: "/tmp/routa",
    configFile: {
      relativePath: "docs/harness/automations.yml",
      source: "automations:\n  - id: long-file-refactor-window",
      schema: "v1",
    },
    definitions: [
      {
        id: "long-file-refactor-window",
        name: "Long file refactor window",
        description: "Queue oversized files for later refactor windows.",
        sourceType: "finding",
        sourceLabel: "Entix long-file finding",
        targetType: "workflow",
        targetLabel: "refactor-window",
        runtimeStatus: "pending",
        pendingCount: 1,
        configPath: "docs/harness/automations.yml",
        runtimeBinding: "weekly-refactor-window",
        nextRunAt: "2026-04-05T09:00:00.000Z",
      },
      {
        id: "weekly-harness-fluency",
        name: "Weekly harness fluency",
        description: "Run the specialist review weekly.",
        sourceType: "schedule",
        sourceLabel: "0 9 * * 1",
        targetType: "specialist",
        targetLabel: "harness-fluency",
        runtimeStatus: "active",
        pendingCount: 0,
        configPath: "docs/harness/automations.yml",
        runtimeBinding: "weekly-harness-fluency",
        nextRunAt: "2026-04-07T09:00:00.000Z",
      },
    ],
    pendingSignals: [
      {
        id: "signal-1",
        automationId: "long-file-refactor-window",
        automationName: "Long file refactor window",
        signalType: "long-file",
        title: "Refactor oversized API route",
        summary: "api/harness.rs exceeds the line budget.",
        severity: "high",
        relativePath: "crates/routa-server/src/api/harness.rs",
        deferUntilCron: "0 9 * * 6",
      },
    ],
    recentRuns: [
      {
        automationId: "weekly-harness-fluency",
        automationName: "Weekly harness fluency",
        sourceType: "schedule",
        runtimeBinding: "weekly-harness-fluency",
        status: "active",
        cronExpr: "0 9 * * 1",
        lastRunAt: "2026-04-01T09:00:00.000Z",
        nextRunAt: "2026-04-08T09:00:00.000Z",
      },
    ],
    warnings: [],
    ...overrides,
  };
}

describe("HarnessAutomationPanel", () => {
  it("renders repo-defined configuration before runtime tables", () => {
    render(
      <HarnessAutomationPanel
        repoLabel="phodal/routa"
        data={createAutomationResponse()}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/清理与纠错闭环/i)).toBeDefined();
    expect(screen.getByText(/配置界面/i)).toBeDefined();
    expect(screen.getByText(/仓库定义的事实来源/i)).toBeDefined();
    expect(screen.getAllByText("docs/harness/automations.yml").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/已配置机制/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/待处理清理 \/ 纠错/i)).toBeDefined();
    expect(screen.getByText(/最近执行状态/i)).toBeDefined();
    expect(screen.getByTestId("code-viewer")).toBeDefined();
  });

  it("shows explicit empty config guidance when no checked-in file exists", () => {
    render(
      <HarnessAutomationPanel
        repoLabel="phodal/routa"
        data={createAutomationResponse({ configFile: null, definitions: [], pendingSignals: [], recentRuns: [] })}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/此仓库暂未找到已入库的清理 \/ 纠错配置文件/i)).toBeDefined();
  });

  it("shows a context hint instead of rendering a blank panel when no data has loaded yet", () => {
    render(
      <HarnessAutomationPanel
        repoLabel="phodal/routa"
        data={null}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/请选择仓库或提供 Harness 上下文/i)).toBeDefined();
  });
});
