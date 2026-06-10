"use client";

import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import {
  normalizeSpecStatus,
  STATUS_COLUMNS,
  type SpecIssue,
  type SpecStatus,
} from "./spec-board-model";
import { CompactBadge } from "./spec-shared-components";
import {
  formatTemplate,
  getKindLabel,
  getSeverityLabel,
  getStatusLabels,
  SEVERITY_STYLES,
  STATUS_THEMES,
} from "./spec-page-helpers";

export function SpecStatusBoard({
  issues,
  selectedIssue,
  selectedIssueFilenames,
  onSelectIssue,
  onToggleIssueSelection,
}: {
  issues: SpecIssue[];
  selectedIssue: SpecIssue | null;
  selectedIssueFilenames: Set<string>;
  onSelectIssue: (issue: SpecIssue) => void;
  onToggleIssueSelection: (issue: SpecIssue) => void;
}) {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const statusBuckets = useMemo(
    () => Object.fromEntries(
      STATUS_COLUMNS.map((status) => [
        status,
        issues.filter((issue) => normalizeSpecStatus(issue.status) === status),
      ]),
    ) as Record<SpecStatus, SpecIssue[]>,
    [issues],
  );

  return (
    <section
      aria-label={t.specBoard.status}
      className="rounded-2xl border border-black/6 bg-white/88 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#0f1722]/88 dark:shadow-none"
    >
      <div className="mb-3 flex items-center gap-2">
        <CompactBadge className="bg-black/[0.04] text-slate-700 dark:bg-white/8 dark:text-slate-100">
          {t.specBoard.status}
        </CompactBadge>
        <span className="text-xs text-slate-500 dark:text-slate-400">{issues.length}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_COLUMNS.map((status) => {
          const columnIssues = statusBuckets[status];
          const theme = STATUS_THEMES[status];

          return (
            <article
              key={status}
              className="min-h-[13rem] rounded-xl border border-black/6 bg-[#f8fafc] p-3 dark:border-white/10 dark:bg-[#0c121b]"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {statusLabels[status]}
                  </h3>
                </div>
                <CompactBadge className={theme.badge}>{columnIssues.length}</CompactBadge>
              </div>

              {columnIssues.length > 0 ? (
                <div className="space-y-2">
                  {columnIssues.map((issue) => {
                    const isSelected = selectedIssue?.filename === issue.filename;
                    const isMergeSelected = selectedIssueFilenames.has(issue.filename);

                    return (
                      <div
                        key={issue.filename}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectIssue(issue)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectIssue(issue);
                          }
                        }}
                        className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                          isSelected
                            ? theme.selected
                            : "border-black/8 bg-white/90 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        }`}
                      >
                        <label className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isMergeSelected}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => onToggleIssueSelection(issue)}
                            aria-label={formatTemplate(t.specBoard.mergeSelectIssueLabel, {
                              title: issue.title || issue.filename,
                            })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400 dark:border-white/20 dark:bg-white/10"
                          />
                        </label>

                        <div
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {issue.title}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <CompactBadge className={SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.medium}>
                              {getSeverityLabel(issue.severity, t)}
                            </CompactBadge>
                            {issue.area ? (
                              <CompactBadge className="border border-black/6 bg-[#f6f3ee] text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
                                {issue.area}
                              </CompactBadge>
                            ) : null}
                            {issue.kind ? (
                              <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/8 dark:text-slate-200">
                                {getKindLabel(issue.kind, t)}
                              </CompactBadge>
                            ) : null}
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {issue.date || issue.filename}
                          </div>

                          {issue.tags.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {issue.tags.map((tag) => (
                                <CompactBadge
                                  key={`${issue.filename}-${tag}`}
                                  className="border border-black/6 bg-[#f6f3ee] text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                                >
                                  {tag}
                                </CompactBadge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-black/8 px-3 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {t.specBoard.noIssues}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
