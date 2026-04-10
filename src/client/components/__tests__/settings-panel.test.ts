import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadDefaultProviders,
  loadProviderConnections,
  resolveModelDisplayLabel,
  saveDefaultProviders,
  saveModelDefinitions,
  type DefaultProviderSettings,
} from "../settings-panel";

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("settings-panel default provider helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("returns empty object when nothing is stored", () => {
    expect(loadDefaultProviders()).toEqual({});
  });

  it("round-trips AgentModelConfig settings through localStorage", () => {
    const settings: DefaultProviderSettings = {
      ROUTA: { provider: "claude-code-sdk", model: "claude-opus-4-5" },
      CRAFTER: { provider: "claude-code-sdk", model: "claude-3-5-haiku-20241022" },
    };
    saveDefaultProviders(settings);
    expect(loadDefaultProviders()).toEqual(settings);
  });

  it("handles invalid JSON gracefully", () => {
    localStorage.setItem("routa.defaultProviders", "not-json");
    expect(loadDefaultProviders()).toEqual({});
  });

  it("normalises legacy string-only provider values on load", () => {
    // Simulate old format stored in localStorage (bare provider-id string)
    localStorage.setItem("routa.defaultProviders", JSON.stringify({ GATE: "gemini" }));
    const loaded = loadDefaultProviders();
    expect(loaded.GATE).toEqual({ provider: "gemini" });
    expect(loaded.ROUTA).toBeUndefined();
  });

  it("preserves partial AgentModelConfig settings", () => {
    saveDefaultProviders({ GATE: { provider: "gemini", model: "gemini-pro" } });
    const loaded = loadDefaultProviders();
    expect(loaded.GATE).toEqual({ provider: "gemini", model: "gemini-pro" });
    expect(loaded.ROUTA).toBeUndefined();
  });

  it("formats plain model names for display", () => {
    expect(resolveModelDisplayLabel("opencode/qwen3.6-plus-free")).toBe("qwen3.6-plus-free");
  });

  it("formats alias-backed model definitions for display", () => {
    saveModelDefinitions([{ alias: "fast-qwen", modelName: "opencode/qwen3.6-plus-free" }]);
    expect(resolveModelDisplayLabel("fast-qwen")).toBe("qwen3.6-plus-free");
  });

  it("promotes a single custom model alias over the legacy opencode default", () => {
    saveModelDefinitions([
      {
        alias: "kimi-k2.5",
        modelName: "kimi-k2.5",
        baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
        apiKey: "secret",
      },
    ]);
    saveDefaultProviders({
      ROUTA: { provider: "opencode", model: "opencode/qwen3.6-plus-free" },
      CRAFTER: { provider: "opencode", model: "opencode/qwen3.6-plus-free" },
      GATE: { provider: "opencode", model: "opencode/qwen3.6-plus-free" },
      DEVELOPER: { provider: "opencode", model: "opencode/qwen3.6-plus-free" },
    });
    localStorage.setItem("routa.providerConnections", JSON.stringify({
      opencode: { model: "opencode/qwen3.6-plus-free" },
    }));

    expect(loadDefaultProviders()).toEqual({
      ROUTA: { provider: "opencode", model: "kimi-k2.5" },
      CRAFTER: { provider: "opencode", model: "kimi-k2.5" },
      GATE: { provider: "opencode", model: "kimi-k2.5" },
      DEVELOPER: { provider: "opencode", model: "kimi-k2.5" },
    });
    expect(loadProviderConnections().opencode?.model).toBe("kimi-k2.5");
  });
});
