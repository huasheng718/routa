"use client";

import { useMemo } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { useTranslation } from "@/i18n";
import { normalizeSpecStatus, type SpecIssue } from "./spec-board-model";
import { CompactBadge } from "./spec-shared-components";
import {
  getKindLabel,
  getSeverityLabel,
  getStatusLabels,
  SEVERITY_ORDER,
  type Filters,
} from "./spec-page-helpers";

export function SpecToolbar({
  filters,
  filteredCount,
  totalCount,
  issues,
  surfaceWarnings,
  onFiltersChange,
  onCreateIssue,
}: {
  filters: Filters;
  filteredCount: number;
  totalCount: number;
  issues: SpecIssue[];
  surfaceWarnings: string[];
  onFiltersChange: (filters: Filters) => void;
  onCreateIssue: () => void;
}) {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const statuses = useMemo(
    () => [...new Set(issues.map((issue) => normalizeSpecStatus(issue.status)))],
    [issues],
  );
  const kinds = useMemo(
    () => [...new Set(issues.map((issue) => issue.kind).filter(Boolean))].sort(),
    [issues],
  );
  const severities = useMemo(
    () => [...new Set(issues.map((issue) => issue.severity).filter(Boolean))]
      .sort((a, b) => (SEVERITY_ORDER[a] ?? 99) - (SEVERITY_ORDER[b] ?? 99) || a.localeCompare(b)),
    [issues],
  );
  const areas = useMemo(
    () => [...new Set(issues.map((issue) => issue.area).filter(Boolean))].sort(),
    [issues],
  );

  const selectClassName =
    "h-8 rounded-md border border-black/8 bg-[#f8fafc] px-2.5 text-xs text-slate-700 outline-none transition-colors focus:border-slate-300 dark:border-white/10 dark:bg-[#111923] dark:text-slate-100 dark:focus:border-white/20";

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-black/6 bg-white/88 px-3 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#0f1722]/88 dark:shadow-none">
      <div className="mr-1 inline-flex items-center gap-1.5 rounded-md border border-black/8 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
        <ClipboardList className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.8} />
        <span>{t.specBoard.families}</span>
      </div>

      <select
        aria-label={t.specBoard.status}
        value={filters.status}
        onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
        className={selectClassName}
      >
        <option value="">{`${t.specBoard.status}: ${t.common.all}`}</option>
        {statuses.map((status) => (
          <option key={status} value={status}>{statusLabels[status]}</option>
        ))}
      </select>

      <select
        aria-label={t.specBoard.kind}
        value={filters.kind}
        onChange={(event) => onFiltersChange({ ...filters, kind: event.target.value })}
        className={selectClassName}
      >
        <option value="">{`${t.specBoard.kind}: ${t.common.all}`}</option>
        {kinds.map((kind) => (
          <option key={kind} value={kind}>{getKindLabel(kind, t)}</option>
        ))}
      </select>

      <select
        aria-label={t.specBoard.severity}
        value={filters.severity}
        onChange={(event) => onFiltersChange({ ...filters, severity: event.target.value })}
        className={selectClassName}
      >
        <option value="">{`${t.specBoard.severity}: ${t.common.all}`}</option>
        {severities.map((severity) => (
          <option key={severity} value={severity}>{getSeverityLabel(severity, t)}</option>
        ))}
      </select>

      <select
        aria-label={t.specBoard.area}
        value={filters.area}
        onChange={(event) => onFiltersChange({ ...filters, area: event.target.value })}
        className={selectClassName}
      >
        <option value="">{`${t.specBoard.area}: ${t.common.all}`}</option>
        {areas.map((area) => (
          <option key={area} value={area}>{area}</option>
        ))}
      </select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateIssue}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-950 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:border-white/10 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span>{t.specBoard.createIssue}</span>
        </button>

        {surfaceWarnings.length > 0 ? (
          <CompactBadge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            {t.specBoard.surfaceMapUnavailable}
          </CompactBadge>
        ) : null}

        <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/8 dark:text-slate-200">
          {filteredCount} / {totalCount}
        </CompactBadge>
      </div>
    </section>
  );
}
