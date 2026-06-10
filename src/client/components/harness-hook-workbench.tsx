"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  ReactFlow,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { CodeViewer } from "@/client/components/codemirror/code-viewer";
import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import type { HooksResponse } from "@/client/hooks/use-harness-settings-data";
import { useTranslation, type TranslationDictionary } from "@/i18n";
import {
  buildHookFlow,
  buildHookWorkbenchEntries,
  buildRuntimeProfileSource,
  formatPhaseLabel,
  getDefaultWorkbenchHook,
  groupHookEntries,
  type HookFlowNodeSpec,
  type HookFlowNodeTone,
  type HookWorkbenchEntry,
} from "./harness-hook-workbench-model";

type InspectorTab = "basic" | "inputs" | "tasks" | "script";
type ScriptTab = "runtime" | "raw" | "review";

type HookWorkbenchProps = {
  data: HooksResponse;
  unsupportedMessage?: string | null;
  variant?: "full" | "compact";
  embedded?: boolean;
};

type HookWorkbenchCopy = TranslationDictionary["harness"]["hookWorkbench"];

type WorkbenchState = {
  contextKey: string;
  selectedHookName: string;
  inspectorTab: InspectorTab;
  scriptTab: ScriptTab;
};

type WorkbenchAction =
  | { type: "sync"; contextKey: string; hookNames: string[]; defaultHookName: string }
  | { type: "select-hook"; hookName: string }
  | { type: "select-tab"; tab: InspectorTab }
  | { type: "select-script-tab"; tab: ScriptTab };

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
  activeEntry: HookWorkbenchEntry | null;
  groupedEntries: ReturnType<typeof groupHookEntries>;
  data: HooksResponse;
  compactMode: boolean;
  embedded: boolean;
  copy: HookWorkbenchCopy;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

function toneStyles(tone: HookFlowNodeTone) {
  switch (tone) {
    case "success":
      return {
        border: "border-emerald-200",
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        glow: "",
        line: "#059669",
      };
    case "warning":
      return {
        border: "border-amber-200",
        badge: "border-amber-200 bg-amber-50 text-amber-800",
        glow: "",
        line: "#d97706",
      };
    case "danger":
      return {
        border: "border-red-200",
        badge: "border-red-200 bg-red-50 text-red-700",
        glow: "",
        line: "#dc2626",
      };
    case "accent":
      return {
        border: "border-sky-200",
        badge: "border-sky-200 bg-sky-50 text-sky-700",
        glow: "",
        line: "#0284c7",
      };
    default:
      return {
        border: "border-desktop-border",
        badge: "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary",
        glow: "",
        line: "#94a3b8",
      };
  }
}

function createInitialState(contextKey: string, defaultHookName: string): WorkbenchState {
  return {
    contextKey,
    selectedHookName: defaultHookName,
    inspectorTab: "basic",
    scriptTab: "runtime",
  };
}

function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "sync": {
      const selectedStillExists = action.hookNames.includes(state.selectedHookName);
      if (state.contextKey !== action.contextKey) {
        return createInitialState(action.contextKey, action.defaultHookName);
      }
      if (selectedStillExists) {
        return state;
      }
      return {
        ...state,
        selectedHookName: action.defaultHookName,
      };
    }
    case "select-hook":
      return {
        ...state,
        selectedHookName: action.hookName,
      };
    case "select-tab":
      return {
        ...state,
        inspectorTab: action.tab,
      };
    case "select-script-tab":
      return {
        ...state,
        scriptTab: action.tab,
      };
    default:
      return state;
  }
}

function useWorkbenchContext() {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error("HarnessHookWorkbench context is missing");
  }
  return context;
}

function formatStatusLabel(entry: HookWorkbenchEntry, copy: HookWorkbenchCopy) {
  return entry.enabled ? copy.enabled : entry.configured ? copy.partial : copy.missing;
}

function formatChannelLabel(entry: Pick<HookWorkbenchEntry, "channel">, copy: HookWorkbenchCopy) {
  return entry.channel === "remote" ? copy.remoteChannel : copy.localChannel;
}

function formatBlockingLabel(entry: Pick<HookWorkbenchEntry, "blocking">, copy: HookWorkbenchCopy) {
  return entry.blocking ? copy.blockingLabel : copy.notificationLabel;
}

function formatBypassabilityLabel(entry: Pick<HookWorkbenchEntry, "bypassability">, copy: HookWorkbenchCopy) {
  if (entry.bypassability === "bypassable") return copy.bypassable;
  if (entry.bypassability === "not-bypassable") return copy.notBypassable;
  return copy.notAvailable;
}

function formatCwdLabel(entry: Pick<HookWorkbenchEntry, "cwdMode">, copy: HookWorkbenchCopy) {
  return entry.cwdMode === "git-dir" ? copy.gitDir : copy.worktreeRoot;
}

function formatModeLabel(mode: HookWorkbenchEntry["mode"], copy: HookWorkbenchCopy) {
  if (mode === "runtime-profile") return copy.modeRuntimeProfile;
  if (mode === "shell-command") return copy.modeShellCommand;
  return copy.modeUnconfigured;
}

function formatHookSummary(entry: HookWorkbenchEntry, copy: HookWorkbenchCopy) {
  return [
    formatChannelLabel(entry, copy),
    formatBlockingLabel(entry, copy),
    formatBypassabilityLabel(entry, copy),
  ].join(" · ");
}

function formatHookLifecycleSummary(entry: HookWorkbenchEntry, copy: HookWorkbenchCopy) {
  return `${entry.lifecycleLabel} ${copy.lifecycleSuffix} · ${entry.hint}`;
}

function formatHookWarning(warning: string, copy: HookWorkbenchCopy) {
  if (warning === "Missing docs/fitness/runtime/hooks.yaml.") {
    return copy.warningMissingRuntimeHooks;
  }
  if (warning === 'No ".husky" directory found for this repository.') {
    return copy.warningMissingHuskyDirectory;
  }
  return warning;
}

function formatCountLabel(count: number, label: string) {
  return `${count} ${label}`;
}

function formatNodeKind(kind: string, copy: HookWorkbenchCopy) {
  if (kind === "hook") return copy.hook;
  if (kind === "task") return copy.tabTasks;
  if (kind === "result") return copy.output;
  return kind;
}

function formatFlowTitle(value: string, copy: HookWorkbenchCopy) {
  if (value === "No declared tasks") return copy.noDeclaredTasks;
  if (value === "Pass gate") return copy.passGate;
  if (value === "Emit signal") return copy.emitSignal;
  if (value === "Escalate review") return copy.escalateReview;
  if (value === "Block git action") return copy.blockGitAction;
  if (value === "Warn only") return copy.warnOnly;
  return value;
}

function formatFlowSubtitle(value: string | undefined, copy: HookWorkbenchCopy) {
  if (!value) return value;
  if (value === "Resolved from manifest") return copy.resolvedFromManifest;
  if (value === "Awaiting explicit command mapping") return copy.awaitingCommandMapping;
  if (value === "Git continues to the next lifecycle step.") return copy.gitContinues;
  if (value === "Signal is emitted after the hook completes.") return copy.signalEmitted;
  if (value === "Review trigger rules can escalate this run for manual inspection.") return copy.reviewEscalation;
  if (value === "Non-zero exit prevents the Git action from completing.") return copy.nonZeroBlocks;
  if (value === "Failure is recorded as a warning instead of a hard stop.") return copy.failureWarning;
  return value;
}

function formatFlowChip(value: string, copy: HookWorkbenchCopy) {
  if (value === "hard gate") return copy.hardGate;
  if (value === "resolved") return copy.resolved;
  if (value === "unresolved") return copy.unresolved;
  if (value === "continue") return copy.continueOnError;
  if (value === "gate") return copy.gate;
  if (value === "all") return copy.fileScopeAll;
  if (value === "staged") return copy.fileScopeStaged;
  if (value === "changed") return copy.fileScopeChanged;
  if (value.endsWith(" tasks")) {
    const count = value.replace(" tasks", "");
    return formatCountLabel(Number(count), copy.tasks);
  }
  if (value.endsWith(" phases")) {
    const count = value.replace(" phases", "");
    return formatCountLabel(Number(count), copy.phases);
  }
  if (value.endsWith(" hard gates")) {
    const count = value.replace(" hard gates", "");
    return formatCountLabel(Number(count), copy.hardGates);
  }
  return value;
}

type FlowNodeData = HookFlowNodeSpec;

function FlowNodeView({ data }: NodeProps<Node<FlowNodeData>>) {
  const { copy } = useWorkbenchContext();
  const tone = toneStyles(data.tone);
  const widthClass = data.kind === "hook" ? "w-[300px]" : data.kind === "task" ? "w-[284px]" : "w-[276px]";
  const heightClass = data.kind === "task" ? "min-h-[124px]" : "min-h-[132px]";
  return (
    <div className="relative">
      <Handle id="left" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <div className={`${widthClass} ${heightClass} rounded-sm border bg-desktop-bg-primary px-4 py-3 ${tone.border} ${tone.glow}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-desktop-text-secondary">{formatNodeKind(data.kind, copy)}</div>
        <div className="mt-1 text-[15px] font-semibold leading-6 text-desktop-text-primary">{formatFlowTitle(data.title, copy)}</div>
        {data.subtitle ? (
          <div className="mt-1 text-[12px] leading-5 text-desktop-text-secondary">{formatFlowSubtitle(data.subtitle, copy)}</div>
        ) : null}
        {data.chips?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.chips.map((chip) => (
              <span key={`${data.id}:${chip}`} className={`rounded-full border px-2 py-0.5 text-[10px] ${tone.badge}`}>
                {formatFlowChip(chip, copy)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const flowNodeTypes = {
  workbench: FlowNodeView,
};

function HookLifecycleRail() {
  const { activeEntry, copy, dispatch, groupedEntries } = useWorkbenchContext();

  return (
    <aside className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex items-center justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="text-[12px] font-semibold text-desktop-text-primary">{copy.hookMap}</div>
        <div className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-[10px] text-desktop-text-secondary">
          {formatCountLabel(groupedEntries.reduce((sum, group) => sum + group.entries.length, 0), copy.hook)}
        </div>
      </div>

      <div className="mt-3 space-y-4">
        {groupedEntries.map((group) => (
          <section key={group.group}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-desktop-text-primary">{group.label}</div>
                <div className="text-[10px] text-desktop-text-secondary">{group.description}</div>
              </div>
              <div className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2 py-0.5 text-[10px] text-desktop-text-secondary">
                {group.entries.length}
              </div>
            </div>

            <div className="mt-2.5 space-y-2">
              {group.entries.map((entry) => {
                const selected = activeEntry?.name === entry.name;
                const dimmed = !entry.enabled;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    disabled={dimmed}
                    onClick={() => {
                      if (dimmed) {
                        return;
                      }
                      dispatch({ type: "select-hook", hookName: entry.name });
                    }}
                    className={`w-full rounded-sm border px-3 py-3 text-left transition ${
                      dimmed
                        ? "cursor-not-allowed border-slate-200 bg-slate-50/90 text-slate-500 opacity-80"
                        : selected
                        ? "border-sky-300 bg-sky-50/80"
                        : "border-desktop-border bg-white/85 hover:bg-desktop-bg-primary"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-[12px] font-semibold ${dimmed ? "text-slate-500" : "text-desktop-text-primary"}`}>{entry.name}</div>
                        <div className={`mt-1 text-[10px] ${dimmed ? "text-slate-400" : "text-desktop-text-secondary"}`}>
                          {formatHookSummary(entry, copy)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                        entry.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}>
                        {formatStatusLabel(entry, copy)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-slate-200 bg-white text-slate-500" : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"}`}>
                        {formatCountLabel(entry.stats.taskCount, copy.tasks)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-slate-200 bg-white text-slate-500" : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"}`}>
                        {formatCountLabel(entry.phases.length, copy.phases)}
                      </span>
                      {entry.stats.reviewGate ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-slate-200 bg-white text-slate-500" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                          {copy.reviewGate}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function HookFlowCanvas() {
  const { activeEntry, compactMode, copy } = useWorkbenchContext();
  const flowHeight = compactMode ? 440 : 680;

  const flow = useMemo(() => {
    if (!activeEntry) {
      return { nodes: [], edges: [] };
    }

    const { nodes, edges } = buildHookFlow(activeEntry);
    const positionedNodes: Node[] = nodes.map((node) => ({
      id: node.id,
      type: "workbench",
      position: {
        x: node.column === 0 ? 24 : node.column === 1 ? 388 : 752,
        y: 24 + node.row * 154,
      },
      draggable: false,
      selectable: false,
      data: node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
    const positionedEdges = edges.map<Edge>((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.tone === "accent",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: toneStyles(edge.tone).line,
      },
      style: {
        stroke: toneStyles(edge.tone).line,
        strokeWidth: edge.tone === "accent" ? 1.8 : 1.5,
      },
    }));
    const maxNodeY = positionedNodes.reduce((max, node) => Math.max(max, node.position.y), 0);
    if (maxNodeY < flowHeight - 220) {
      positionedNodes.push({
        id: `viewport-anchor:${activeEntry.name}`,
        position: { x: 520, y: flowHeight - 120 },
        data: { label: "" },
        draggable: false,
        selectable: false,
        connectable: false,
        style: {
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        },
      });
    }

    return { nodes: positionedNodes, edges: positionedEdges };
  }, [activeEntry, flowHeight]);

  return (
    <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-desktop-text-primary">{copy.hookTaskOutput}</div>
          <div className="mt-1 text-[11px] text-desktop-text-secondary">
            {activeEntry
              ? formatHookLifecycleSummary(activeEntry, copy)
              : copy.selectHookToInspect}
          </div>
        </div>
        {activeEntry ? (
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatChannelLabel(activeEntry, copy)}
            </span>
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatCountLabel(activeEntry.stats.taskCount, copy.tasks)}
            </span>
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatCountLabel(activeEntry.stats.hardGateCount, copy.hardGates)}
            </span>
          </div>
        ) : null}
      </div>

      {activeEntry ? (
        <div className="mt-4 overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80" style={{ height: flowHeight }}>
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={flowNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.14 }}
            minZoom={0.6}
            maxZoom={1.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll={false}
          >
            <Background color="#dbe4f0" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      ) : (
        <div className="mt-4 rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-8 text-[12px] text-desktop-text-secondary">
          {copy.noHookSelected}
        </div>
      )}
    </section>
  );
}

function HookInspector() {
  const { activeEntry, copy, data, dispatch, state } = useWorkbenchContext();

  const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: "basic", label: copy.tabBasic },
    { id: "inputs", label: copy.tabInputs },
    { id: "tasks", label: copy.tabTasks },
    { id: "script", label: copy.tabSource },
  ];

  const previewSource = useMemo(() => {
    if (!activeEntry) {
      return { code: "", language: "text" as const };
    }
    if (state.scriptTab === "raw") {
      return {
        code: activeEntry.hookFile?.source ?? copy.noRawHookFileFound,
        language: "shell" as const,
      };
    }
    if (state.scriptTab === "review") {
      return {
        code: data.reviewTriggerFile?.source ?? copy.noReviewTriggerFileFound,
        language: "yaml" as const,
      };
    }
    return {
      code: buildRuntimeProfileSource(activeEntry) || copy.noRuntimeProfileBound,
      language: "yaml" as const,
    };
  }, [activeEntry, copy.noRawHookFileFound, copy.noReviewTriggerFileFound, copy.noRuntimeProfileBound, data.reviewTriggerFile?.source, state.scriptTab]);

  if (!activeEntry) {
    return (
      <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-3">
        <div className="border-b border-desktop-border pb-2 text-[12px] font-semibold text-desktop-text-primary">{copy.inspector}</div>
        <div className="mt-3 rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-6 text-[12px] text-desktop-text-secondary">
          {copy.selectHookToInspect}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-3">
      <div className="flex items-start justify-between gap-3 border-b border-desktop-border pb-2">
        <div>
          <h3 className="text-[12px] font-semibold text-desktop-text-primary">{activeEntry.name}</h3>
          <div className="mt-1 text-[11px] text-desktop-text-secondary">
            {formatHookSummary(activeEntry, copy)}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${
          activeEntry.enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary"
        }`}>
          {formatModeLabel(activeEntry.mode, copy)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              dispatch({ type: "select-tab", tab: tab.id });
            }}
            className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
              state.inspectorTab === tab.id
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {state.inspectorTab === "basic" ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [copy.labelLifecycle, activeEntry.lifecycleDescription],
              [copy.labelRunSide, formatChannelLabel(activeEntry, copy)],
              [copy.labelBlocking, formatBlockingLabel(activeEntry, copy)],
              [copy.labelCwd, formatCwdLabel(activeEntry, copy)],
              [copy.labelBypass, formatBypassabilityLabel(activeEntry, copy)],
              [copy.labelSourcePath, activeEntry.hookFile?.relativePath ?? copy.noHookFile],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{label}</div>
                <div className="mt-1 text-[12px] leading-5 text-desktop-text-primary">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{copy.command}</div>
            <div className="mt-1 break-all font-mono text-[11px] text-desktop-text-primary">
              {activeEntry.hookFile?.triggerCommand ?? copy.noCommandDetected}
            </div>
            <div className="mt-2 text-[11px] text-desktop-text-secondary">
              {activeEntry.hint}
            </div>
          </div>
          {activeEntry.phases.length ? (
            <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{copy.runtimePhases}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeEntry.phases.map((phase) => (
                  <span key={phase} className={`rounded-full border px-2.5 py-1 text-[10px] ${
                    phase === "review"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary"
                  }`}>
                    {formatPhaseLabel(phase)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.inspectorTab === "inputs" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{copy.argvTemplate}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeEntry.argvTemplate.length ? activeEntry.argvTemplate.map((value) => (
                <span key={value} className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] font-mono text-desktop-text-secondary">
                  {value}
                </span>
              )) : (
                <span className="text-[11px] text-desktop-text-secondary">{copy.noArgvPayload}</span>
              )}
            </div>
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{copy.stdinTemplate}</div>
            <div className="mt-1 font-mono text-[11px] text-desktop-text-primary">
              {activeEntry.stdinTemplate ?? copy.noStdinPayload}
            </div>
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{copy.environment}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeEntry.envKeys.map((key) => (
                <span key={key} className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] font-mono text-desktop-text-secondary">
                  {key}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {state.inspectorTab === "tasks" ? (
        <div className="mt-4 space-y-3">
          {activeEntry.tasks.length ? activeEntry.tasks.map((task) => (
            <div key={task.id} className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-desktop-text-primary">{task.name}</div>
                  {task.command ? (
                    <div className="mt-1 break-all font-mono text-[11px] text-desktop-text-secondary">{task.command}</div>
                  ) : null}
                  {task.description ? (
                    <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">{task.description}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className={`rounded-full border px-2.5 py-1 ${
                    task.resolved
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}>
                    {task.resolved ? copy.resolved : copy.unresolved}
                  </span>
                  <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-desktop-text-secondary">
                    {task.fileScope}
                  </span>
                  {task.hardGate ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                      {copy.hardGate}
                    </span>
                  ) : null}
                </div>
              </div>
              {task.sourceFile ? (
                <div className="mt-3 font-mono text-[10px] text-desktop-text-secondary">{task.sourceFile}</div>
              ) : null}
            </div>
          )) : (
            <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-5 text-[12px] text-desktop-text-secondary">
              {copy.noRuntimeMetricsYet}
            </div>
          )}
        </div>
      ) : null}

      {state.inspectorTab === "script" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "runtime", label: copy.runtimeManifest },
              { id: "raw", label: copy.rawHook },
              { id: "review", label: copy.reviewTriggers },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  dispatch({ type: "select-script-tab", tab: tab.id as ScriptTab });
                }}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                  state.scriptTab === tab.id
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <CodeViewer
            code={previewSource.code}
            language={previewSource.language}
            showHeader={false}
            maxHeight="420px"
            className="rounded-sm"
          />
        </div>
      ) : null}
    </section>
  );
}

export function HarnessHookWorkbench({
  data,
  unsupportedMessage,
  variant = "full",
  embedded = false,
}: HookWorkbenchProps) {
  const { t } = useTranslation();
  const copy = t.harness.hookWorkbench;
  const entries = useMemo(
    () => buildHookWorkbenchEntries(data).filter((entry) => entry.lifecycleGroup === "commit" || entry.lifecycleGroup === "push"),
    [data],
  );
  const groupedEntries = useMemo(() => groupHookEntries(entries), [entries]);
  const defaultHook = useMemo(() => getDefaultWorkbenchHook(entries), [entries]);
  const contextKey = data.repoRoot;
  const [state, dispatch] = useReducer(
    workbenchReducer,
    createInitialState(contextKey, defaultHook?.name ?? ""),
  );

  useEffect(() => {
    dispatch({
      type: "sync",
      contextKey,
      hookNames: entries.map((entry) => entry.name),
      defaultHookName: defaultHook?.name ?? "",
    });
  }, [contextKey, defaultHook?.name, entries]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.name === state.selectedHookName) ?? defaultHook ?? null,
    [defaultHook, entries, state.selectedHookName],
  );
  const compactMode = variant === "compact";
  const warnings = data.warnings ?? [];

  const contextValue: WorkbenchContextValue = {
    state,
    dispatch,
    activeEntry,
    groupedEntries,
    data,
    compactMode,
    embedded,
    copy,
  };

  return (
    <WorkbenchContext.Provider value={contextValue}>
      <section
        className={embedded
          ? "space-y-0"
          : compactMode
            ? "rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-4"
            : "rounded-sm border border-desktop-border bg-desktop-bg-secondary/40 p-5"}
      >
        {unsupportedMessage ? (
          <HarnessUnsupportedState className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-4 text-[11px] text-amber-800" />
        ) : null}

        {!unsupportedMessage && warnings.length > 0 ? (
          <div className="grid gap-2">
            {warnings.map((warning) => (
              <div key={warning} className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800">
                {formatHookWarning(warning, copy)}
              </div>
            ))}
          </div>
        ) : null}

        {!unsupportedMessage && entries.length === 0 ? (
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-6 text-[12px] text-desktop-text-secondary">
            {copy.noHookMetadataFound}
          </div>
        ) : null}

        {!unsupportedMessage && entries.length > 0 ? (
          <div
            className={`grid gap-4 ${warnings.length > 0 ? "mt-4" : ""} ${
              compactMode
                ? "grid-cols-1"
                : "xl:grid-cols-[260px_minmax(0,1fr)_320px] 2xl:grid-cols-[280px_minmax(0,1fr)_360px]"
            }`}
          >
            <HookLifecycleRail />
            <HookFlowCanvas />
            <HookInspector />
          </div>
        ) : null}
      </section>
    </WorkbenchContext.Provider>
  );
}
