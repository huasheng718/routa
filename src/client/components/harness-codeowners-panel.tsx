"use client";

import { HarnessSectionCard, HarnessSectionStateFrame } from "@/client/components/harness-section-card";
import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import { useTranslation, type TranslationDictionary } from "@/i18n";
import type { CodeownersResponse } from "@/core/harness/codeowners-types";

type HarnessCodeownersPanelProps = {
  repoLabel: string;
  unsupportedMessage?: string | null;
  data?: CodeownersResponse | null;
  loading?: boolean;
  error?: string | null;
  variant?: "full" | "compact";
  hideHeader?: boolean;
};

type CodeownersCopy = TranslationDictionary["harness"]["codeowners"];

function formatTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (formatted, [key, value]) => formatted.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatCodeownersWarning(warning: string, copy: CodeownersCopy) {
  if (warning.startsWith("No CODEOWNERS file found. Checked: ")) {
    return formatTemplate(copy.warningsCopy.noFileFound, {
      paths: warning.slice("No CODEOWNERS file found. Checked: ".length),
    });
  }
  if (warning === "Failed to list git-tracked files. Coverage analysis may be incomplete.") {
    return copy.warningsCopy.listTrackedFilesFailed;
  }
  const patternMatch = warning.match(/^Line (\d+): pattern without owners — "(.+)"$/u);
  if (patternMatch?.[1] && patternMatch[2]) {
    return formatTemplate(copy.warningsCopy.patternWithoutOwners, {
      line: patternMatch[1],
      pattern: patternMatch[2],
    });
  }
  return warning;
}

function formatHotspotReason(reason: string, copy: CodeownersCopy) {
  if (reason === "Trigger-covered paths have no explicit owner coverage.") {
    return copy.hotspotReasons.triggerCoverageMissing;
  }
  if (reason === "Trigger spans multiple owner groups and may need cross-team review routing.") {
    return copy.hotspotReasons.crossTeamReview;
  }
  if (reason === "Trigger touches overlapping ownership rules that should be shown explicitly.") {
    return copy.hotspotReasons.overlappingOwnership;
  }
  return reason;
}

function formatOwnerKind(kind: string, copy: CodeownersCopy) {
  switch (kind.toLowerCase()) {
    case "user":
      return copy.ownerKindUser;
    case "team":
      return copy.ownerKindTeam;
    case "other":
      return copy.ownerKindOther;
    default:
      return kind;
  }
}

function ListBlock({
  title,
  items,
  tone,
  rowLimit = 8,
}: {
  title: string;
  items: string[];
  tone: "neutral" | "amber" | "rose";
  rowLimit?: number;
}) {
  const border =
    tone === "rose"
      ? "border-rose-200 bg-rose-50/60"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/60"
        : "border-desktop-border bg-desktop-bg-primary/80";
  if (items.length === 0) {
    return null;
  }
  const visibleRows = `${Math.min(items.length, rowLimit) * 1.5}rem`;
  return (
    <div className={`rounded-sm border px-3 py-2 ${border}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-desktop-text-secondary">{title}</div>
      <ul
        className="mt-1.5 list-inside list-disc space-y-0.5 overflow-y-auto font-mono text-[11px] text-desktop-text-primary"
        style={{ maxHeight: visibleRows }}
      >
        {items.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    </div>
  );
}

function formatTriggerLabel(value: string): string {
  return value
    .split(/[_-]/u)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function HarnessCodeownersPanel({
  repoLabel: _repoLabel,
  unsupportedMessage,
  data,
  loading = false,
  error = null,
  variant = "full",
  hideHeader = false,
}: HarnessCodeownersPanelProps) {
  const { t } = useTranslation();
  const copy = t.harness.codeowners;
  const compactMode = variant === "compact";
  const rulesTableMaxHeight = compactMode ? "14rem" : "min(36rem, calc(100vh - 24rem))";
  const warnings = data?.warnings ?? [];
  const triggerCorrelations = data?.correlation?.triggerCorrelations ?? [];
  const hotspots = data?.correlation?.hotspots ?? [];
  const owners = data?.owners ?? [];
  const rules = data?.rules ?? [];
  const unownedFiles = data?.coverage?.unownedFiles ?? [];
  const overlappingFiles = data?.coverage?.overlappingFiles ?? [];
  const sensitiveUnownedFiles = data?.coverage?.sensitiveUnownedFiles ?? [];

  return (
    <HarnessSectionCard
      title={copy.title}
      hideHeader={hideHeader}
      variant={variant}
    >
      {loading ? (
        <HarnessSectionStateFrame tone="warning">{copy.loading}</HarnessSectionStateFrame>
      ) : null}

      {unsupportedMessage ? (
        <HarnessUnsupportedState className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-5 text-[11px] text-amber-800" />
      ) : null}

      {error && !unsupportedMessage ? (
        <HarnessSectionStateFrame tone="error">{error}</HarnessSectionStateFrame>
      ) : null}

      {!loading && !error && !unsupportedMessage && data ? (
        <div className="space-y-4">
          {warnings.length > 0 ? (
            <div className="rounded-sm border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
              <div className="font-semibold">{copy.warnings}</div>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {warnings.map((w) => (
                  <li key={w}>{formatCodeownersWarning(w, copy)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {triggerCorrelations.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-desktop-text-secondary">
                {copy.triggerCorrelation}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
                {triggerCorrelations.map((correlation) => (
                  <div
                    key={correlation.triggerName}
                    className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-3 py-2"
                  >
                    <div className="grid gap-1.5">
                      <span className="font-medium text-desktop-text-primary">
                        {formatTriggerLabel(correlation.triggerName)}
                      </span>
                      <div className="grid gap-1 text-[10px] text-desktop-text-secondary">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium text-desktop-text-primary">{copy.severity}</span>
                          <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2 py-0.5">
                            {correlation.severity}
                          </span>
                        </span>
                        <span>{formatTemplate(copy.filesCount, { count: correlation.touchedFileCount })}</span>
                        <span>{formatTemplate(copy.ownerGroupsCount, { count: correlation.ownerGroupCount })}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-desktop-text-secondary">
                      {correlation.hasOwnershipGap ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                          {copy.ownershipGap}
                        </span>
                      ) : null}
                      {correlation.spansMultipleOwnerGroups ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
                          {copy.crossOwner}
                        </span>
                      ) : null}
                    </div>
                    {correlation.ownerGroups.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {correlation.ownerGroups.map((owner) => (
                          <span
                            key={`${correlation.triggerName}-${owner}`}
                            className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2 py-0.5 text-[10px] text-desktop-text-primary"
                          >
                            {owner}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hotspots.length > 0 ? (
            <div className="rounded-sm border border-rose-200 bg-rose-50/60 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-800">{copy.governanceHotspots}</div>
              <ul className="mt-1.5 space-y-1 text-[11px] text-rose-900">
                {hotspots.map((hotspot) => (
                  <li key={`${hotspot.triggerName}-${hotspot.reason}`}>
                    <span className="font-medium">{formatTriggerLabel(hotspot.triggerName)}</span>
                    {": "}
                    {formatHotspotReason(hotspot.reason, copy)}
                    {hotspot.samplePaths.length ? ` (${hotspot.samplePaths.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {owners.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-desktop-text-secondary">{copy.ownerGroups}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {owners.map((o) => (
                  <div
                    key={o.name}
                    className="rounded-sm border border-desktop-border bg-desktop-bg-primary px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-medium text-desktop-text-primary">{o.name}</span>
                      <span className="rounded bg-desktop-bg-secondary px-1.5 py-0.5 text-[10px] text-desktop-text-secondary">{formatOwnerKind(o.kind, copy)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-desktop-text-secondary">{formatTemplate(copy.filesCount, { count: o.matchedFileCount })}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {rules.length > 0 ? (
            <div
              className="overflow-x-auto overflow-y-auto rounded-sm border border-desktop-border desktop-scrollbar-thin"
              style={{ maxHeight: rulesTableMaxHeight }}
            >
              <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-desktop-border bg-desktop-bg-secondary/60">
                    <th className="px-3 py-2 font-semibold text-desktop-text-secondary">{copy.pattern}</th>
                    <th className="px-3 py-2 font-semibold text-desktop-text-secondary">{copy.owners}</th>
                    <th className="px-3 py-2 font-semibold text-desktop-text-secondary">{copy.line}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={`${rule.line}-${rule.pattern}`} className="border-b border-desktop-border/80">
                      <td className="px-3 py-2 font-mono text-desktop-text-primary">{rule.pattern}</td>
                      <td className="px-3 py-2 text-desktop-text-primary">{rule.owners.join(", ")}</td>
                      <td className="px-3 py-2 text-desktop-text-secondary">{rule.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <ListBlock title={copy.unownedFilesSample} items={unownedFiles} tone="amber" rowLimit={compactMode ? 5 : 8} />
            <ListBlock
              title={copy.overlappingMatchesSample}
              items={overlappingFiles}
              tone="neutral"
              rowLimit={compactMode ? 5 : 8}
            />
          </div>
          <ListBlock
            title={copy.sensitivePathsWithoutOwnership}
            items={sensitiveUnownedFiles}
            tone="rose"
            rowLimit={compactMode ? 5 : 8}
          />
        </div>
      ) : null}
    </HarnessSectionCard>
  );
}
