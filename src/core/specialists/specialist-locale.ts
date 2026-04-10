export const DEFAULT_SPECIALIST_LOCALE = "en";
export const ZH_CN_SPECIALIST_LOCALE = "zh-CN";

export function normalizeSpecialistLocale(locale?: string | null): string {
  const trimmed = locale?.trim();
  if (!trimmed) return DEFAULT_SPECIALIST_LOCALE;

  const lower = trimmed.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) {
    return ZH_CN_SPECIALIST_LOCALE;
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return DEFAULT_SPECIALIST_LOCALE;
  }

  return trimmed;
}
