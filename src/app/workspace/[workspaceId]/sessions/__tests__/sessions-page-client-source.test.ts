import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../sessions-page-client.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("sessions page input defaults", () => {
  it("keeps ordinary sessions in single-agent mode", () => {
    expect(source).toContain('defaultAgentRole: "CRAFTER"');
    expect(source).toContain("allowRoleSwitch: false");
    expect(source).toContain("allowCustomSpecialist: false");
    expect(source).not.toContain('defaultAgentRole: "ROUTA"');
    expect(source).not.toContain("allowRoleSwitch: true");
    expect(source).not.toContain("allowCustomSpecialist: true");
  });
});
