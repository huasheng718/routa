import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../repo-picker.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("repo picker local project flow", () => {
  it("uses the platform dialog to choose a local folder instead of manual path entry", () => {
    expect(source).toContain("const handleBrowseLocalRepo = useCallback(async () => {");
    expect(source).toContain("plugin:dialog|open");
    expect(source).toContain("/api/system/pick-directory");
    expect(source).toContain("directory: true,");
    expect(source).toContain("{t.repoPicker.selectLocalFolder}");
  });
});
