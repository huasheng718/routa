"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  normalizeSpecStatus,
  type IssueFamily,
  type IssueRelations,
  type SpecIssue,
} from "./spec-board-model";
import { CompactBadge } from "./spec-shared-components";
import {
  formatTemplate,
  getSeverityLabel,
  getStatusLabels,
  STATUS_THEMES,
} from "./spec-page-helpers";

type IssueAreaGroup = {
  id: string;
  label: string;
  issueCount: number;
  unresolvedCount: number;
  families: IssueFamily[];
};

function pickLeadIssue(family: IssueFamily): SpecIssue {
  return family.issues.find((issue) => {
    const status = normalizeSpecStatus(issue.status);
    return status === "open" || status === "investigating";
  }) ?? family.issues[0] as SpecIssue;
}

function getCompletionStats(totalCount: number, unresolvedCount: number) {
  const resolvedCount = Math.max(0, totalCount - unresolvedCount);
  const ratio = totalCount > 0 ? resolvedCount / totalCount : 0;
  return {
    resolvedCount,
    unresolvedCount,
    totalCount,
    ratio,
    progressPercent: `${Math.round(ratio * 100)}%`,
  };
}

function getProgressBarClass(ratio: number) {
  if (ratio >= 1) {
    return "bg-emerald-500/20 dark:bg-emerald-400/20";
  }
  if (ratio >= 0.5) {
    return "bg-sky-500/18 dark:bg-sky-400/20";
  }
  if (ratio > 0) {
    return "bg-amber-500/18 dark:bg-amber-400/18";
  }
  return "bg-rose-500/14 dark:bg-rose-400/14";
}

function getAreaLabel(family: IssueFamily): string {
  return family.dominantAreas[0]
    ?? family.issues.find((issue) => issue.area.trim().length > 0)?.area
    ?? family.label;
}

function getClusterLabel(family: IssueFamily): string {
  const leadIssue = pickLeadIssue(family);
  return leadIssue.title || leadIssue.filename || family.label;
}

export function SpecFamilyExplorer({
  families,
  relationsByFilename,
  selectedIssue,
  selectedIssueFilenames,
  onSelectIssue,
  onToggleIssueSelection,
}: {
  families: IssueFamily[];
  relationsByFilename: Map<string, IssueRelations>;
  selectedIssue: SpecIssue | null;
  selectedIssueFilenames: Set<string>;
  onSelectIssue: (issue: SpecIssue) => void;
  onToggleIssueSelection: (issue: SpecIssue) => void;
}) {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const [expandedAreaIds, setExpandedAreaIds] = useState<Set<string>>(
    () => new Set(families.slice(0, 4).map((family) => getAreaLabel(family))),
  );
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(
    () => new Set(families.slice(0, 3).map((family) => family.id)),
  );
  const [collapsedSelectedAreaIds, setCollapsedSelectedAreaIds] = useState<Set<string>>(() => new Set());
  const [collapsedSelectedClusterIds, setCollapsedSelectedClusterIds] = useState<Set<string>>(() => new Set());

  const selectedFamilyId = selectedIssue
    ? (relationsByFilename.get(selectedIssue.filename)?.familyId ?? selectedIssue.filename)
    : null;
  const selectedAreaId = selectedFamilyId
    ? getAreaLabel(families.find((family) => family.id === selectedFamilyId) ?? {
      id: "",
      label: "",
      issues: selectedIssue ? [selectedIssue] : [],
      unresolvedCount: 0,
      relationCount: 0,
      surfaces: [],
      dominantAreas: selectedIssue?.area ? [selectedIssue.area] : [],
    } satisfies IssueFamily)
    : null;

  const areaGroups = useMemo((): IssueAreaGroup[] => {
    const grouped = new Map<string, IssueAreaGroup>();

    for (const family of families) {
      const areaLabel = getAreaLabel(family);
      const existing = grouped.get(areaLabel);
      if (existing) {
        existing.issueCount += family.issues.length;
        existing.unresolvedCount += family.unresolvedCount;
        existing.families.push(family);
        continue;
      }

      grouped.set(areaLabel, {
        id: areaLabel,
        label: areaLabel,
        issueCount: family.issues.length,
        unresolvedCount: family.unresolvedCount,
        families: [family],
      });
    }

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        families: [...group.families].sort((a, b) => {
          const unresolvedDiff = b.unresolvedCount - a.unresolvedCount;
          if (unresolvedDiff !== 0) {
            return unresolvedDiff;
          }
          const relationDiff = b.relationCount - a.relationCount;
          if (relationDiff !== 0) {
            return relationDiff;
          }
          return getClusterLabel(a).localeCompare(getClusterLabel(b));
        }),
      }))
      .sort((a, b) => {
        const unresolvedDiff = b.unresolvedCount - a.unresolvedCount;
        if (unresolvedDiff !== 0) {
          return unresolvedDiff;
        }
        const sizeDiff = b.issueCount - a.issueCount;
        if (sizeDiff !== 0) {
          return sizeDiff;
        }
        return a.label.localeCompare(b.label);
      });
  }, [families]);

  const toggleArea = useCallback((areaId: string, isExpanded: boolean, isSelectedArea: boolean) => {
    setExpandedAreaIds((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
    if (isSelectedArea) {
      setCollapsedSelectedAreaIds((current) => {
        const next = new Set(current);
        if (isExpanded) {
          next.add(areaId);
        } else {
          next.delete(areaId);
        }
        return next;
      });
    }
  }, []);

  const toggleCluster = useCallback((familyId: string, isExpanded: boolean, isSelectedFamily: boolean) => {
    setExpandedClusterIds((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(familyId);
      } else {
        next.add(familyId);
      }
      return next;
    });
    if (isSelectedFamily) {
      setCollapsedSelectedClusterIds((current) => {
        const next = new Set(current);
        if (isExpanded) {
          next.add(familyId);
        } else {
          next.delete(familyId);
        }
        return next;
      });
    }
  }, []);

  return (
    <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-black/6 bg-white/84 dark:border-white/10 dark:bg-[#0f1722]/84">
      <div className="border-b border-black/6 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400">
        {t.specBoard.families}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2.5">
        {areaGroups.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-black/8 bg-white/60 px-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            {t.specBoard.noIssues}
          </div>
        ) : null}

        <div className="space-y-1.5">
          {areaGroups.map((area) => {
            const isSelectedArea = selectedAreaId === area.id;
            const isAreaExpanded = expandedAreaIds.has(area.id)
              || (isSelectedArea && !collapsedSelectedAreaIds.has(area.id));
            const areaProgress = getCompletionStats(area.issueCount, area.unresolvedCount);
            return (
              <section key={area.id} className="rounded-lg border border-black/6 bg-[#f8fafc] dark:border-white/10 dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => toggleArea(area.id, isAreaExpanded, isSelectedArea)}
                  className="relative flex w-full items-center gap-2 overflow-hidden px-2.5 py-2 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 rounded-r-full ${getProgressBarClass(areaProgress.ratio)}`}
                    style={{ width: areaProgress.progressPercent }}
                  />
                  {isAreaExpanded ? (
                    <ChevronDown className="relative z-10 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
                  ) : (
                    <ChevronRight className="relative z-10 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
                  )}
                  <span className="relative z-10 min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-900 dark:text-slate-50">
                    {area.label}
                  </span>
                  <div className="relative z-10 flex shrink-0 items-center gap-1">
                    <CompactBadge className="bg-white/85 text-slate-700 dark:bg-black/20 dark:text-slate-100">
                      {areaProgress.resolvedCount}/{areaProgress.totalCount}
                    </CompactBadge>
                    <CompactBadge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                      {areaProgress.unresolvedCount}
                    </CompactBadge>
                  </div>
                </button>

                {isAreaExpanded ? (
                  <div className="mx-2.5 mb-2.5 border-l border-black/8 pl-2.5 dark:border-white/10">
                    <div className="space-y-1">
                      {area.families.map((family) => {
                        const leadIssue = pickLeadIssue(family);
                        const clusterLabel = getClusterLabel(family);
                        const isSelectedFamily = selectedFamilyId === family.id;
                        const isClusterExpanded = expandedClusterIds.has(family.id)
                          || (isSelectedFamily && !collapsedSelectedClusterIds.has(family.id));

                        return (
                          <div key={family.id} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                const shouldSelectLead = !isClusterExpanded || !isSelectedFamily;
                                toggleCluster(family.id, isClusterExpanded, isSelectedFamily);
                                if (shouldSelectLead) {
                                  onSelectIssue(leadIssue);
                                }
                              }}
                              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${
                                isSelectedFamily
                                  ? "bg-slate-100 text-slate-950 dark:bg-white/[0.08] dark:text-slate-50"
                                  : "hover:bg-white/70 dark:hover:bg-white/[0.04]"
                              }`}
                            >
                              {isClusterExpanded ? (
                                <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" strokeWidth={1.8} />
                              ) : (
                                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" strokeWidth={1.8} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-medium text-slate-900 dark:text-slate-50">
                                  {clusterLabel}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <CompactBadge className="bg-black/[0.04] text-slate-500 dark:bg-white/6 dark:text-slate-300">
                                    {family.issues.length} {t.specBoard.members}
                                  </CompactBadge>
                                  <CompactBadge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                                    {family.unresolvedCount}
                                  </CompactBadge>
                                  {family.relationCount > 0 ? (
                                    <CompactBadge className="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                                      {family.relationCount} {t.specBoard.relations}
                                    </CompactBadge>
                                  ) : null}
                                </div>
                              </div>
                            </button>

                            {isClusterExpanded ? (
                              <div className="ml-4 border-l border-black/8 pl-2 dark:border-white/10">
                                <div className="space-y-0.5">
                                  {family.issues.map((issue) => {
                                    const normalizedStatus = normalizeSpecStatus(issue.status);
                                    const isSelected = selectedIssue?.filename === issue.filename;
                                    const isMergeSelected = selectedIssueFilenames.has(issue.filename);
                                    const metaParts = [
                                      statusLabels[normalizedStatus],
                                      getSeverityLabel(issue.severity, t),
                                      issue.githubIssue != null ? `#${issue.githubIssue}` : null,
                                    ].filter(Boolean);

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
                                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${
                                          isSelected
                                            ? "bg-white text-slate-950 shadow-sm dark:bg-white/[0.06] dark:text-slate-50"
                                            : "hover:bg-white/70 dark:hover:bg-white/[0.03]"
                                        }`}
                                      >
                                        <label className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                                          <input
                                            type="checkbox"
                                            checked={isMergeSelected}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={() => onToggleIssueSelection(issue)}
                                            aria-label={formatTemplate(t.specBoard.mergeSelectIssueLabel, {
                                              title: issue.title || issue.filename,
                                            })}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-950 focus:ring-slate-400 dark:border-white/20 dark:bg-white/10"
                                          />
                                        </label>
                                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_THEMES[normalizedStatus].dot}`} />
                                        <div
                                          className="min-w-0 flex-1 text-left"
                                        >
                                          <div className="truncate text-[12px] text-slate-800 dark:text-slate-100">
                                            {issue.title || issue.filename}
                                          </div>
                                          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                            {metaParts.join(" · ")}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
