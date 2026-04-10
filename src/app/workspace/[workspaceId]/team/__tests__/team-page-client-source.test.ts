import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../team-page-client.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("team page locale wiring", () => {
  it("reads locale from i18n and forwards it to specialists API", () => {
    expect(source).toContain("const { t, locale } = useTranslation();");
    expect(source).toContain("const specialistLocale = normalizeSpecialistLocale(locale);");
    expect(source).toContain("desktopAwareFetch(`/api/specialists?locale=${encodeURIComponent(specialistLocale)}`");
  });
});
