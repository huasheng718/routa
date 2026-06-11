import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { SPEC_ISSUE_MAX_ATTACHMENT_COUNT } from "@/core/spec/issues";

const system = {
  codebaseStore: {
    get: vi.fn(),
    listByWorkspace: vi.fn(),
  },
};

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => system,
}));

import { GET, POST } from "../route";

async function createTempRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "routa-spec-route-"));
  await mkdir(path.join(repoRoot, "docs", "issues"), { recursive: true });
  return repoRoot;
}

describe("/api/spec/issues route", () => {
  it("lists issues, normalizes YAML dates, and maps closed items to resolved", async () => {
    const repoRoot = await createTempRepo();

    try {
      await writeFile(
        path.join(repoRoot, "docs", "issues", "2026-04-11-spec-board.md"),
        `---
title: Spec board
date: 2026-04-11
kind: progress_note
status: closed
severity: high
area: ui
tags: [spec, board]
reported_by: codex
related_issues: ["https://github.com/phodal/routa/issues/410"]
github_issue: "410"
github_state: closed
github_url: https://github.com/phodal/routa/issues/410
---

# Spec board

Rendered as markdown.
`,
      );
      await writeFile(
        path.join(repoRoot, "docs", "issues", "2026-04-10-older.md"),
        `---
title: Older issue
date: "2026-04-10"
status: open
severity: medium
---

Older body.
`,
      );
      await writeFile(
        path.join(repoRoot, "docs", "issues", "_template.md"),
        "---\ntitle: Template\n---\n",
      );
      await writeFile(
        path.join(repoRoot, "docs", "issues", "2026-04-09-malformed.md"),
        "not frontmatter",
      );

      const response = await GET(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}`,
      ));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.repoRoot).toBe(repoRoot);
      expect(payload.issues).toHaveLength(2);
      expect(payload.issues.map((issue: { filename: string }) => issue.filename)).toEqual([
        "2026-04-11-spec-board.md",
        "2026-04-10-older.md",
      ]);
      expect(payload.issues[0]).toMatchObject({
        title: "Spec board",
        date: "2026-04-11",
        kind: "progress_note",
        status: "resolved",
        severity: "high",
        area: "ui",
        reportedBy: "codex",
        githubIssue: 410,
        githubState: "closed",
        githubUrl: "https://github.com/phodal/routa/issues/410",
        relatedIssues: ["https://github.com/phodal/routa/issues/410"],
        body: "# Spec board\n\nRendered as markdown.",
        bodyLoaded: true,
      });
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("omits issue bodies from lightweight list responses and loads one body by filename", async () => {
    const repoRoot = await createTempRepo();

    try {
      await writeFile(
        path.join(repoRoot, "docs", "issues", "2026-04-11-spec-board.md"),
        `---
title: Spec board
date: 2026-04-11
status: open
severity: high
tags: [kanban]
---

# Spec board

Rendered as markdown.

Touches \`/workspace/default/kanban\` and \`src/app/api/kanban/boards/route.ts\`.
`,
      );

      const listResponse = await GET(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}&includeBody=false`,
      ));
      const listPayload = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listPayload.issues).toHaveLength(1);
      expect(listPayload.issues[0]).toMatchObject({
        filename: "2026-04-11-spec-board.md",
        body: "",
        bodyLoaded: false,
      });
      expect(listPayload.issues[0].surfaceText).toContain("/workspace/default/kanban");
      expect(listPayload.issues[0].surfaceText).toContain("src/app/api/kanban/boards/route.ts");

      const detailResponse = await GET(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}&filename=2026-04-11-spec-board.md`,
      ));
      const detailPayload = await detailResponse.json();

      expect(detailResponse.status).toBe(200);
      expect(detailPayload.issue).toMatchObject({
        filename: "2026-04-11-spec-board.md",
        bodyLoaded: true,
      });
      expect(detailPayload.issue.body).toContain("Rendered as markdown.");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("creates a new issue markdown file in the selected repo", async () => {
    const repoRoot = await createTempRepo();

    try {
      const response = await POST(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: "新增合同审批风险提示",
            body: "需要在合同审批前展示风险提示。\n\n涉及 `/workspace/default/spec`。",
            area: "contract",
            severity: "high",
            tags: "需求,审批",
            reportedBy: "human",
          }),
        },
      ));
      const payload = await response.json();

      expect(response.status, JSON.stringify(payload)).toBe(201);
      expect(payload.repoRoot).toBe(repoRoot);
      expect(payload.issue).toMatchObject({
        title: "新增合同审批风险提示",
        kind: "issue",
        status: "open",
        severity: "high",
        area: "contract",
        tags: ["需求", "审批"],
        reportedBy: "human",
        bodyLoaded: true,
      });
      expect(payload.issue.filename).toMatch(/^\d{4}-\d{2}-\d{2}-新增合同审批风险提示\.md$/u);
      expect(payload.issue.body).toContain("需要在合同审批前展示风险提示。");
      expect(payload.issue.surfaceText).toContain("/workspace/default/spec");

      const listResponse = await GET(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}&includeBody=false`,
      ));
      const listPayload = await listResponse.json();
      expect(listPayload.issues).toHaveLength(1);
      expect(listPayload.issues[0]).toMatchObject({
        filename: payload.issue.filename,
        body: "",
        bodyLoaded: false,
      });
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("creates an issue with uploaded document, image, and video attachments", async () => {
    const repoRoot = await createTempRepo();

    try {
      const formData = new FormData();
      formData.append("title", "带附件的需求");
      formData.append("body", "需要沉淀附件材料。");
      formData.append("area", "spec");
      formData.append("severity", "medium");
      formData.append("tags", "附件,素材");
      formData.append("reportedBy", "human");
      formData.append("attachments", new File(["document"], "需求说明.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }), "需求说明.docx");
      formData.append("attachmentNames", "需求说明.docx");
      formData.append("attachments", new File(["image"], "流程图.png", { type: "image/png" }), "流程图.png");
      formData.append("attachmentNames", "流程图.png");
      formData.append("attachments", new File(["video"], "演示视频.mp4", { type: "video/mp4" }), "演示视频.mp4");
      formData.append("attachmentNames", "演示视频.mp4");

      const response = await POST(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}`,
        {
          method: "POST",
          body: formData,
        },
      ));
      const payload = await response.json();

      expect(response.status, JSON.stringify(payload)).toBe(201);
      expect(payload.issue.attachments).toHaveLength(3);
      expect(payload.issue.attachments.map((attachment: { category: string }) => attachment.category)).toEqual([
        "document",
        "image",
        "video",
      ]);
      expect(payload.issue.body).toContain("## 附件");
      expect(payload.issue.body).toContain("需求说明.docx");
      expect(payload.issue.body).toContain("流程图.png");
      expect(payload.issue.body).toContain("演示视频.mp4");

      const issuePath = path.join(repoRoot, "docs", "issues", payload.issue.filename);
      const issueContent = await readFile(issuePath, "utf-8");
      expect(issueContent).toContain("attachments:");
      expect(issueContent).toContain("original_name: 需求说明.docx");
      expect(issueContent).toContain("mime_type: image/png");
      expect(issueContent).toContain("./assets/");

      for (const attachment of payload.issue.attachments as Array<{ path: string }>) {
        await expect(stat(path.join(repoRoot, "docs", "issues", attachment.path))).resolves.toBeTruthy();
      }
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns 400 for unsupported uploaded attachment types", async () => {
    const repoRoot = await createTempRepo();

    try {
      const formData = new FormData();
      formData.append("title", "不支持的附件");
      formData.append("attachments", new File(["zip"], "archive.zip", {
        type: "application/zip",
      }), "archive.zip");
      formData.append("attachmentNames", "archive.zip");

      const response = await POST(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}`,
        {
          method: "POST",
          body: formData,
        },
      ));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toContain("不支持的附件类型");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns 400 when uploaded attachment count exceeds the server limit", async () => {
    const repoRoot = await createTempRepo();

    try {
      const formData = new FormData();
      formData.append("title", "附件数量过多");
      for (let index = 0; index < SPEC_ISSUE_MAX_ATTACHMENT_COUNT + 1; index += 1) {
        const filename = `需求-${index}.md`;
        formData.append("attachments", new File([`doc-${index}`], filename, {
          type: "text/markdown",
        }), filename);
        formData.append("attachmentNames", filename);
      }

      const response = await POST(new NextRequest(
        `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}`,
        {
          method: "POST",
          body: formData,
        },
      ));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toContain("最多上传");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns 400 when repoPath is invalid", async () => {
    const missingRepoRoot = path.join(tmpdir(), "routa-spec-route-missing");
    const response = await GET(new NextRequest(
      `http://localhost/api/spec/issues?repoPath=${encodeURIComponent(missingRepoRoot)}`,
    ));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("repoPath");
  });
});
