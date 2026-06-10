import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../use-task-runs.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("useTaskRuns fetch wiring", () => {
  it("uses resolveApiPath for desktop-aware task run loading", () => {
    expect(source).toContain("import { resolveApiPath } from \"@/client/config/backend\";");
    expect(source).toContain("desktopAwareFetch(resolveApiPath(`/tasks/${encodeURIComponent(taskId)}/runs`), {");
    expect(source).not.toContain("desktopAwareFetch(`/api/tasks/${encodeURIComponent(taskId)}/runs`");
  });
});
