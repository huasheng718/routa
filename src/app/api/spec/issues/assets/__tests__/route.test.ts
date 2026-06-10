import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const system = {
  codebaseStore: {
    get: vi.fn(),
    listByWorkspace: vi.fn(),
  },
};

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => system,
}));

import { GET } from "../route";

async function createTempRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "routa-spec-assets-route-"));
  await mkdir(path.join(repoRoot, "docs", "issues", "assets", "issue-1"), { recursive: true });
  return repoRoot;
}

describe("/api/spec/issues/assets route", () => {
  it("serves an issue attachment from the selected repo", async () => {
    const repoRoot = await createTempRepo();

    try {
      await writeFile(path.join(repoRoot, "docs", "issues", "assets", "issue-1", "flow.png"), "image");

      const response = await GET(new NextRequest(
        `http://localhost/api/spec/issues/assets?repoPath=${encodeURIComponent(repoRoot)}&path=${encodeURIComponent("assets/issue-1/flow.png")}`,
      ));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("content-disposition")).toContain("flow.png");
      expect(body).toBe("image");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects paths outside docs/issues/assets", async () => {
    const repoRoot = await createTempRepo();

    try {
      const response = await GET(new NextRequest(
        `http://localhost/api/spec/issues/assets?repoPath=${encodeURIComponent(repoRoot)}&path=${encodeURIComponent("../secret.txt")}`,
      ));
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toContain("附件路径");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 for safe attachment paths that do not exist", async () => {
    const repoRoot = await createTempRepo();

    try {
      const response = await GET(new NextRequest(
        `http://localhost/api/spec/issues/assets?repoPath=${encodeURIComponent(repoRoot)}&path=${encodeURIComponent("assets/issue-1/missing.pdf")}`,
      ));
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.error).toContain("未找到附件");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
