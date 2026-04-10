import { describe, expect, it } from "vitest";

import { localizeSkillDefinition, normalizeSkillLocale } from "../skill-localization";

describe("skill localization", () => {
  it("normalizes zh locales to zh-CN", () => {
    expect(normalizeSkillLocale("zh")).toBe("zh-CN");
    expect(normalizeSkillLocale("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-CN");
  });

  it("localizes known skill descriptions for zh-CN", () => {
    const localized = localizeSkillDefinition({
      name: "agent-browser",
      description: "Browser automation CLI",
      shortDescription: "Browser automation",
      content: "body",
      source: "/tmp/agent-browser/SKILL.md",
    }, "zh-CN");

    expect(localized.description).toContain("浏览器自动化");
    expect(localized.shortDescription).toBe("浏览器自动化与网页联调");
  });

  it("leaves unknown skills unchanged", () => {
    const original = {
      name: "unknown-skill",
      description: "Original description",
      shortDescription: "Original short",
      content: "body",
      source: "/tmp/unknown-skill/SKILL.md",
    };

    expect(localizeSkillDefinition(original, "zh-CN")).toEqual(original);
  });
});
