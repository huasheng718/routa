"use client";

import type { TranslationDictionary } from "@/i18n";

export function formatKanbanRoleLabel(role: string | undefined | null, t: TranslationDictionary): string {
  const roleLabels = t.kanbanBgAgent;
  switch (role?.toUpperCase()) {
    case "DEVELOPER":
      return roleLabels?.roleDeveloper ?? "DEVELOPER";
    case "CRAFTER":
      return roleLabels?.roleCrafter ?? "CRAFTER";
    case "GATE":
      return roleLabels?.roleGate ?? "GATE";
    case "ROUTA":
      return roleLabels?.roleRouta ?? "ROUTA";
    default:
      return role ?? t.kanban?.unknownRole ?? t.common.unavailable;
  }
}
