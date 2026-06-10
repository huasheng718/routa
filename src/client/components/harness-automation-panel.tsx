"use client";
import { CodeViewer } from "@/client/components/codemirror/code-viewer";
import { HarnessSectionCard, HarnessSectionStateFrame } from "@/client/components/harness-section-card";
import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import type {
  HarnessAutomationDefinitionSummary,
  HarnessAutomationPendingSignal,
  HarnessAutomationRecentRun,
  HarnessAutomationResponse,
  HarnessAutomationRuntimeStatus,
} from "@/core/harness/automation-types";
import { useTranslation, type TranslationDictionary } from "@/i18n";

type AutomationTranslations = TranslationDictionary["harness"]["automation"];

type HarnessAutomationPanelProps = {
  data: HarnessAutomationResponse | null;
  loading: boolean;
  error: string | null;
  repoLabel: string;
  unsupportedMessage?: string | null;
  variant?: "full" | "compact";
  hideHeader?: boolean;
};

function statusBadgeClass(status: HarnessAutomationRuntimeStatus) {
  switch (status) {
    case "active":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "paused":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "pending":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "definition-only":
      return "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800";
    case "idle":
      return "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary";
    case "clear":
      return "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary";
  }
}

function severityBadgeClass(severity: HarnessAutomationPendingSignal["severity"]) {
  switch (severity) {
    case "high":
      return "border-red-300 bg-red-50 text-red-800";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "low":
      return "border-sky-300 bg-sky-50 text-sky-800";
  }
}

function formatStatus(status: HarnessAutomationRuntimeStatus, t: AutomationTranslations) {
  switch (status) {
    case "definition-only":
      return t.statusConfiguredOnly;
    case "active":
      return t.statusActive;
    case "paused":
      return t.statusPaused;
    case "pending":
      return t.statusPending;
    case "idle":
      return t.statusIdle;
    case "clear":
      return t.statusClear;
  }
}

function formatSeverity(value: HarnessAutomationPendingSignal["severity"], t: AutomationTranslations) {
  switch (value) {
    case "high":
      return t.severityHigh;
    case "medium":
      return t.severityMedium;
    case "low":
      return t.severityLow;
  }
}

function formatSourceType(value: HarnessAutomationDefinitionSummary["sourceType"], t: AutomationTranslations) {
  switch (value) {
    case "finding":
      return t.sourceFinding;
    case "schedule":
      return t.sourceSchedule;
    case "review-signal":
      return t.sourceReviewSignal;
    case "external-event":
      return t.sourceExternalEvent;
  }
}

function formatTargetType(value: HarnessAutomationDefinitionSummary["targetType"], t: AutomationTranslations) {
  switch (value) {
    case "specialist":
      return t.targetSpecialist;
    case "workflow":
      return t.targetWorkflow;
    case "background-task":
      return t.targetBackgroundTask;
  }
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-desktop-text-secondary">{label}</div>
      <div className="mt-1 break-all text-[13px] font-semibold text-desktop-text-primary">{value}</div>
    </div>
  );
}

function DefinitionTable({ definitions }: { definitions: HarnessAutomationDefinitionSummary[] }) {
  const { t } = useTranslation();
  const labels = t.harness.automation;

  return (
    <div className="overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80">
      <div className="border-b border-desktop-border/70 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{labels.configuredMechanisms}</div>
      </div>
      {definitions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-white/60">
              <tr className="text-[10px] uppercase tracking-[0.12em] text-desktop-text-secondary">
                <th className="px-4 py-2.5 font-semibold">{labels.mechanism}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.trigger}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.executionTarget}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.runtimeState}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.pending}</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((definition) => (
                <tr key={definition.id} className="border-t border-desktop-border/60 first:border-t-0">
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-desktop-text-primary">{definition.name}</div>
                      <div className="text-[10px] font-mono text-desktop-text-secondary">{definition.id}</div>
                      {definition.description ? (
                        <div className="max-w-[320px] text-[11px] text-desktop-text-secondary">{definition.description}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] text-desktop-text-secondary">
                        {formatSourceType(definition.sourceType, labels)}
                      </span>
                      <div className="max-w-[240px] text-[11px] text-desktop-text-primary">{definition.sourceLabel}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] text-desktop-text-secondary">
                        {formatTargetType(definition.targetType, labels)}
                      </span>
                      <div className="max-w-[260px] text-[11px] text-desktop-text-primary">{definition.targetLabel}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1.5">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] ${statusBadgeClass(definition.runtimeStatus)}`}>
                        {formatStatus(definition.runtimeStatus, labels)}
                      </span>
                      <div className="text-[11px] text-desktop-text-secondary">
                        {definition.runtimeBinding
                          ? formatTemplate(labels.bindingLabel, { binding: definition.runtimeBinding })
                          : labels.noRuntimeBinding}
                      </div>
                      {definition.nextRunAt ? <div className="text-[10px] text-desktop-text-secondary">{formatTemplate(labels.nextRunAt, { time: formatTimestamp(definition.nextRunAt) })}</div> : null}
                      {definition.lastRunAt ? <div className="text-[10px] text-desktop-text-secondary">{formatTemplate(labels.lastRunAt, { time: formatTimestamp(definition.lastRunAt) })}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-[11px] text-desktop-text-primary">{definition.pendingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-[11px] text-desktop-text-secondary">{labels.noConfiguredMechanisms}</div>
      )}
    </div>
  );
}

function PendingSignalsTable({ pendingSignals }: { pendingSignals: HarnessAutomationPendingSignal[] }) {
  const { t } = useTranslation();
  const labels = t.harness.automation;

  return (
    <div className="overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80">
      <div className="border-b border-desktop-border/70 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{labels.pendingCleanupCorrection}</div>
      </div>
      {pendingSignals.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-white/60">
              <tr className="text-[10px] uppercase tracking-[0.12em] text-desktop-text-secondary">
                <th className="px-4 py-2.5 font-semibold">{labels.signal}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.configuredMechanisms}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.severity}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.window}</th>
              </tr>
            </thead>
            <tbody>
              {pendingSignals.map((signal) => (
                <tr key={signal.id} className="border-t border-desktop-border/60 first:border-t-0">
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-desktop-text-primary">{signal.title}</div>
                      <div className="text-[11px] text-desktop-text-secondary">{signal.summary}</div>
                      {signal.relativePath ? <div className="font-mono text-[10px] text-desktop-text-secondary">{signal.relativePath}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-[11px] text-desktop-text-primary">{signal.automationName}</div>
                    <div className="text-[10px] font-mono text-desktop-text-secondary">{signal.signalType}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] ${severityBadgeClass(signal.severity)}`}>
                      {formatSeverity(signal.severity, labels)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-[11px] text-desktop-text-secondary">
                    {signal.deferUntilCron ?? labels.immediate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-[11px] text-desktop-text-secondary">{labels.noPendingSignals}</div>
      )}
    </div>
  );
}

function RecentRunsTable({ recentRuns }: { recentRuns: HarnessAutomationRecentRun[] }) {
  const { t } = useTranslation();
  const labels = t.harness.automation;

  return (
    <div className="overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80">
      <div className="border-b border-desktop-border/70 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{labels.recentExecutionState}</div>
      </div>
      {recentRuns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-white/60">
              <tr className="text-[10px] uppercase tracking-[0.12em] text-desktop-text-secondary">
                <th className="px-4 py-2.5 font-semibold">{labels.configuredMechanisms}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.status}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.lastRun}</th>
                <th className="px-4 py-2.5 font-semibold">{labels.nextRun}</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={`${run.automationId}:${run.runtimeBinding}`} className="border-t border-desktop-border/60 first:border-t-0">
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-desktop-text-primary">{run.automationName}</div>
                      <div className="text-[10px] font-mono text-desktop-text-secondary">{run.runtimeBinding}</div>
                      {run.cronExpr ? <div className="text-[10px] text-desktop-text-secondary">{run.cronExpr}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] ${statusBadgeClass(run.status)}`}>
                      {formatStatus(run.status, labels)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-[11px] text-desktop-text-secondary">{formatTimestamp(run.lastRunAt)}</td>
                  <td className="px-4 py-3 align-top text-[11px] text-desktop-text-secondary">{formatTimestamp(run.nextRunAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-[11px] text-desktop-text-secondary">{labels.noRuntimeRecords}</div>
      )}
    </div>
  );
}

export function HarnessAutomationPanel({
  data,
  loading,
  error,
  repoLabel,
  unsupportedMessage,
  variant = "full",
  hideHeader = false,
}: HarnessAutomationPanelProps) {
  const { t } = useTranslation();
  const labels = t.harness.automation;
  const dataTestId = variant === "compact" ? "automations-compact" : "automations-full";
  const showData = !loading && !error && !unsupportedMessage && Boolean(data);
  const visibleData = showData ? data : null;
  const showMissingContext = !loading && !error && !unsupportedMessage && !data;
  const definitions = data?.definitions ?? [];
  const pendingSignals = data?.pendingSignals ?? [];
  const recentRuns = data?.recentRuns ?? [];
  const warnings = data?.warnings ?? [];
  const summary = {
    definitions: definitions.length,
    pendingSignals: pendingSignals.length,
    recentRuns: recentRuns.length,
  };
  const configSummary = {
    sourceOfTruth: data?.configFile?.relativePath ?? labels.noCheckedInConfigFile,
    findingDriven: definitions.filter((definition) => definition.sourceType === "finding").length,
    scheduledRuns: definitions.filter((definition) => definition.sourceType === "schedule").length,
    runtimeBindings: definitions.filter((definition) => Boolean(definition.runtimeBinding)).length,
  };
  const repoContextLabel = repoLabel.trim() || labels.thisRepository;

  return (
    <HarnessSectionCard
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
      hideHeader={hideHeader}
      variant={variant}
      dataTestId={dataTestId}
    >
      {loading ? (
        <HarnessSectionStateFrame>
          {labels.loadingConfiguration}
        </HarnessSectionStateFrame>
      ) : null}

      {unsupportedMessage ? <HarnessUnsupportedState /> : null}

      {error && !unsupportedMessage ? (
        <HarnessSectionStateFrame tone="error">{error}</HarnessSectionStateFrame>
      ) : null}

      {showMissingContext ? (
        <HarnessSectionStateFrame>
          {labels.missingContext}
        </HarnessSectionStateFrame>
      ) : null}

      {visibleData ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80">
            <div className="border-b border-desktop-border/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{labels.configurationSurface}</div>
              <div className="mt-1 text-[12px] font-semibold text-desktop-text-primary">{labels.repoDefinedSourceOfTruth}</div>
              <div className="mt-1 text-[11px] leading-5 text-desktop-text-secondary">
                {formatTemplate(labels.configDescription, { repoLabel: repoContextLabel })}
              </div>
            </div>

            <div className="grid gap-2 border-b border-desktop-border/70 p-3 md:grid-cols-4">
              <SummaryStat label={labels.sourceOfTruth} value={configSummary.sourceOfTruth} />
              <SummaryStat label={labels.findingRules} value={configSummary.findingDriven} />
              <SummaryStat label={labels.scheduledRuns} value={configSummary.scheduledRuns} />
              <SummaryStat label={labels.runtimeBindings} value={configSummary.runtimeBindings} />
            </div>

            <div className="p-3">
              {visibleData.configFile ? (
                <CodeViewer
                  code={visibleData.configFile.source}
                  filename={visibleData.configFile.relativePath}
                  language="yaml"
                  maxHeight="320px"
                  showHeader={false}
                  wordWrap
                />
              ) : (
                <HarnessSectionStateFrame>
                  {labels.noConfigFileFound}
                </HarnessSectionStateFrame>
              )}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <SummaryStat label={labels.configuredRules} value={summary.definitions} />
            <SummaryStat label={labels.pendingSignals} value={summary.pendingSignals} />
            <SummaryStat label={labels.recentExecutions} value={summary.recentRuns} />
          </div>

          <DefinitionTable definitions={definitions} />
          <PendingSignalsTable pendingSignals={pendingSignals} />
          <RecentRunsTable recentRuns={recentRuns} />

          {warnings.length > 0 ? (
            <HarnessSectionStateFrame tone="warning">
              {warnings.join(" ")}
            </HarnessSectionStateFrame>
          ) : null}
        </div>
      ) : null}
    </HarnessSectionCard>
  );
}
