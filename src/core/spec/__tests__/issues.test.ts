import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";

import {
  contentTypeForSpecIssueAttachment,
  createSpecIssue,
  listSpecIssues,
  normalizeSpecIssueAttachmentPath,
  parseSpecIssueFile,
  resolveSpecIssueAttachmentFile,
  SPEC_ISSUE_MAX_ATTACHMENT_COUNT,
  SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES,
  SpecIssueAttachmentsTotalTooLargeError,
  SpecIssueAttachmentTooManyError,
  SpecIssueAttachmentTooLargeError,
  SpecIssueAttachmentUnsupportedTypeError,
} from "../issues";

async function createTempRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "routa-spec-core-"));
  await mkdir(path.join(repoRoot, "docs", "issues"), { recursive: true });
  return repoRoot;
}

describe("spec issue core service", () => {
  it("parses frontmatter, normalizes metadata, and builds surface text", async () => {
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
github_issue: "410"
attachments:
  - filename: flow.png
    original_name: 流程图.png
    path: assets/2026-04-11-spec-board/flow.png
    mime_type: image/png
    size: 12
    category: image
---

# Spec board

Touches \`src/app/api/spec/issues/route.ts\` and \`/api/spec/issues\`.
`,
      );

      const issue = await parseSpecIssueFile(
        path.join(repoRoot, "docs", "issues"),
        "2026-04-11-spec-board.md",
        false,
      );

      expect(issue).toMatchObject({
        filename: "2026-04-11-spec-board.md",
        title: "Spec board",
        date: "2026-04-11",
        kind: "progress_note",
        status: "resolved",
        severity: "high",
        githubIssue: 410,
        body: "",
        bodyLoaded: false,
      });
      expect(issue?.attachments).toEqual([
        {
          filename: "flow.png",
          originalName: "流程图.png",
          path: "assets/2026-04-11-spec-board/flow.png",
          mimeType: "image/png",
          size: 12,
          category: "image",
        },
      ]);
      expect(issue?.surfaceText).toContain("src/app/api/spec/issues/route.ts");
      expect(issue?.surfaceText).toContain("/api/spec/issues");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("creates issue markdown and persists document, image, and video attachments", async () => {
    const repoRoot = await createTempRepo();

    try {
      const issue = await createSpecIssue(repoRoot, {
        title: "带附件的需求",
        body: "需要沉淀附件材料。",
        tags: "附件,素材",
        attachments: [
          new File(["document"], "需求说明.docx", {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          new File(["image"], "流程图.png", { type: "image/png" }),
          new File(["video"], "演示视频.mp4", { type: "video/mp4" }),
        ],
        attachmentNames: ["需求说明.docx", "流程图.png", "演示视频.mp4"],
      });

      expect(issue?.attachments.map((attachment) => attachment.category)).toEqual([
        "document",
        "image",
        "video",
      ]);
      expect(issue?.body).toContain("## 附件");
      expect(issue?.body).toContain("需求说明.docx");

      const issuePath = path.join(repoRoot, "docs", "issues", issue?.filename ?? "");
      const issueContent = await readFile(issuePath, "utf-8");
      expect(issueContent).toContain("attachments:");
      expect(issueContent).toContain("original_name: 需求说明.docx");
      expect(issueContent).toContain("mime_type: video/mp4");

      const listed = await listSpecIssues(repoRoot, { includeBody: false });
      expect(listed).toHaveLength(1);
      expect(listed[0]?.bodyLoaded).toBe(false);

      for (const attachment of issue?.attachments ?? []) {
        await expect(stat(path.join(repoRoot, "docs", "issues", attachment.path))).resolves.toBeTruthy();
      }
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("normalizes safe attachment paths and rejects traversal", () => {
    expect(normalizeSpecIssueAttachmentPath("assets/issue-1/flow.png")).toBe("assets/issue-1/flow.png");
    expect(normalizeSpecIssueAttachmentPath("assets\\issue-1\\flow.png")).toBe("assets/issue-1/flow.png");
    expect(normalizeSpecIssueAttachmentPath("../secret.txt")).toBeNull();
    expect(normalizeSpecIssueAttachmentPath("/assets/issue-1/flow.png")).toBeNull();
    expect(normalizeSpecIssueAttachmentPath("docs/issues/assets/flow.png")).toBeNull();
  });

  it("resolves attachment files only inside docs/issues/assets", () => {
    const repoRoot = path.join(tmpdir(), "routa-spec-core-paths");
    expect(resolveSpecIssueAttachmentFile(repoRoot, "assets/issue-1/flow.png")).toMatchObject({
      fileName: "flow.png",
      contentType: "image/png",
    });
    expect(resolveSpecIssueAttachmentFile(repoRoot, "assets/../secret.txt")).toBeNull();
  });

  it("maps common attachment content types", () => {
    expect(contentTypeForSpecIssueAttachment("flow.png")).toBe("image/png");
    expect(contentTypeForSpecIssueAttachment("recording.mp4")).toBe("video/mp4");
    expect(contentTypeForSpecIssueAttachment("brief.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(contentTypeForSpecIssueAttachment("archive.bin")).toBe("application/octet-stream");
  });

  it("rejects oversized attachments", async () => {
    const repoRoot = await createTempRepo();

    try {
      const oversized = {
        name: "large.mov",
        type: "video/quicktime",
        size: 50 * 1024 * 1024 + 1,
        arrayBuffer: async () => new ArrayBuffer(0),
      };

      await expect(createSpecIssue(repoRoot, {
        title: "Large attachment",
        attachments: [oversized],
      })).rejects.toBeInstanceOf(SpecIssueAttachmentTooLargeError);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsupported attachment types", async () => {
    const repoRoot = await createTempRepo();

    try {
      await expect(createSpecIssue(repoRoot, {
        title: "Unsupported attachment",
        attachments: [
          new File(["binary"], "archive.zip", { type: "application/zip" }),
        ],
      })).rejects.toBeInstanceOf(SpecIssueAttachmentUnsupportedTypeError);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects too many attachments", async () => {
    const repoRoot = await createTempRepo();

    try {
      await expect(createSpecIssue(repoRoot, {
        title: "Too many attachments",
        attachments: Array.from({ length: SPEC_ISSUE_MAX_ATTACHMENT_COUNT + 1 }, (_, index) => (
          new File([`doc-${index}`], `需求-${index}.md`, { type: "text/markdown" })
        )),
      })).rejects.toBeInstanceOf(SpecIssueAttachmentTooManyError);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects attachments over the total size limit before reading file buffers", async () => {
    const repoRoot = await createTempRepo();

    try {
      const largeFiles = Array.from({ length: 5 }, (_, index) => ({
        name: `recording-${index}.mp4`,
        type: "video/mp4",
        size: Math.floor(SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES / 5) + 1,
        arrayBuffer: async () => new ArrayBuffer(0),
      }));

      await expect(createSpecIssue(repoRoot, {
        title: "Total attachment size",
        attachments: largeFiles,
      })).rejects.toBeInstanceOf(SpecIssueAttachmentsTotalTooLargeError);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
