import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureWorkspaceCodebase } from "../utils/workspace-codebases";

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

vi.mock("../utils/diagnostics", () => ({
  desktopAwareFetch,
}));

describe("ensureWorkspaceCodebase", () => {
  beforeEach(() => {
    desktopAwareFetch.mockReset();
  });

  it("skips persistence when the repo is already linked", async () => {
    await ensureWorkspaceCodebase(
      "ws-1",
      { name: "repo", path: "/tmp/repo", branch: "main" },
      [{ id: "cb-1", workspaceId: "ws-1", repoPath: "/tmp/repo", isDefault: true, createdAt: "", updatedAt: "" }],
    );

    expect(desktopAwareFetch).not.toHaveBeenCalled();
  });

  it("creates the codebase and refreshes the workspace list", async () => {
    const refreshCodebases = vi.fn(async () => {});
    desktopAwareFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    await ensureWorkspaceCodebase(
      "ws-1",
      { name: "repo", path: "/tmp/repo", branch: "main" },
      [],
      refreshCodebases,
    );

    expect(desktopAwareFetch).toHaveBeenCalledWith("/api/workspaces/ws-1/codebases", expect.objectContaining({
      method: "POST",
    }));
    expect(refreshCodebases).toHaveBeenCalledTimes(1);
  });
});
