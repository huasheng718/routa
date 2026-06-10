import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeFitnessStatusResponse } from "@/core/fitness/runtime-status-types";
import { useRuntimeFitnessStatus } from "../use-runtime-fitness-status";

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

vi.mock("@/client/utils/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/client/utils/diagnostics")>("@/client/utils/diagnostics");
  return {
    ...actual,
    desktopAwareFetch,
  };
});

function okJson(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

function runtimeFitness(overrides: Partial<RuntimeFitnessStatusResponse> = {}): RuntimeFitnessStatusResponse {
  return {
    generatedAt: "2026-04-15T00:00:00.000Z",
    repoRoot: "/tmp/repo",
    hasRunning: false,
    latest: null,
    modes: [],
    ...overrides,
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useRuntimeFitnessStatus", () => {
  beforeEach(() => {
    desktopAwareFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches runtime fitness by codebaseId and exposes the payload", async () => {
    desktopAwareFetch.mockResolvedValue(okJson(runtimeFitness()));

    const { result } = renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      codebaseId: "codebase-1",
      isPageVisible: false,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data?.repoRoot).toBe("/tmp/repo");
    });

    expect(desktopAwareFetch).toHaveBeenCalledWith(
      "/api/fitness/runtime?codebaseId=codebase-1",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("falls back to the localized default error when the response has no details", async () => {
    desktopAwareFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      isPageVisible: false,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("加载 Runtime Fitness 状态失败");
    });
  });

  it("does not poll idle runtime fitness every five seconds", async () => {
    vi.useFakeTimers();
    desktopAwareFetch.mockResolvedValue(okJson(runtimeFitness()));

    const { result } = renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      codebaseId: "codebase-1",
      isPageVisible: true,
    }));

    await flushPromises();

    expect(result.current.data?.repoRoot).toBe("/tmp/repo");
    expect(desktopAwareFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(desktopAwareFetch).toHaveBeenCalledTimes(1);
  });

  it("polls every five seconds while runtime fitness is running", async () => {
    vi.useFakeTimers();
    const runningPayload = runtimeFitness({
      hasRunning: true,
      latest: {
        mode: "fast",
        currentStatus: "running",
        currentObservedAt: "2026-04-15T00:00:00.000Z",
        finalScore: null,
        hardGateBlocked: null,
        scoreBlocked: null,
        durationMs: null,
        dimensionCount: null,
        metricCount: null,
        artifactPath: null,
        lastCompleted: null,
      },
      modes: [{
        mode: "fast",
        currentStatus: "running",
        currentObservedAt: "2026-04-15T00:00:00.000Z",
        finalScore: null,
        hardGateBlocked: null,
        scoreBlocked: null,
        durationMs: null,
        dimensionCount: null,
        metricCount: null,
        artifactPath: null,
        lastCompleted: null,
      }],
    });
    desktopAwareFetch.mockResolvedValue(okJson(runningPayload));

    renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      codebaseId: "codebase-1",
      isPageVisible: true,
    }));

    await flushPromises();

    expect(desktopAwareFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await flushPromises();

    expect(desktopAwareFetch).toHaveBeenCalledTimes(2);
  });

  it("does not poll while the page is hidden", async () => {
    vi.useFakeTimers();
    desktopAwareFetch.mockResolvedValue(okJson(runtimeFitness()));

    renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      codebaseId: "codebase-1",
      isPageVisible: false,
    }));

    await flushPromises();

    expect(desktopAwareFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(desktopAwareFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous payload when only generatedAt changes", async () => {
    vi.useFakeTimers();
    desktopAwareFetch
      .mockResolvedValueOnce(okJson(runtimeFitness({ generatedAt: "2026-04-15T00:00:00.000Z" })))
      .mockResolvedValueOnce(okJson(runtimeFitness({ generatedAt: "2026-04-15T00:01:00.000Z" })));

    const { result } = renderHook(() => useRuntimeFitnessStatus({
      workspaceId: "workspace-1",
      codebaseId: "codebase-1",
      isPageVisible: true,
    }));

    await flushPromises();

    expect(result.current.data?.generatedAt).toBe("2026-04-15T00:00:00.000Z");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushPromises();

    expect(desktopAwareFetch).toHaveBeenCalledTimes(2);
    expect(result.current.data?.generatedAt).toBe("2026-04-15T00:00:00.000Z");
  });
});
