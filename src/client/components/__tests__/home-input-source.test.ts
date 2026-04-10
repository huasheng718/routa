import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../home-input.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("home input ACP bootstrap", () => {
  it("connects ACP on editor focus instead of eager page mount", () => {
    expect(source).toContain("const ensureAcpConnected = useCallback(async () => {");
    expect(source).toContain("onEditorFocus={() => {");
    expect(source).toContain("void ensureAcpConnected();");
    expect(source).not.toContain("// Auto-connect ACP");
    expect(source).not.toContain("if (!acp.connected && !acp.loading) {\n      acp.connect();\n    }");
  });

  it("persists the chat repo selection so the session page can reuse it", () => {
    expect(source).toContain("loadRepoSelection(\"chat\", selectedWorkspaceId)");
    expect(source).toContain("saveRepoSelection(\"chat\", selectedWorkspaceId, repoSelection);");
    expect(source).toContain("ensureWorkspaceCodebase(selectedWorkspaceId, repoSelection, codebases, fetchCodebases)");
  });
});
