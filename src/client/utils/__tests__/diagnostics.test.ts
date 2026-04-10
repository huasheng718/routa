import { afterEach, describe, expect, it, vi } from "vitest";

import { isTauriRuntime } from "../diagnostics";

describe("diagnostics runtime detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("does not treat plain http pages as Tauri only because of a persisted marker", () => {
    localStorage.setItem("routa.runtime", "tauri");
    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        search: "",
      },
    });

    expect(isTauriRuntime()).toBe(false);
  });

  it("treats pages with injected Tauri globals as Tauri", () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: { invoke: vi.fn() },
      location: {
        protocol: "http:",
        search: "",
      },
    });

    expect(isTauriRuntime()).toBe(true);
  });
});
