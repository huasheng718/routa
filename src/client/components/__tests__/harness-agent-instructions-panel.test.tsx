import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/context";
import { LOCALE_STORAGE_KEY, type Locale } from "@/i18n/types";

vi.mock("../markdown/markdown-viewer", () => ({
  MarkdownViewer: ({ content }: { content: string }) => <div>{content}</div>,
}));

import { HarnessAgentInstructionsPanel } from "../harness-agent-instructions-panel";
import type { InstructionsResponse } from "@/client/hooks/use-harness-settings-data";

const instructionsData: InstructionsResponse = {
  generatedAt: "2026-03-29T00:00:00.000Z",
  repoRoot: "/Users/phodal/ai/routa-js",
  fileName: "CLAUDE.md",
  relativePath: "CLAUDE.md",
  source: [
    "# Routa.js",
    "",
    "Intro text.",
    "",
    "## Repository Map",
    "",
    "Repository details.",
    "",
    "## Coding Standards",
    "",
    "Coding details.",
  ].join("\n"),
  fallbackUsed: false,
  audit: {
    status: "ok",
    provider: "codex",
    generatedAt: "2026-03-29T00:00:01.000Z",
    durationMs: 1260,
    totalScore: 16,
    overall: "通过",
    oneSentence: "路由、防护、反思、验证均达到工程化可执行标准。",
    principles: {
      routing: 4,
      protection: 4,
      reflection: 4,
      verification: 4,
    },
  },
};

function renderWithI18n(ui: React.ReactElement, locale: Locale = "en") {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("HarnessAgentInstructionsPanel", () => {
  beforeEach(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
  });

  afterEach(() => {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  });

  it("does not render the compact selected-section summary card", () => {
    const { container } = renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={instructionsData}
        variant="compact"
      />,
    );

    expect(screen.queryByText("Selected section")).toBeNull();
    expect(container.querySelectorAll('div[class*="h-[320px]"]')).toHaveLength(2);
    expect(container.querySelectorAll('div[class*="h-[184px]"]')).toHaveLength(0);
  });

  it("renders the instruction file content and metadata", () => {
    renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={instructionsData}
      />,
    );

    expect(screen.getByRole("heading", { name: "Instruction file - CLAUDE.md" })).not.toBeNull();
    expect(screen.getByText("Instruction audit")).not.toBeNull();
    expect(screen.getByText("specialist")).not.toBeNull();
    expect(screen.getByText("codex · 1.3s")).not.toBeNull();
    expect(screen.getByText("16/20")).not.toBeNull();
    expect(screen.getAllByText("4/5").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Progressive disclosure")).not.toBeNull();
    expect(screen.getByText("Negative constraints first")).not.toBeNull();
    expect(screen.getByText("Anti-repeat loop")).not.toBeNull();
    expect(screen.getByText("Deterministic verification")).not.toBeNull();
    expect(screen.getByLabelText("Progressive disclosure description")).not.toBeNull();
    expect(screen.getByText("Load the smallest useful context for each task phase, locate first, then expand instead of flooding the agent with background.")).not.toBeNull();
    expect(screen.getByText((content) => content.includes("# Routa.js"))).not.toBeNull();
  });

  it("supports re-running audit when callback is provided", () => {
    const onAuditRerun = vi.fn();
    renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={instructionsData}
        onAuditRerun={onAuditRerun}
      />,
    );

    const rerunButton = screen.getByRole("button", { name: /Re-run audit/i });
    fireEvent.click(rerunButton);
    expect(onAuditRerun).toHaveBeenCalledTimes(1);
  });

  it("keeps the audit rerun entry visible before the first audit result", () => {
    const onAuditRerun = vi.fn();
    renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={{
          ...instructionsData,
          audit: null,
        }}
        onAuditRerun={onAuditRerun}
      />,
    );

    expect(screen.getByText("Instruction audit")).not.toBeNull();
    expect(screen.getByText("Audit has not been run yet in this view. Click Re-run audit to generate a fresh summary.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Re-run audit/i }));
    expect(onAuditRerun).toHaveBeenCalledTimes(1);
  });

  it("shows explicit running feedback while audit is refreshing", () => {
    renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={instructionsData}
        loading
      />,
    );

    expect(screen.getByText("Running specialist audit...")).not.toBeNull();
  });

  it("renders localized Chinese guidance copy", () => {
    renderWithI18n(
      <HarnessAgentInstructionsPanel
        workspaceId="default"
        repoPath="/Users/phodal/ai/routa-js"
        repoLabel="phodal/routa"
        data={{
          ...instructionsData,
          audit: null,
        }}
        onAuditRerun={vi.fn()}
      />,
      "zh",
    );

    expect(screen.getByRole("heading", { name: "指令文件 - CLAUDE.md" })).not.toBeNull();
    expect(screen.getByText("指令审计")).not.toBeNull();
    expect(screen.getByRole("button", { name: "重新审计" })).not.toBeNull();
    expect(screen.getByText("此视图尚未运行审计。点击重新审计生成新的摘要。")).not.toBeNull();
  });
});
