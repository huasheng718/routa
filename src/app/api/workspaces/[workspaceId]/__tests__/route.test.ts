import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workspace = {
  id: "ws-1",
  title: "Workspace",
  status: "active",
  metadata: {},
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const system = {
  workspaceStore: {
    get: vi.fn(),
    updateTitle: vi.fn(),
    updateMetadata: vi.fn(),
    delete: vi.fn(),
  },
  codebaseStore: {
    listByWorkspace: vi.fn(),
  },
};

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => system,
}));

import { PATCH } from "../route";

const params = { params: Promise.resolve({ workspaceId: "ws-1" }) };

describe("/api/workspaces/[workspaceId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    system.workspaceStore.get.mockResolvedValue(workspace);
    system.workspaceStore.updateTitle.mockResolvedValue(undefined);
    system.workspaceStore.updateMetadata.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid JSON patch requests", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/workspaces/ws-1", {
      method: "PATCH",
      body: "{",
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid JSON body");
    expect(system.workspaceStore.updateTitle).not.toHaveBeenCalled();
  });

  it("returns 400 for blank patch titles", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/workspaces/ws-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("title must be a non-empty string");
    expect(system.workspaceStore.updateTitle).not.toHaveBeenCalled();
  });

  it("trims patch titles before saving", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/workspaces/ws-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "  更新后的工作区  " }),
    }), params);

    expect(response.status).toBe(200);
    expect(system.workspaceStore.updateTitle).toHaveBeenCalledWith("ws-1", "更新后的工作区");
  });
});
