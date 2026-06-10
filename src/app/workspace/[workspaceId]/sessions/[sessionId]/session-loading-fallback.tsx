"use client";

import { useTranslation } from "@/i18n";

export function SessionLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen items-center justify-center">
      {t.common.loading}
    </div>
  );
}
