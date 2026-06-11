import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navState = vi.hoisted(() => ({
  params: { workspaceId: "default" },
  push: vi.fn(),
  replace: vi.fn(),
}));

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

const { getDesktopApiBaseUrl } = vi.hoisted(() => ({
  getDesktopApiBaseUrl: vi.fn(() => ""),
}));

const { useWorkspaces } = vi.hoisted(() => ({
  useWorkspaces: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => navState.params,
  usePathname: () => "/workspace/default/spec",
  useRouter: () => ({ push: navState.push, replace: navState.replace }),
}));

vi.mock("@/client/utils/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/client/utils/diagnostics")>("@/client/utils/diagnostics");
  return {
    ...actual,
    desktopAwareFetch,
    getDesktopApiBaseUrl,
  };
});

vi.mock("@/client/hooks/use-workspaces", () => ({
  useWorkspaces,
}));

vi.mock("@/client/components/desktop-app-shell", () => ({
  DesktopAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="desktop-shell">{children}</div>,
}));

vi.mock("@/client/components/workspace-switcher", () => ({
  WorkspaceSwitcher: () => <div data-testid="workspace-switcher" />,
}));

vi.mock("@/client/components/markdown/markdown-viewer", () => ({
  MarkdownViewer: ({ content }: { content: string }) => <div data-testid="markdown-viewer">{content}</div>,
}));

import { SpecPageClient } from "../spec-page-client";

function okJson(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

function errorJson(data: unknown) {
  return {
    ok: false,
    json: async () => data,
  } as Response;
}

function mockSpecResponses(options?: {
  surfaceOk?: boolean;
  failBodyFilenames?: string[];
  createIssueError?: string;
  codebaseCopyError?: string;
  workspaceTaskError?: string;
}) {
  const surfaceOk = options?.surfaceOk ?? true;
  const failBodyFilenames = new Set(options?.failBodyFilenames ?? []);

  desktopAwareFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/api/spec/issues" && init?.method === "POST") {
      if (options?.createIssueError) {
        return errorJson({ error: options.createIssueError });
      }

      const rawBody = init.body;
      const isFormData = rawBody instanceof FormData;
      const body = isFormData
        ? Object.fromEntries(rawBody.entries())
        : JSON.parse(String(rawBody));
      return okJson({
        issue: {
          filename: "2026-05-24-contract-risk.md",
          title: String(body.title ?? ""),
          date: "2026-05-24",
          kind: String(body.kind ?? ""),
          status: String(body.status ?? ""),
          severity: String(body.severity ?? ""),
          area: String(body.area ?? ""),
          tags: String(body.tags ?? "").split(/[,，]/u).filter(Boolean),
          reportedBy: String(body.reportedBy ?? ""),
          relatedIssues: [],
          githubIssue: null,
          githubState: null,
          githubUrl: null,
          attachments: isFormData
            ? rawBody.getAll("attachments").filter((item): item is File => item instanceof File).map((file) => ({
                filename: file.name,
                originalName: file.name,
                path: `assets/2026-05-24-contract-risk/${file.name}`,
                mimeType: file.type,
                size: file.size,
                category: file.type.startsWith("image/")
                  ? "image"
                  : file.type.startsWith("video/")
                    ? "video"
                    : "document",
              }))
            : [],
          body: String(body.body ?? ""),
          bodyLoaded: true,
          surfaceText: String(body.body ?? ""),
        },
      });
    }

    if (path === "/api/workspaces/default/codebases") {
      return okJson({
        codebases: [
          {
            id: "source-codebase",
            workspaceId: "default",
            repoPath: "/repo",
            branch: "main",
            label: "Routa",
            isDefault: true,
          },
        ],
      });
    }

    if (path === "/api/workspaces" && init?.method === "POST") {
      return okJson({
        workspace: {
          id: "workspace-from-spec",
          title: "需求：Spec board",
          status: "active",
          metadata: {},
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
      });
    }

    if (path === "/api/workspaces/workspace-from-spec/codebases" && init?.method === "POST") {
      if (options?.codebaseCopyError) {
        return errorJson({ error: options.codebaseCopyError });
      }

      return okJson({
        codebase: {
          id: "copied-codebase",
          workspaceId: "workspace-from-spec",
          repoPath: "/repo",
          branch: "main",
          label: "Routa",
          isDefault: true,
        },
      });
    }

    if (path === "/api/workspaces/workspace-from-spec" && init?.method === "DELETE") {
      return okJson({ deleted: true });
    }

    if (path === "/api/tasks" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      if (body.workspaceId === "workspace-from-spec" && options?.workspaceTaskError) {
        return errorJson({ error: options.workspaceTaskError });
      }
      return okJson({
        task: {
          id: body.workspaceId === "workspace-from-spec" ? "task-from-spec" : "task-current-workspace",
        },
      });
    }

    if (path.includes("/api/spec/issues?workspaceId=default&filename=")) {
      const url = new URL(path, "http://localhost");
      const filename = url.searchParams.get("filename");
      if (filename && failBodyFilenames.has(filename)) {
        return errorJson({ error: "Body unavailable" });
      }
      const bodyByFilename: Record<string, string> = {
        "2026-04-11-spec-board.md": [
          "Rendered as markdown.",
          "Marker: lineage-alpha",
          "",
          "## Relevant Files",
          "- `src/app/workspace/[workspaceId]/kanban/page.tsx`",
          "- `src/app/api/kanban/boards/route.ts`",
          "",
          "Touches `/workspace/default/kanban` and `/api/kanban/boards`.",
        ].join("\n"),
        "2026-04-10-linked-issue.md": "Second body for the linked issue.",
      };
      return okJson({
        issue: {
          filename,
          title: filename === "2026-04-11-spec-board.md" ? "Spec board" : "Linked issue",
          date: filename === "2026-04-11-spec-board.md" ? "2026-04-11" : "2026-04-10",
          kind: filename === "2026-04-11-spec-board.md" ? "progress_note" : "issue",
          status: filename === "2026-04-11-spec-board.md" ? "closed" : "open",
          severity: filename === "2026-04-11-spec-board.md" ? "high" : "medium",
          area: "kanban",
          tags: filename === "2026-04-11-spec-board.md" ? ["kanban", "board"] : ["link-target"],
          reportedBy: "codex",
          relatedIssues: filename === "2026-04-11-spec-board.md"
            ? [
                "docs/issues/2026-04-10-linked-issue.md",
                "https://github.com/phodal/routa/issues/410",
              ]
            : [],
          githubIssue: filename === "2026-04-11-spec-board.md" ? 410 : null,
          githubState: filename === "2026-04-11-spec-board.md" ? "closed" : null,
          githubUrl: filename === "2026-04-11-spec-board.md" ? "https://github.com/phodal/routa/issues/410" : null,
          body: bodyByFilename[filename ?? ""] ?? "",
          bodyLoaded: true,
          surfaceText: bodyByFilename[filename ?? ""] ?? "",
        },
      });
    }

    if (path.includes("/api/spec/issues?workspaceId=default&includeBody=false")) {
      return okJson({
        issues: [
          {
            filename: "2026-04-11-spec-board.md",
            title: "Spec board",
            date: "2026-04-11",
            kind: "progress_note",
            status: "closed",
            severity: "high",
            area: "kanban",
            tags: ["kanban", "board"],
            reportedBy: "codex",
            relatedIssues: [
              "docs/issues/2026-04-10-linked-issue.md",
              "https://github.com/phodal/routa/issues/410",
            ],
            githubIssue: 410,
            githubState: "closed",
            githubUrl: "https://github.com/phodal/routa/issues/410",
            body: "",
            bodyLoaded: false,
            surfaceText: [
              "## Relevant Files",
              "- `src/app/workspace/[workspaceId]/kanban/page.tsx`",
              "- `src/app/api/kanban/boards/route.ts`",
              "Touches `/workspace/default/kanban` and `/api/kanban/boards`.",
            ].join("\n"),
          },
          {
            filename: "2026-04-10-linked-issue.md",
            title: "Linked issue",
            date: "2026-04-10",
            kind: "issue",
            status: "open",
            severity: "medium",
            area: "kanban",
            tags: ["link-target"],
            reportedBy: "codex",
            relatedIssues: [],
            githubIssue: null,
            githubState: null,
            githubUrl: null,
            body: "",
            bodyLoaded: false,
            surfaceText: "",
          },
        ],
      });
    }

    if (path.includes("/api/spec/surface-index?workspaceId=default")) {
      if (!surfaceOk) {
        return errorJson({ error: "Feature surface index missing" });
      }

      return okJson({
        generatedAt: "2026-04-16T00:00:00.000Z",
        repoRoot: "/repo",
        warnings: [],
        pages: [
          {
            route: "/workspace/:workspaceId/kanban",
            title: "Workspace / Kanban",
            description: "Kanban workspace view",
            sourceFile: "src/app/workspace/[workspaceId]/kanban/page.tsx",
          },
        ],
        apis: [
          {
            domain: "kanban",
            method: "GET",
            path: "/api/kanban/boards",
            operationId: "listKanbanBoards",
            summary: "List kanban boards",
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${path}`);
  });
}

describe("SpecPageClient", () => {
  beforeEach(() => {
    navState.params = { workspaceId: "default" };
    navState.push.mockReset();
    navState.replace.mockReset();
    window.history.replaceState(null, "", "/workspace/default/spec");
    desktopAwareFetch.mockReset();
    getDesktopApiBaseUrl.mockReturnValue("");
    useWorkspaces.mockReturnValue({
      loading: false,
      workspaces: [{ id: "default", title: "Default Workspace" }],
      createWorkspace: vi.fn(),
    });
  });

  it("loads issue families, shows feature footprint matches, and follows local relations", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Spec board" });

    const requestedPaths = desktopAwareFetch.mock.calls.map(([path]) => path);
    expect(requestedPaths).toContain("/api/spec/issues?workspaceId=default&includeBody=false");
    expect(requestedPaths).toContain("/api/spec/surface-index?workspaceId=default");

    const statusBoard = screen.getByRole("region", { name: "状态" });
    expect(within(statusBoard).getByText("已解决")).toBeTruthy();
    expect(within(statusBoard).getByText("待处理")).toBeTruthy();
    expect(within(statusBoard).getByRole("button", { name: /Spec board/i })).toBeTruthy();
    expect(within(statusBoard).getByText("2026-04-11")).toBeTruthy();
    expect(within(statusBoard).getAllByText("kanban").length).toBeGreaterThan(0);
    expect(within(statusBoard).getAllByText("board").length).toBeGreaterThan(0);

    expect(screen.getAllByText("关系簇").length).toBeGreaterThan(0);

    expect(within(detailPane).getByText("影响面")).toBeTruthy();
    expect(within(detailPane).getAllByText("/workspace/:workspaceId/kanban").length).toBeGreaterThan(0);
    expect(within(detailPane).getByText("GET /api/kanban/boards")).toBeTruthy();

    const linkedButtons = within(detailPane).getAllByRole("button", { name: /Linked issue/i });
    fireEvent.click(linkedButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Linked issue" })).toBeTruthy();
    });

    const linkedPane = screen.getByRole("region", { name: "Linked issue" });
    expect(within(linkedPane).getByText("同簇问题")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("markdown-viewer").textContent).toContain("Second body for the linked issue.");
    });
    expect(desktopAwareFetch.mock.calls.some(([path]) => (
      String(path).includes("/api/spec/issues?workspaceId=default&filename=2026-04-10-linked-issue.md")
    ))).toBe(true);
  });

  it("opens the demand detail from the issue query parameter", async () => {
    window.history.replaceState(null, "", "/workspace/default/spec?issue=2026-04-10-linked-issue.md");
    mockSpecResponses();

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Linked issue" });
    expect(within(detailPane).getByText("Linked issue")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("markdown-viewer").textContent).toContain("Second body for the linked issue.");
    });
  });

  it("updates the issue query parameter when selecting a demand", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });

    const statusBoard = screen.getByRole("region", { name: "状态" });
    fireEvent.click(within(statusBoard).getByRole("button", { name: /Linked issue/i }));

    await waitFor(() => {
      expect(navState.replace).toHaveBeenCalledWith(
        "/workspace/default/spec?issue=2026-04-10-linked-issue.md",
        { scroll: false },
      );
    });
  });

  it("allows collapsing the currently selected family cluster from the explorer", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getAllByText("关系簇").length).toBeGreaterThan(1);
    });

    const explorer = screen.getAllByText("关系簇")[1]?.closest("section");
    expect(explorer).toBeTruthy();

    await waitFor(() => {
      expect(within(explorer as HTMLElement).getAllByRole("button", { name: /Linked issue/i }).length).toBeGreaterThan(1);
    });

    fireEvent.click(within(explorer as HTMLElement).getAllByRole("button", { name: /Linked issue/i })[0] as HTMLElement);

    await waitFor(() => {
      expect(within(explorer as HTMLElement).getAllByRole("button", { name: /Linked issue/i })).toHaveLength(1);
    });

    fireEvent.click(within(explorer as HTMLElement).getByRole("button", { name: /Linked issue/i }));

    await waitFor(() => {
      expect(within(explorer as HTMLElement).getAllByRole("button", { name: /Linked issue/i }).length).toBeGreaterThan(1);
    });
  });

  it("keeps rendering issues when the feature map endpoint is unavailable", async () => {
    mockSpecResponses({ surfaceOk: false });

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });

    expect(screen.getAllByText("产品面索引未生成").length).toBeGreaterThan(0);
    expect(screen.getByText("当前代码库还没有 docs/product-specs/FEATURE_TREE.md，需求仍可查看和开启工作区；如需展示页面、接口和特性影响面，请先到特性浏览生成特性树。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去生成特性树" }).getAttribute("href")).toBe("/workspace/default/feature-explorer");
  });

  it("filters visible issues by kind and severity from the toolbar", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "类型" }), {
      target: { value: "issue" },
    });

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Linked issue" })).toBeTruthy();
    });

    expect(screen.queryAllByRole("button", { name: /Spec board/i })).toHaveLength(0);

    fireEvent.change(screen.getByRole("combobox", { name: "类型" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "严重级别" }), {
      target: { value: "high" },
    });

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });

    expect(screen.queryAllByRole("button", { name: /Linked issue/i })).toHaveLength(0);
  });

  it("creates a new demand from the spec page and selects it", async () => {
    mockSpecResponses();
    getDesktopApiBaseUrl.mockReturnValue("http://127.0.0.1:3210");

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "新增需求" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "新增需求" })).toBeTruthy();
    });

    const dialog = screen.getByRole("dialog", { name: "新增需求" });
    expect(within(dialog).getByText("需求内容")).toBeTruthy();
    expect(within(dialog).getByText("分类信息")).toBeTruthy();
    expect(within(dialog).getByText("附件材料")).toBeTruthy();
    expect(within(dialog).getByLabelText("取消")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("需求标题"), {
      target: { value: "合同审批增加风险提示" },
    });
    fireEvent.change(within(dialog).getByLabelText("领域"), {
      target: { value: "contract" },
    });
    fireEvent.change(within(dialog).getByLabelText("标签"), {
      target: { value: "合同,审批" },
    });
    fireEvent.change(within(dialog).getByLabelText("正文"), {
      target: { value: "需要在合同审批前展示风险提示。" },
    });
    const imageFile = new File(["image"], "risk.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("上传附件"), {
      target: { files: [imageFile] },
    });
    expect(within(dialog).getByText("risk.png")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "新增需求" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "合同审批增加风险提示" })).toBeTruthy();
    });

    const createCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/spec/issues" && init?.method === "POST"
    ));
    const createBody = createCall?.[1]?.body;
    expect(createBody).toBeInstanceOf(FormData);
    expect((createBody as FormData).get("workspaceId")).toBe("default");
    expect((createBody as FormData).get("title")).toBe("合同审批增加风险提示");
    expect((createBody as FormData).get("area")).toBe("contract");
    expect((createBody as FormData).get("severity")).toBe("medium");
    expect((createBody as FormData).get("tags")).toBe("合同,审批");
    expect((createBody as FormData).get("body")).toBe("需要在合同审批前展示风险提示。");
    expect((createBody as FormData).get("kind")).toBe("issue");
    expect((createBody as FormData).get("status")).toBe("open");
    expect((createBody as FormData).get("reportedBy")).toBe("human");
    expect(((createBody as FormData).get("attachments") as File).name).toBe("risk.png");
    expect((createBody as FormData).get("attachmentNames")).toBe("risk.png");
    expect(screen.getByRole("img", { name: "risk.png" }).getAttribute("src")).toBe(
      "http://127.0.0.1:3210/api/spec/issues/assets?workspaceId=default&path=assets%2F2026-05-24-contract-risk%2Frisk.png",
    );
    expect(screen.getByTestId("markdown-viewer").textContent).toContain("需要在合同审批前展示风险提示。");
  });

  it("previews image and video attachments while keeping document attachments as links", async () => {
    mockSpecResponses();
    getDesktopApiBaseUrl.mockReturnValue("http://127.0.0.1:3210");

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(screen.getByRole("button", { name: "新增需求" }));

    const dialog = await screen.findByRole("dialog", { name: "新增需求" });
    fireEvent.change(within(dialog).getByLabelText("需求标题"), {
      target: { value: "附件预览验证" },
    });
    fireEvent.change(within(dialog).getByLabelText("上传附件"), {
      target: {
        files: [
          new File(["image"], "flow.png", { type: "image/png" }),
          new File(["video"], "demo.mp4", { type: "video/mp4" }),
          new File(["doc"], "brief.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "新增需求" }));

    await screen.findByRole("region", { name: "附件预览验证" });

    const image = screen.getByRole("img", { name: "flow.png" });
    expect(image.getAttribute("src")).toBe(
      "http://127.0.0.1:3210/api/spec/issues/assets?workspaceId=default&path=assets%2F2026-05-24-contract-risk%2Fflow.png",
    );

    const video = document.querySelector("video");
    expect(video?.getAttribute("controls")).not.toBeNull();
    expect(video?.getAttribute("src")).toBe(
      "http://127.0.0.1:3210/api/spec/issues/assets?workspaceId=default&path=assets%2F2026-05-24-contract-risk%2Fdemo.mp4",
    );

    expect(screen.getByRole("link", { name: /brief.pdf/i }).getAttribute("href")).toBe(
      "http://127.0.0.1:3210/api/spec/issues/assets?workspaceId=default&path=assets%2F2026-05-24-contract-risk%2Fbrief.pdf",
    );
  });

  it("removes an attachment from the create demand dialog before submitting", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "新增需求" }));

    const dialog = await screen.findByRole("dialog", { name: "新增需求" });
    fireEvent.change(within(dialog).getByLabelText("需求标题"), {
      target: { value: "附件移除验证" },
    });
    const imageFile = new File(["image"], "keep.png", { type: "image/png" });
    const documentFile = new File(["doc"], "remove.pdf", { type: "application/pdf" });
    fireEvent.change(within(dialog).getByLabelText("上传附件"), {
      target: { files: [imageFile, documentFile] },
    });

    expect(within(dialog).getByText("keep.png")).toBeTruthy();
    expect(within(dialog).getByText("remove.pdf")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "移除附件：remove.pdf" }));

    await waitFor(() => {
      expect(within(dialog).queryByText("remove.pdf")).toBeNull();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "新增需求" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "附件移除验证" })).toBeTruthy();
    });

    const createCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/spec/issues" && init?.method === "POST"
    ));
    const createBody = createCall?.[1]?.body as FormData;
    expect(createBody.getAll("attachments").map((item) => (item as File).name)).toEqual(["keep.png"]);
    expect(createBody.getAll("attachmentNames")).toEqual(["keep.png"]);
  });

  it("keeps the create demand dialog editable when upload submission fails", async () => {
    mockSpecResponses({ createIssueError: "附件上传失败" });

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(screen.getByRole("button", { name: "新增需求" }));

    const dialog = await screen.findByRole("dialog", { name: "新增需求" });
    fireEvent.change(within(dialog).getByLabelText("需求标题"), {
      target: { value: "上传失败仍可编辑" },
    });
    fireEvent.change(within(dialog).getByLabelText("正文"), {
      target: { value: "失败后不应清空正文和附件。" },
    });
    const videoFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    fireEvent.change(within(dialog).getByLabelText("上传附件"), {
      target: { files: [videoFile] },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "新增需求" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert").textContent).toContain("附件上传失败");
    });
    expect(screen.getByRole("dialog", { name: "新增需求" })).toBeTruthy();
    expect((within(dialog).getByLabelText("需求标题") as HTMLInputElement).value).toBe("上传失败仍可编辑");
    expect((within(dialog).getByLabelText("正文") as HTMLTextAreaElement).value).toBe("失败后不应清空正文和附件。");
    expect(within(dialog).getByText("demo.mp4")).toBeTruthy();
  });

  it("keeps the selected demand visible when body loading fails and clears the error on next selection", async () => {
    mockSpecResponses({ failBodyFilenames: ["2026-04-11-spec-board.md"] });

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Spec board" })).toBeTruthy();
    });
    await screen.findByText("Body unavailable");

    const statusBoard = screen.getByRole("region", { name: "状态" });
    fireEvent.click(within(statusBoard).getByRole("button", { name: /Linked issue/i }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Linked issue" })).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByText("Body unavailable")).toBeNull();
      expect(screen.getByTestId("markdown-viewer").textContent).toContain("Second body for the linked issue.");
    });
  });

  it("opens a new workspace from the selected demand and creates a kanban task", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(within(detailPane).getByRole("button", { name: "开启工作区" }));

    await waitFor(() => {
      expect(navState.push).toHaveBeenCalledWith("/workspace/workspace-from-spec/kanban?taskId=task-from-spec");
    });

    const workspaceCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/workspaces" && init?.method === "POST"
    ));
    expect(JSON.parse(String(workspaceCall?.[1]?.body))).toMatchObject({
      title: "需求：Spec board",
    });

    const codebaseCopyCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/workspaces/workspace-from-spec/codebases" && init?.method === "POST"
    ));
    expect(JSON.parse(String(codebaseCopyCall?.[1]?.body))).toMatchObject({
      repoPath: "/repo",
      branch: "main",
      label: "Routa",
    });

    const taskCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ));
    const taskBody = JSON.parse(String(taskCall?.[1]?.body));
    expect(taskBody).toMatchObject({
      workspaceId: "workspace-from-spec",
      title: "Spec board",
      scope: "kanban",
      priority: "high",
      labels: ["progress_note", "high", "kanban", "board"],
      codebaseIds: ["copied-codebase"],
      githubNumber: 410,
      githubUrl: "https://github.com/phodal/routa/issues/410",
      githubState: "closed",
      creationSource: "manual",
    });
    expect(taskBody.contextSearchSpec).toMatchObject({
      query: "Spec board",
      relatedFiles: ["docs/issues/2026-04-11-spec-board.md"],
      moduleHints: ["kanban"],
    });
    expect(taskBody.contextSearchSpec.symptomHints).toEqual(expect.arrayContaining(["Spec board", "high", "kanban", "board"]));
    expect(taskBody.objective).toContain("从需求管理开启的新工作区任务。");
    expect(taskBody.objective).toContain("来源需求: Spec board");
    expect(taskBody.objective).toContain("Marker: lineage-alpha");
    expect(taskBody.acceptanceCriteria).toEqual([
      "新工作区保留原需求来源与关联上下文。",
      "新工作区已准备当前代码库上下文，可直接进入看板推进。",
    ]);
  });

  it("surfaces codebase copy failures when opening a workspace and does not create a task", async () => {
    mockSpecResponses({ codebaseCopyError: "代码库复制失败" });

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(within(detailPane).getByRole("button", { name: "开启工作区" }));

    await waitFor(() => {
      expect(screen.getByText("开启工作区失败: 代码库复制失败")).toBeTruthy();
    });
    expect(navState.push).not.toHaveBeenCalled();
    expect(desktopAwareFetch.mock.calls.some(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ))).toBe(false);
    expect(desktopAwareFetch.mock.calls.some(([path, init]) => (
      path === "/api/workspaces/workspace-from-spec" && init?.method === "DELETE"
    ))).toBe(true);
  });

  it("rolls back the new workspace when workspace task creation fails", async () => {
    mockSpecResponses({ workspaceTaskError: "任务创建失败" });

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(within(detailPane).getByRole("button", { name: "开启工作区" }));

    await waitFor(() => {
      expect(screen.getByText("开启工作区失败: 任务创建失败")).toBeTruthy();
    });
    expect(navState.push).not.toHaveBeenCalled();
    expect(desktopAwareFetch.mock.calls.some(([path, init]) => (
      path === "/api/workspaces/workspace-from-spec" && init?.method === "DELETE"
    ))).toBe(true);
  });

  it("creates a kanban task in the current workspace from the selected demand", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    const detailPane = await screen.findByRole("region", { name: "Spec board" });
    fireEvent.click(within(detailPane).getByRole("button", { name: "创建看板任务" }));

    await waitFor(() => {
      expect(navState.push).toHaveBeenCalledWith("/workspace/default/kanban?taskId=task-current-workspace");
    });

    const taskCalls = desktopAwareFetch.mock.calls.filter(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ));
    expect(taskCalls).toHaveLength(1);
    const taskBody = JSON.parse(String(taskCalls[0]?.[1]?.body));
    expect(taskBody).toMatchObject({
      workspaceId: "default",
      title: "Spec board",
      scope: "kanban",
      priority: "high",
      labels: ["progress_note", "high", "kanban", "board"],
      githubNumber: 410,
      githubUrl: "https://github.com/phodal/routa/issues/410",
      githubState: "closed",
      creationSource: "manual",
    });
    expect(taskBody.contextSearchSpec).toMatchObject({
      query: "Spec board",
      relatedFiles: ["docs/issues/2026-04-11-spec-board.md"],
      moduleHints: ["kanban"],
    });
    expect(taskBody.contextSearchSpec.symptomHints).toEqual(expect.arrayContaining(["Spec board", "high", "kanban", "board"]));
    expect(taskBody.objective).toContain("从需求管理创建的当前工作区看板任务。");
    expect(taskBody.objective).toContain("来源需求: Spec board");
    expect(taskBody.objective).toContain("Marker: lineage-alpha");
    expect(taskBody.acceptanceCriteria).toEqual([
      "看板任务保留原需求来源与关联上下文。",
      "看板任务已进入当前工作区，可继续拆解、分派和推进。",
    ]);
  });

  it("merges selected demands into one kanban task in the current workspace", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });

    fireEvent.click(screen.getAllByLabelText("选择需求：Spec board")[0] as HTMLElement);
    fireEvent.click(screen.getAllByLabelText("选择需求：Linked issue")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "合并创建看板任务" }));

    await waitFor(() => {
      expect(navState.push).toHaveBeenCalledWith("/workspace/default/kanban?taskId=task-current-workspace");
    });

    const taskCalls = desktopAwareFetch.mock.calls.filter(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ));
    expect(taskCalls).toHaveLength(1);
    const taskBody = JSON.parse(String(taskCalls[0]?.[1]?.body));
    expect(taskBody).toMatchObject({
      workspaceId: "default",
      title: "合并需求：Spec board 等 2 条",
      scope: "kanban",
      priority: "high",
      labels: ["progress_note", "high", "kanban", "board", "issue", "medium", "link-target"],
      creationSource: "manual",
    });
    expect(taskBody.contextSearchSpec).toMatchObject({
      query: "Spec board Linked issue",
      relatedFiles: [
        "docs/issues/2026-04-11-spec-board.md",
        "docs/issues/2026-04-10-linked-issue.md",
      ],
      moduleHints: ["kanban"],
    });
    expect(taskBody.contextSearchSpec.symptomHints).toEqual(expect.arrayContaining([
      "Spec board",
      "Linked issue",
      "high",
      "medium",
      "kanban",
      "board",
      "link-target",
    ]));
    expect(taskBody.githubNumber).toBeUndefined();
    expect(taskBody.objective).toContain("从需求管理合并创建的当前工作区看板任务。");
    expect(taskBody.objective).toContain("合并来源需求:");
    expect(taskBody.objective).toContain("1. Spec board");
    expect(taskBody.objective).toContain("2. Linked issue");
    expect(taskBody.objective).toContain("Marker: lineage-alpha");
    expect(taskBody.objective).toContain("Second body for the linked issue.");
  });

  it("stops merged task creation before posting when a selected demand body cannot load", async () => {
    mockSpecResponses({ failBodyFilenames: ["2026-04-11-spec-board.md"] });

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });
    await screen.findByText("Body unavailable");

    fireEvent.click(screen.getAllByLabelText("选择需求：Spec board")[0] as HTMLElement);
    fireEvent.click(screen.getAllByLabelText("选择需求：Linked issue")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "合并创建看板任务" }));

    await waitFor(() => {
      expect(screen.getByText("创建看板任务失败: Body unavailable")).toBeTruthy();
    });
    expect(navState.push).not.toHaveBeenCalled();
    expect(desktopAwareFetch.mock.calls.some(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ))).toBe(false);
  });

  it("merges selected demands into a new workspace and creates one kanban task", async () => {
    mockSpecResponses();

    render(<SpecPageClient />);

    await screen.findByRole("region", { name: "Spec board" });

    fireEvent.click(screen.getAllByLabelText("选择需求：Spec board")[0] as HTMLElement);
    fireEvent.click(screen.getAllByLabelText("选择需求：Linked issue")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "合并开启工作区" }));

    await waitFor(() => {
      expect(navState.push).toHaveBeenCalledWith("/workspace/workspace-from-spec/kanban?taskId=task-from-spec");
    });

    const workspaceCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/workspaces" && init?.method === "POST"
    ));
    expect(JSON.parse(String(workspaceCall?.[1]?.body))).toMatchObject({
      title: "合并需求：Spec board 等 2 条",
    });

    const taskCall = desktopAwareFetch.mock.calls.find(([path, init]) => (
      path === "/api/tasks" && init?.method === "POST"
    ));
    const taskBody = JSON.parse(String(taskCall?.[1]?.body));
    expect(taskBody).toMatchObject({
      workspaceId: "workspace-from-spec",
      title: "合并需求：Spec board 等 2 条",
      scope: "kanban",
      priority: "high",
      labels: ["progress_note", "high", "kanban", "board", "issue", "medium", "link-target"],
      codebaseIds: ["copied-codebase"],
      creationSource: "manual",
    });
    expect(taskBody.contextSearchSpec).toMatchObject({
      query: "Spec board Linked issue",
      relatedFiles: [
        "docs/issues/2026-04-11-spec-board.md",
        "docs/issues/2026-04-10-linked-issue.md",
      ],
      moduleHints: ["kanban"],
    });
    expect(taskBody.contextSearchSpec.symptomHints).toEqual(expect.arrayContaining([
      "Spec board",
      "Linked issue",
      "high",
      "medium",
      "kanban",
      "board",
      "link-target",
    ]));
    expect(taskBody.githubNumber).toBeUndefined();
    expect(taskBody.objective).toContain("从需求管理合并开启的新工作区任务。");
    expect(taskBody.objective).toContain("合并来源需求:");
    expect(taskBody.objective).toContain("1. Spec board");
    expect(taskBody.objective).toContain("2. Linked issue");
    expect(taskBody.acceptanceCriteria).toEqual([
      "新工作区保留原需求来源与关联上下文。",
      "新工作区已准备当前代码库上下文，可直接进入看板推进。",
    ]);
  });

  it("explains missing feature index even when the selected workspace has no demand records", async () => {
    desktopAwareFetch.mockImplementation(async (path: string) => {
      if (path.includes("/api/spec/issues?workspaceId=default&includeBody=false")) {
        return okJson({ issues: [] });
      }
      if (path.includes("/api/spec/surface-index?workspaceId=default")) {
        return okJson({
          generatedAt: "",
          repoRoot: "/repo",
          warnings: ["Feature surface index not found at docs/product-specs/FEATURE_TREE.md"],
          pages: [],
          apis: [],
        });
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "选择一条需求" })).toBeTruthy();
    });

    expect(screen.getAllByText("产品面索引未生成").length).toBeGreaterThan(0);
    expect(screen.getByText("当前代码库还没有 docs/product-specs/FEATURE_TREE.md，需求仍可查看和开启工作区；如需展示页面、接口和特性影响面，请先到特性浏览生成特性树。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去生成特性树" }).getAttribute("href")).toBe("/workspace/default/feature-explorer");
  });

  it("surfaces issue API errors instead of rendering an empty board", async () => {
    desktopAwareFetch.mockImplementation(async (path: string) => {
      if (path.includes("/api/spec/issues?workspaceId=default&includeBody=false")) {
        return errorJson({ error: "Missing spec repo" });
      }
      if (path.includes("/api/spec/surface-index?workspaceId=default")) {
        return okJson({
          generatedAt: "",
          repoRoot: "",
          warnings: [],
          pages: [],
          apis: [],
        });
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    render(<SpecPageClient />);

    await waitFor(() => {
      expect(screen.getByText("Missing spec repo")).toBeTruthy();
    });
  });
});
