"use client";

import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import type { TaskInfo } from "../types";

function resolveSourceRequirements(task: TaskInfo): NonNullable<TaskInfo["sourceRequirements"]> {
  const explicit = task.sourceRequirements ?? [];
  const explicitKeys = new Set(explicit.map((item) => item.path || item.filename));
  const inferred = (task.contextSearchSpec?.relatedFiles ?? [])
    .map((path) => path.trim())
    .filter((path) => path.startsWith("docs/issues/") && path.endsWith(".md"))
    .map((path) => ({
      path,
      filename: path.split("/").pop() ?? path,
    }))
    .filter((item) => !explicitKeys.has(item.path) && !explicitKeys.has(item.filename));

  return [...explicit, ...inferred];
}

export function KanbanSourceRequirements({
  task,
  compact,
}: {
  task: TaskInfo;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const sourceRequirements = useMemo(() => resolveSourceRequirements(task), [task]);
  if (sourceRequirements.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "space-y-1.5 border-b border-slate-200/80 py-1.5 dark:border-[#232736]" : "space-y-2 border-b border-slate-200/70 py-2 dark:border-[#232736]"}>
      <div className={compact ? "px-3" : "px-4"}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t.kanbanDetail.sourceRequirements}
        </div>
        {!compact ? (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.kanbanDetail.sourceRequirementsHint}
          </div>
        ) : null}
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? "px-3 py-1" : "px-4 py-1.5"}`}>
        {sourceRequirements.map((source) => (
          <span
            key={`${source.path}:${source.filename}`}
            className="inline-flex min-w-0 max-w-full items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
            title={`${t.kanbanDetail.sourceRequirementFile}: ${source.path}`}
          >
            <span className="truncate">{source.filename}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
