import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const system = {
  codebaseStore: {
    listByWorkspace: vi.fn(),
    findByRepoPath: vi.fn(),
    countByWorkspace: vi.fn(),
    add: vi.fn(),
  },
};

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => system,
}));

vi.mock("@/core/git", () => ({
  normalizeLocalRepoPath: (repoPath: string) => repoPath,
  validateRepoInput: vi.fn(() => ({ valid: true, isGitHub: false })),
  isBareGitRepository: vi.fn(() => false),
}));

import { POST } from "../route";

const params = { params: Promise.resolve({ workspaceId: "ws-1" }) };

describe("/api/workspaces/[workspaceId]/codebases route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    system.codebaseStore.findByRepoPath.mockResolvedValue(null);
    system.codebaseStore.countByWorkspace.mockResolvedValue(0);
    system.codebaseStore.add.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid JSON create requests", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces/ws-1/codebases", {
      method: "POST",
      body: "{",
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid JSON body");
    expect(system.codebaseStore.add).not.toHaveBeenCalled();
  });

  it("returns 400 when repoPath is missing", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces/ws-1/codebases", {
      method: "POST",
      body: JSON.stringify({ label: "Repo" }),
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("repoPath is required");
    expect(system.codebaseStore.add).not.toHaveBeenCalled();
  });

  it("creates a codebase for valid input", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces/ws-1/codebases", {
      method: "POST",
      body: JSON.stringify({ repoPath: "/repo", branch: "main", label: "Repo" }),
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.codebase).toMatchObject({
      workspaceId: "ws-1",
      repoPath: "/repo",
      branch: "main",
      label: "Repo",
      isDefault: true,
    });
    expect(system.codebaseStore.add).toHaveBeenCalledTimes(1);
  });
});
