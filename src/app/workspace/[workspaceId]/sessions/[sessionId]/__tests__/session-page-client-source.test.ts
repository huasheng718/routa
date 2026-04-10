import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../session-page-client.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("session page repo selection restore", () => {
  it("restores and persists the chat repo selection for the workspace", () => {
    expect(source).toContain("loadRepoSelection(\"chat\", workspaceId)");
    expect(source).toContain("saveRepoSelection(\"chat\", workspaceId, repoSelection);");
    expect(source).toContain("ensureWorkspaceCodebase(workspaceId, repoSelection, codebases, fetchCodebases)");
  });
});
