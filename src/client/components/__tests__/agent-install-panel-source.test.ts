import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../agent-install-panel.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("agent install panel fallback", () => {
  it("falls back to web APIs when tauri invoke is unavailable", () => {
    expect(source).toContain("function isMissingTauriInvokeError");
    expect(source).toContain("isTauri.current = false;");
    expect(source).toContain("await fetchAgentsViaWeb(refresh);");
    expect(source).toContain("await desktopAwareFetch(\"/api/acp/install\"");
  });

  it("applies a timeout to web install requests", () => {
    expect(source).toContain("const INSTALL_REQUEST_TIMEOUT_MS = 120_000;");
    expect(source).toContain("const timeout = setTimeout(() => controller.abort(), INSTALL_REQUEST_TIMEOUT_MS);");
    expect(source).toContain("安装超时：下载或预热时间过长");
  });
});
