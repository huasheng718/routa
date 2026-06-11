import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const system = {
  workspaceStore: {
    list: vi.fn(),
    listByStatus: vi.fn(),
    save: vi.fn(),
  },
};

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => system,
}));

import { GET, POST } from "../route";

describe("/api/workspaces route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    system.workspaceStore.list.mockResolvedValue([]);
    system.workspaceStore.listByStatus.mockResolvedValue([]);
    system.workspaceStore.save.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid JSON create requests", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      body: "{",
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid JSON body");
    expect(system.workspaceStore.save).not.toHaveBeenCalled();
  });

  it("returns 400 for blank workspace titles", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ title: "   " }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("title is required");
    expect(system.workspaceStore.save).not.toHaveBeenCalled();
  });

  it("creates a workspace with a trimmed title", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ title: "  新需求工作区  " }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.workspace.title).toBe("新需求工作区");
    expect(system.workspaceStore.save).toHaveBeenCalledTimes(1);
  });

  it("lists workspaces by status when provided", async () => {
    await GET(new NextRequest("http://localhost/api/workspaces?status=active"));

    expect(system.workspaceStore.listByStatus).toHaveBeenCalledWith("active");
    expect(system.workspaceStore.list).not.toHaveBeenCalled();
  });
});
