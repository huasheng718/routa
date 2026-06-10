import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownViewer } from "../markdown-viewer";
import { I18nProvider } from "@/i18n/context";

const { openExternalUrlMock } = vi.hoisted(() => ({
  openExternalUrlMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/client/utils/external-links", () => ({
  openExternalUrl: openExternalUrlMock,
}));

const canonicalStoryMarkdown = `Context before the contract.

\`\`\`yaml
story:
  version: 1
  language: en
  title: Add automatic INVEST quality analysis for user stories
  problem_statement: |
    Routa creates user stories without automated quality validation.
  user_value: |
    Teams get clearer, testable stories before implementation starts.
  acceptance_criteria:
    - id: AC1
      text: Render canonical story YAML as a visual card in markdown preview.
      testable: true
    - id: AC2
      text: Keep non-canonical YAML rendering as a normal code block.
      testable: true
  constraints_and_affected_areas:
    - src/client/components/markdown/markdown-viewer.tsx
    - src/app/workspace/[workspaceId]/kanban/kanban-description-editor.tsx
  dependencies_and_sequencing:
    independent_story_check: pass
    depends_on:
      - none
    unblock_condition: none
  out_of_scope:
    - Story point estimation
  invest:
    independent:
      status: pass
      reason: Single rendering enhancement.
    negotiable:
      status: pass
      reason: Presentation details can evolve later.
    valuable:
      status: pass
      reason: The preview becomes readable.
    estimable:
      status: pass
      reason: Change is limited to existing preview components.
    small:
      status: pass
      reason: Shared component plus integration.
    testable:
      status: pass
      reason: Rendering can be covered by component tests.
\`\`\`

Context after the contract.`;

describe("MarkdownViewer canonical story rendering", () => {
  it("renders canonical story YAML as a structured card and preserves surrounding markdown", () => {
    render(<MarkdownViewer content={canonicalStoryMarkdown} />);

    expect(screen.getByText("Context before the contract.")).toBeTruthy();
    expect(screen.getByText("Context after the contract.")).toBeTruthy();
    expect(screen.getByTestId("canonical-story-renderer")).toBeTruthy();
    expect(screen.getByText("有效 YAML")).toBeTruthy();
    expect(screen.getByText("Add automatic INVEST quality analysis for user stories")).toBeTruthy();
    expect(screen.getByText("问题陈述")).toBeTruthy();
    expect(screen.queryByText("```yaml")).toBeNull();
  });

  it("shows validation feedback for invalid canonical story YAML", () => {
    render(
      <MarkdownViewer
        content={`\`\`\`yaml
story:
  version: 1
  title: Broken story
\`\`\``}
      />,
    );

    expect(screen.getByTestId("canonical-story-renderer-invalid")).toBeTruthy();
    expect(screen.getByText("无效 YAML")).toBeTruthy();
    expect(screen.getByText("这份 canonical story 合同无效，执行前应先修复。")).toBeTruthy();
  });

  it("keeps generic YAML blocks on the normal markdown path", () => {
    render(
      <MarkdownViewer
        content={`\`\`\`yaml
foo: bar
\`\`\``}
      />,
    );

    expect(screen.queryByTestId("canonical-story-renderer")).toBeNull();
    expect(screen.queryByTestId("canonical-story-renderer-invalid")).toBeNull();
    expect(screen.getByText("foo: bar")).toBeTruthy();
  });

  it("hides canonical YAML blocks when hideCanonicalStory is enabled", () => {
    render(
      <MarkdownViewer
        content={`Context before.

\`\`\`yaml
story:
  version: 1
  title: Card title
  problem_statement: |
    Example canonical block.
\`\`\`

Context after.`}
        hideCanonicalStory
      />,
    );

    const rootText = screen.getByRole("paragraph");
    expect(rootText.textContent ?? "").toContain("Context before.");
    expect(rootText.textContent ?? "").toContain("Context after.");
    expect(screen.queryByText("story:")).toBeNull();
    expect(screen.queryByText("Card title")).toBeNull();
  });

  it("opens markdown links through the external URL helper", () => {
    render(<MarkdownViewer content="[Open PR](https://github.com/phodal/routa/pull/497)" />);

    fireEvent.click(screen.getByRole("link", { name: "Open PR" }));

    expect(openExternalUrlMock).toHaveBeenCalledWith("https://github.com/phodal/routa/pull/497");
  });

  it("sanitizes rendered markdown html before injecting it into the DOM", () => {
    const { container } = render(
      <MarkdownViewer
        content={[
          "## Unsafe",
          "",
          "<img src=x onerror=\"window.__xss = true\">",
          "<script>window.__xss = true</script>",
          "[bad](javascript:alert(1))",
        ].join("\n")}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).toContain("Unsafe");
  });

  it("sanitizes html preview blocks and disables script execution in the iframe sandbox", () => {
    const { container } = render(
      <I18nProvider>
        <MarkdownViewer
          content={`\`\`\`html
<html>
  <body>
    <img src="x" onerror="window.parent.__xss = true">
    <script>window.parent.__xss = true</script>
    <p>Preview body</p>
  </body>
</html>
\`\`\``}
        />
      </I18nProvider>,
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(iframe?.getAttribute("srcdoc")).toContain("Preview body");
    expect(iframe?.getAttribute("srcdoc")).not.toContain("<script");
    expect(iframe?.getAttribute("srcdoc")).not.toContain("onerror");
  });
});
