import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentHooksResponse } from "@/client/hooks/use-harness-settings-data";
import { I18nProvider } from "@/i18n/context";
import { LOCALE_STORAGE_KEY, type Locale } from "@/i18n/types";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes }: { nodes: Array<{ id: string; data?: { title?: string; subtitle?: string } }> }) => (
    <div data-testid="agent-hook-flow">
      {nodes.map((node) => (
        <div key={node.id}>
          <span>{node.data?.title ?? node.id}</span>
          {node.data?.subtitle ? <span>{node.data.subtitle}</span> : null}
        </div>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right" },
}));

vi.mock("../codemirror/code-viewer", () => ({
  CodeViewer: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

import { HarnessAgentHookWorkbench } from "../harness-agent-hook-workbench";

function renderWithI18n(ui: React.ReactElement, locale: Locale = "en") {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

function createAgentHooksResponse(): AgentHooksResponse {
  return {
    generatedAt: "2026-03-30T00:00:00.000Z",
    repoRoot: "/Users/phodal/ai/routa-js",
    configFile: {
      relativePath: ".codex/hooks.yaml",
      source: "hooks: []",
      schema: "agent-hooks-v1",
    },
    hooks: [
      {
        event: "PreToolUse",
        matcher: "Bash",
        type: "command",
        command: "scripts/check-command.sh",
        timeout: 30,
        blocking: true,
        description: "Guard dangerous shell commands",
        source: ".codex/hooks.yaml:4",
      },
      {
        event: "PostToolUse",
        type: "http",
        url: "http://localhost:4318/hook",
        timeout: 10,
        blocking: false,
        description: "Audit tool results",
        source: ".codex/hooks.yaml:12",
      },
    ],
    warnings: [],
  };
}

describe("HarnessAgentHookWorkbench", () => {
  beforeEach(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
  });

  afterEach(() => {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  });

  it("renders the flow canvas for the selected agent hook event", () => {
    renderWithI18n(<HarnessAgentHookWorkbench data={createAgentHooksResponse()} />);

    const flow = screen.getByTestId("agent-hook-flow");

    expect(screen.getByText("Event → Hook → Outcome")).not.toBeNull();
    expect(flow).not.toBeNull();
    expect(within(flow).getByText("PreToolUse")).not.toBeNull();
    expect(within(flow).getByText("Allow")).not.toBeNull();
    expect(within(flow).getByText("Block")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Basic" }));
    expect(screen.getAllByText("Guard dangerous shell commands").length).toBeGreaterThan(0);
  });

  it("updates the flow when switching to another event", () => {
    renderWithI18n(<HarnessAgentHookWorkbench data={createAgentHooksResponse()} />);

    fireEvent.click(screen.getByRole("button", { name: /PostToolUse/i }));

    const flow = screen.getByTestId("agent-hook-flow");

    fireEvent.click(screen.getByRole("button", { name: "Basic" }));
    expect(screen.getAllByText("Audit tool results").length).toBeGreaterThan(0);
    expect(within(flow).getByText("Signal")).not.toBeNull();
  });

  it("resets inspector to Basic tab when the selected event changes", () => {
    renderWithI18n(<HarnessAgentHookWorkbench data={createAgentHooksResponse()} />);

    fireEvent.click(screen.getByRole("button", { name: /Source/i }));
    expect(screen.queryByText("Lifecycle:")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /PostToolUse/i }));
    expect(screen.getByText("Lifecycle:")).not.toBeNull();
  });

  it("renders localized Chinese labels and flow outcomes", () => {
    renderWithI18n(<HarnessAgentHookWorkbench data={createAgentHooksResponse()} />, "zh");

    const flow = screen.getByTestId("agent-hook-flow");

    expect(screen.getByText("事件 → 钩子 → 结果")).not.toBeNull();
    expect(screen.getByText("Agent 钩子")).not.toBeNull();
    expect(screen.getByRole("button", { name: "基本信息" })).not.toBeNull();
    expect(screen.getByText("生命周期:")).not.toBeNull();
    expect(screen.getByText("可阻塞:")).not.toBeNull();
    expect(within(flow).getByText("允许")).not.toBeNull();
    expect(within(flow).getByText("阻止")).not.toBeNull();
  });
});
