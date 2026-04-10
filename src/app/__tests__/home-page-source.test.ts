import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../page.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("home page provider readiness", () => {
  it("treats available ACP providers as ready even without saved config", () => {
    expect(source).toContain("const hasAvailableProviderRuntime =");
    expect(source).toContain("acp.providers.some((provider) => provider.status === \"available\")");
    expect(source).toContain("const hasProviderReady = hasProviderConfig || hasAvailableProviderRuntime;");
    expect(source).toContain("(!hasProviderReady || preferredMode === null)");
  });
});
