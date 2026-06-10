import type { Locale } from "@/i18n";

export type SpecialistLocale = "en" | "zh-CN";

export function mapLocaleToSpecialistLocale(locale: Locale): SpecialistLocale {
  return locale === "zh" ? "zh-CN" : "en";
}

export function buildSpecialistsApiPath(
  locale: Locale,
  params: Record<string, string | null | undefined> = {},
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  searchParams.set("locale", mapLocaleToSpecialistLocale(locale));
  return `/api/specialists?${searchParams.toString()}`;
}
