/**
 * Spec management API contract tests.
 *
 * Covers issue creation/listing and document/image/video attachments.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BASE_URL,
  api,
  assert,
  assertArrayField,
  assertHasField,
  assertMatchesOperationResponse,
  assertStatus,
  type TestResult,
} from "./helpers";

export async function testSpec(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const repoRoot = mkdtempSync(join(tmpdir(), "routa-contract-spec-"));
  let createdFilename = "";
  let firstAttachmentPath = "";

  try {
    results.push(
      await runTest("POST /api/spec/issues — create issue JSON", async () => {
        const { status, data } = await api("POST", "/api/spec/issues", {
          repoPath: repoRoot,
          title: "Contract Spec Issue",
          body: "Verify spec management contract.",
          severity: "high",
          area: "spec",
          tags: "contract,需求",
          reportedBy: "contract-test",
        });
        assertStatus(status, 201);
        assertMatchesOperationResponse("createSpecIssue", status, data);
        const d = data as Record<string, unknown>;
        assertHasField(d, "issue");
        const issue = d.issue as Record<string, unknown>;
        assert(
          issue.title === "Contract Spec Issue",
          "Issue title should match",
        );
        assert(issue.severity === "high", "Issue severity should match");
        assert(Array.isArray(issue.tags), "Issue tags should be normalized");
        assert(
          typeof issue.filename === "string",
          "Issue filename should be returned",
        );
        createdFilename = issue.filename as string;
      }),
    );

    results.push(
      await runTest("GET /api/spec/issues — list issues", async () => {
        const { status, data } = await api(
          "GET",
          `/api/spec/issues?repoPath=${encodeURIComponent(repoRoot)}&includeBody=false`,
        );
        assertStatus(status, 200);
        assertMatchesOperationResponse("listSpecIssues", status, data);
        const d = data as Record<string, unknown>;
        assertArrayField(d, "issues");
        const issues = d.issues as Array<Record<string, unknown>>;
        assert(
          issues.some((issue) => issue.filename === createdFilename),
          "Created issue should be listed",
        );
      }),
    );

    results.push(
      await runTest(
        "POST /api/spec/issues — upload document image video",
        async () => {
          const formData = new FormData();
          formData.append("repoPath", repoRoot);
          formData.append("title", "Contract Spec Attachments");
          formData.append("body", "Verify uploaded materials.");
          formData.append("severity", "medium");
          formData.append("area", "spec");
          formData.append("tags", "附件,素材");
          formData.append("reportedBy", "contract-test");
          formData.append(
            "attachments",
            new File(["doc"], "需求说明.docx", {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }),
            "需求说明.docx",
          );
          formData.append("attachmentNames", "需求说明.docx");
          formData.append(
            "attachments",
            new File(["image"], "流程图.png", { type: "image/png" }),
            "流程图.png",
          );
          formData.append("attachmentNames", "流程图.png");
          formData.append(
            "attachments",
            new File(["video"], "演示视频.mp4", { type: "video/mp4" }),
            "演示视频.mp4",
          );
          formData.append("attachmentNames", "演示视频.mp4");

          const response = await fetch(`${BASE_URL}/api/spec/issues`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();

          assertStatus(response.status, 201);
          assertMatchesOperationResponse(
            "createSpecIssue",
            response.status,
            data,
          );
          const rawIssue = (data as { issue?: unknown }).issue;
          if (!rawIssue || typeof rawIssue !== "object") {
            throw new Error("Issue should be returned");
          }
          const issue = rawIssue as Record<string, unknown>;
          const attachments = issue.attachments as Array<
            Record<string, unknown>
          >;
          assert(Array.isArray(attachments), "Attachments should be returned");
          assert(
            attachments.length === 3,
            "Should return all uploaded attachments",
          );
          assert(
            attachments.map((attachment) => attachment.category).join(",") ===
              "document,image,video",
            "Attachment categories should classify document, image, and video",
          );
          assert(
            typeof issue.body === "string" && issue.body.includes("## 附件"),
            "Issue body should include attachment section",
          );
          firstAttachmentPath = attachments[0].path as string;
        },
      ),
    );

    results.push(
      await runTest(
        "GET /api/spec/issues/assets — read attachment",
        async () => {
          if (!firstAttachmentPath)
            throw new Error("Depends on upload attachment test");
          const response = await fetch(
            `${BASE_URL}/api/spec/issues/assets?repoPath=${encodeURIComponent(repoRoot)}&path=${encodeURIComponent(firstAttachmentPath)}`,
          );
          assertStatus(response.status, 200);
          assert(
            response.headers
              .get("content-type")
              ?.includes(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ) === true,
            "Attachment content type should match uploaded document",
          );
          const body = await response.arrayBuffer();
          assert(body.byteLength > 0, "Attachment body should not be empty");
        },
      ),
    );

    return results;
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

async function runTest(
  name: string,
  fn: () => Promise<void>,
): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (err) {
    return {
      name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}
