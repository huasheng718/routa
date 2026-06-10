"use client";

import { useState } from "react";

import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import { HarnessSectionCard, HarnessSectionStateFrame } from "@/client/components/harness-section-card";
import type {
  HooksResponse,
  ReleaseTriggerRuleSummary,
} from "@/client/hooks/use-harness-settings-data";
import { useTranslation, type TranslationDictionary } from "@/i18n";

type ReleaseTriggersCopy = TranslationDictionary["harness"]["releaseTriggers"];

type ReleaseTriggersPanel = {
  repoLabel: string;
  unsupportedMessage?: string | null;
  data?: HooksResponse | null;
  loading?: boolean;
  error?: string | null;
  variant?: "full" | "compact";
  hideHeader?: boolean;
};

type ReleaseDimensionTone = "danger" | "warning" | "info" | "success";

type ReleaseDimensionCard = {
  key: "exposure" | "drift" | "boundary" | "capability";
  title: string;
  value: string;
  subtitle: string;
  barValue: number;
  tone: ReleaseDimensionTone;
  rules: ReleaseTriggerRuleSummary[];
  compactRuleLimit?: number;
};

const TONE_STYLES: Record<
  ReleaseDimensionTone,
  {
    pill: string;
    bar: string;
    border: string;
    accent: string;
    tag: string;
    detailSurface: string;
  }
> = {
  danger: {
    pill: "border-rose-200 bg-rose-50 text-rose-700",
    bar: "bg-rose-500/85",
    border: "border-desktop-border",
    accent: "bg-rose-100/80",
    tag: "border-rose-200 bg-rose-50/70 text-rose-700",
    detailSurface: "border-rose-100/80 bg-desktop-bg-primary/85",
  },
  warning: {
    pill: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500/85",
    border: "border-desktop-border",
    accent: "bg-amber-100/85",
    tag: "border-amber-200 bg-amber-50/70 text-amber-800",
    detailSurface: "border-amber-100/80 bg-desktop-bg-primary/85",
  },
  info: {
    pill: "border-sky-200 bg-sky-50 text-sky-700",
    bar: "bg-sky-500/85",
    border: "border-desktop-border",
    accent: "bg-sky-100/85",
    tag: "border-sky-200 bg-sky-50/70 text-sky-700",
    detailSurface: "border-sky-100/80 bg-desktop-bg-primary/85",
  },
  success: {
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500/85",
    border: "border-desktop-border",
    accent: "bg-emerald-100/85",
    tag: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
    detailSurface: "border-emerald-100/80 bg-desktop-bg-primary/85",
  },
};

const ACTION_STYLES: Record<string, string> = {
  block_release: "border-rose-200 bg-rose-50 text-rose-700",
  require_human_review: "border-amber-200 bg-amber-50 text-amber-800",
  warn: "border-sky-200 bg-sky-50 text-sky-700",
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(value, max));
}

function formatTokenLabel(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template,
  );
}

function formatRuleCount(value: number, copy: ReleaseTriggersCopy): string {
  return formatTemplate(value === 1 ? copy.ruleCount : copy.rulesCount, { count: String(value) });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function scoreSeverity(severity: string): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function toneFromScore(score: number): ReleaseDimensionTone {
  if (score >= 0.75) return "danger";
  if (score >= 0.45) return "warning";
  return "info";
}

function isExposureRule(rule: ReleaseTriggerRuleSummary): boolean {
  return rule.type === "unexpected_file";
}

function isDriftRule(rule: ReleaseTriggerRuleSummary): boolean {
  return rule.type === "artifact_size_delta";
}

function isBoundaryRule(rule: ReleaseTriggerRuleSummary): boolean {
  return rule.type === "release_boundary_change";
}

function isCapabilityRule(rule: ReleaseTriggerRuleSummary): boolean {
  return rule.type === "capability_change";
}

function calculateDimensionScore(rules: ReleaseTriggerRuleSummary[], maxSeverity: number): number {
  return rules.length
    ? clamp(rules.reduce((sum, rule) => sum + scoreSeverity(rule.severity), 0) / (rules.length * maxSeverity))
    : 0;
}

function buildReleaseDimensionCards(rules: ReleaseTriggerRuleSummary[], copy: ReleaseTriggersCopy): ReleaseDimensionCard[] {
  const exposureRules = rules.filter(isExposureRule);
  const driftRules = rules.filter(isDriftRule);
  const boundaryRules = rules.filter(isBoundaryRule);
  const capabilityRules = rules.filter(isCapabilityRule);

  const exposureScore = calculateDimensionScore(exposureRules, 4);
  const driftScore = calculateDimensionScore(driftRules, 3);
  const boundaryScore = calculateDimensionScore(boundaryRules, 3);
  const capabilityScore = calculateDimensionScore(capabilityRules, 3);

  return [
    {
      key: "exposure",
      title: copy.layerExposureTitle,
      value: exposureRules.length ? formatRuleCount(exposureRules.length, copy) : copy.noRules,
      subtitle: exposureRules.length ? copy.layerExposureActive : copy.layerExposureEmpty,
      barValue: exposureScore,
      tone: exposureRules.length ? toneFromScore(exposureScore) : "info",
      rules: exposureRules,
    },
    {
      key: "drift",
      title: copy.layerArtifactDriftTitle,
      value: driftRules.length ? formatRuleCount(driftRules.length, copy) : copy.noRules,
      subtitle: driftRules.length ? copy.layerArtifactDriftActive : copy.layerArtifactDriftEmpty,
      barValue: driftScore,
      tone: driftRules.length ? toneFromScore(driftScore) : "info",
      rules: driftRules,
      compactRuleLimit: 2,
    },
    {
      key: "boundary",
      title: copy.layerBoundaryDriftTitle,
      value: boundaryRules.length ? formatRuleCount(boundaryRules.length, copy) : copy.noRules,
      subtitle: boundaryRules.length ? copy.layerBoundaryDriftActive : copy.layerBoundaryDriftEmpty,
      barValue: boundaryScore,
      tone: boundaryRules.length ? toneFromScore(boundaryScore) : "info",
      rules: boundaryRules,
    },
    {
      key: "capability",
      title: copy.layerCapabilityDriftTitle,
      value: capabilityRules.length ? formatRuleCount(capabilityRules.length, copy) : copy.noRules,
      subtitle: capabilityRules.length ? copy.layerCapabilityDriftActive : copy.layerCapabilityDriftEmpty,
      barValue: capabilityScore,
      tone: capabilityRules.length ? toneFromScore(capabilityScore) : "info",
      rules: capabilityRules,
    },
  ];
}

function formatActionLabel(action: string, copy: ReleaseTriggersCopy) {
  if (action === "block_release") return copy.actionBlockRelease;
  if (action === "require_human_review") return copy.actionRequireHumanReview;
  if (action === "warn") return copy.actionWarn;
  return formatTokenLabel(action);
}

function formatRuleTypeLabel(type: string, copy: ReleaseTriggersCopy) {
  if (type === "unexpected_file") return copy.typeUnexpectedFile;
  if (type === "artifact_size_delta") return copy.typeArtifactSizeDelta;
  if (type === "release_boundary_change") return copy.typeReleaseBoundaryChange;
  if (type === "capability_change") return copy.typeCapabilityChange;
  return formatTokenLabel(type);
}

function formatSeverityLabel(severity: string, copy: ReleaseTriggersCopy) {
  if (severity === "critical") return copy.severityCritical;
  if (severity === "high") return copy.severityHigh;
  if (severity === "medium") return copy.severityMedium;
  if (severity === "low") return copy.severityLow;
  if (severity === "info") return copy.severityInfo;
  return severity;
}

function ActionBadge({ action, copy }: { action: string; copy: ReleaseTriggersCopy }) {
  const style = ACTION_STYLES[action] ?? "border-desktop-border text-desktop-text-secondary";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${style}`}>
      {formatActionLabel(action, copy)}
    </span>
  );
}

function DetailLabel({ children }: { children: string }) {
  return (
    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">
      {children}
    </div>
  );
}

function CodeTokens({
  items,
  tone,
}: {
  items: string[];
  tone: ReleaseDimensionTone;
}) {
  if (!items.length) {
    return null;
  }

  const styles = TONE_STYLES[tone];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-md border px-2 py-1 font-mono text-[10px] leading-4 break-all ${styles.tag}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: ReleaseDimensionTone;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-2">
      <DetailLabel>{label}</DetailLabel>
      <CodeTokens items={items} tone={tone} />
    </div>
  );
}

function RuleDetailCard({
  rule,
  tone,
  copy,
}: {
  rule: ReleaseTriggerRuleSummary;
  tone: ReleaseDimensionTone;
  copy: ReleaseTriggersCopy;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={`rounded-sm border px-3 py-2.5 ${styles.detailSurface}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-desktop-text-primary">{formatTokenLabel(rule.name)}</div>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${styles.pill}`}>
            {formatSeverityLabel(rule.severity, copy)}
          </span>
          <span className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2 py-0.5 text-[9px] text-desktop-text-secondary">
            {formatRuleTypeLabel(rule.type, copy)}
          </span>
          <ActionBadge action={rule.action} copy={copy} />
        </div>
      </div>

      {rule.patterns.length > 0 && (
        <DetailGroup label={copy.detailPatterns} items={rule.patterns} tone={tone} />
      )}
      {rule.applyTo.length > 0 && (
        <DetailGroup label={copy.detailApplyTo} items={rule.applyTo} tone={tone} />
      )}
      {rule.paths.length > 0 && (
        <DetailGroup label={copy.detailWatchPaths} items={rule.paths} tone={tone} />
      )}
      {(rule.maxGrowthPercent !== null || rule.minGrowthBytes !== null || rule.baseline) && (
        <div className="mt-2">
          <DetailLabel>{copy.detailThresholds}</DetailLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {rule.maxGrowthPercent !== null && (
              <span className={`rounded-md border px-2 py-1 font-mono text-[10px] leading-4 ${styles.tag}`}>
                {formatTemplate(copy.thresholdMaxGrowth, { value: String(rule.maxGrowthPercent) })}
              </span>
            )}
            {rule.minGrowthBytes !== null && (
              <span className={`rounded-md border px-2 py-1 font-mono text-[10px] leading-4 ${styles.tag}`}>
                {formatTemplate(copy.thresholdMinGrowth, { value: formatBytes(rule.minGrowthBytes) })}
              </span>
            )}
            {rule.baseline && (
              <span className={`rounded-md border px-2 py-1 font-mono text-[10px] leading-4 ${styles.tag}`}>
                {formatTemplate(copy.thresholdBaseline, { value: rule.baseline })}
              </span>
            )}
          </div>
        </div>
      )}
      {rule.groupBy.length > 0 && (
        <DetailGroup label={copy.detailGroupBy} items={rule.groupBy} tone={tone} />
      )}
    </div>
  );
}

function DimensionCard({
  card,
  showDetails,
  copy,
}: {
  card: ReleaseDimensionCard;
  showDetails: boolean;
  copy: ReleaseTriggersCopy;
}) {
  const styles = TONE_STYLES[card.tone];
  const isDriftLayer = card.key === "drift";
  const [showAllDriftRules, setShowAllDriftRules] = useState(false);
  const driftLimit = card.compactRuleLimit ?? 0;
  const shouldCompactDrift = isDriftLayer && showDetails && card.rules.length > driftLimit && driftLimit > 0;
  const visibleRules = shouldCompactDrift && !showAllDriftRules ? card.rules.slice(0, driftLimit) : card.rules;

  return (
    <div className={`rounded-sm border p-3 ${styles.border} bg-desktop-bg-secondary/70`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">
            {card.title}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-desktop-text-primary">
            {card.value}
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-desktop-text-secondary">
            {card.subtitle}
          </div>
        </div>
      </div>

      <div className={`mt-2.5 h-1 w-full overflow-hidden rounded-sm ${styles.accent}`}>
        <div
          className={`h-full rounded-sm ${styles.bar} transition-all`}
          style={{ width: `${Math.round(card.barValue * 100)}%` }}
        />
      </div>

      {showDetails && card.rules.length > 0 && (
        <div className="mt-2.5 space-y-2">
          {visibleRules.map((rule) => (
            <RuleDetailCard key={rule.name} rule={rule} tone={card.tone} copy={copy} />
          ))}
        </div>
      )}

      {shouldCompactDrift && !showAllDriftRules ? (
        <div className="mt-2">
          <button
            type="button"
            className="rounded-sm border border-desktop-border bg-desktop-bg-primary/65 px-2.5 py-1 text-[10px] font-semibold text-desktop-text-primary"
            onClick={() => setShowAllDriftRules(true)}
          >
            {formatTemplate(copy.showAllRules, { count: String(card.rules.length) })}
          </button>
        </div>
      ) : null}

      {shouldCompactDrift && showAllDriftRules ? (
        <div className="mt-2">
          <button
            type="button"
            className="rounded-sm border border-desktop-border bg-desktop-bg-primary/65 px-2.5 py-1 text-[10px] font-semibold text-desktop-text-primary"
            onClick={() => setShowAllDriftRules(false)}
          >
            {copy.collapseToPreview}
          </button>
        </div>
      ) : null}

      {!showDetails && card.rules.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.rules.slice(0, 3).map((rule) => (
            <span
              key={rule.name}
              className={`rounded-md border px-2 py-1 font-mono text-[10px] leading-4 ${styles.tag}`}
            >
              {formatTokenLabel(rule.name)}
            </span>
          ))}
          {card.rules.length > 3 && (
            <span className="rounded-md border border-desktop-border px-2 py-1 text-[10px] text-desktop-text-secondary">
              {formatTemplate(copy.moreRules, { count: String(card.rules.length - 3) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function HarnessReleaseTriggersPanel({
  repoLabel: _repoLabel,
  unsupportedMessage,
  data,
  loading = false,
  error = null,
  variant = "full",
  hideHeader = false,
}: ReleaseTriggersPanel) {
  const { t } = useTranslation();
  const copy = t.harness.releaseTriggers;
  const releaseTriggerFile = data?.releaseTriggerFile ?? null;
  const showDetails = variant === "full";

  const cards = releaseTriggerFile
    ? buildReleaseDimensionCards(releaseTriggerFile.rules, copy)
    : [];

  return (
    <HarnessSectionCard
      title={copy.title}
      hideHeader={hideHeader}
      variant={variant}
    >
      {loading ? (
        <HarnessSectionStateFrame tone="warning">{copy.loadingPolicies}</HarnessSectionStateFrame>
      ) : null}

      {unsupportedMessage ? (
        <HarnessUnsupportedState className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-5 text-[11px] text-amber-800" />
      ) : null}

      {error && !unsupportedMessage ? (
        <HarnessSectionStateFrame tone="error">{error}</HarnessSectionStateFrame>
      ) : null}

      {!loading && !error && !unsupportedMessage && !releaseTriggerFile ? (
        <HarnessSectionStateFrame tone="warning">
          {copy.noYamlFile}
        </HarnessSectionStateFrame>
      ) : null}

      {!loading && !error && !unsupportedMessage && releaseTriggerFile && !releaseTriggerFile.rules.length ? (
        <HarnessSectionStateFrame tone="warning">
          {copy.yamlLoadedNoRules}
        </HarnessSectionStateFrame>
      ) : null}

      {!loading && !error && !unsupportedMessage && releaseTriggerFile && releaseTriggerFile.rules.length ? (
        <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <DimensionCard key={card.key} card={card} showDetails={showDetails} copy={copy} />
          ))}
        </div>
      ) : null}
    </HarnessSectionCard>
  );
}
