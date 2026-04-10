import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
  default: {
    execFile: execFileMock,
  },
}));

import { POST } from "../route";

describe("/api/system/pick-directory POST", () => {
  const originalPlatform = process.platform;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
  });

  afterEach(() => {
    vi.stubGlobal("process", process);
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  });

  it("opens macOS folder picker in local Node runtime", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, "/Users/demo/project\n", "");
    });

    const request = new NextRequest("http://localhost/api/system/pick-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "选择本地项目文件夹",
        defaultPath: "/Users/demo",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledWith(
      "osascript",
      expect.arrayContaining([
        "-e",
        expect.stringContaining('choose folder with prompt "选择本地项目文件夹"'),
      ]),
      { timeout: 60_000 },
      expect.any(Function),
    );
    expect(data).toEqual({
      cancelled: false,
      path: "/Users/demo/project",
    });
  });

  it("returns cancelled when the picker is dismissed", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      const error = Object.assign(new Error("User canceled"), { code: 1, stderr: "User canceled" });
      callback(error, "", "User canceled");
    });

    const request = new NextRequest("http://localhost/api/system/pick-directory", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      cancelled: true,
      path: null,
    });
  });

  it("rejects the picker on serverless runtimes", async () => {
    process.env.VERCEL = "1";

    const request = new NextRequest("http://localhost/api/system/pick-directory", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(501);
    expect(execFileMock).not.toHaveBeenCalled();
    expect(data).toEqual({
      error: "Local directory picker is only available in local Node.js runtime.",
    });
  });
});
