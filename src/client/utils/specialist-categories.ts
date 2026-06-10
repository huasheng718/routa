"use client";

export type SpecialistCategory = "all" | "kanban" | "team" | "harness" | "custom";

export interface SpecialistCategoryOption {
  id: SpecialistCategory;
}

export const SPECIALIST_CATEGORY_OPTIONS: SpecialistCategoryOption[] = [
  { id: "kanban" },
  { id: "team" },
  { id: "harness" },
  { id: "custom" },
  { id: "all" },
];

const HARNESS_SPECIALIST_IDS = new Set([
  "agents-md-auditor",
  "evolution-architecture",
  "harness-build",
  "harness-test",
  "ui-journey-evaluator",
]);

export function getSpecialistCategory(id: string | undefined): Exclude<SpecialistCategory, "all"> {
  if (!id) return "custom";
  if (id.startsWith("kanban-")) return "kanban";
  if (id.startsWith("team-")) return "team";
  if (id.startsWith("harness-") || HARNESS_SPECIALIST_IDS.has(id)) return "harness";
  return "custom";
}

export function filterSpecialistsByCategory<T extends { id: string }>(
  specialists: T[],
  category: SpecialistCategory,
): T[] {
  if (category === "all") return specialists;
  return specialists.filter((specialist) => getSpecialistCategory(specialist.id) === category);
}
