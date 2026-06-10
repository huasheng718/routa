"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { CodeViewer } from "@/client/components/codemirror/code-viewer";
import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import { useTranslation, type TranslationDictionary } from "@/i18n";
import type { AgentHooksResponse } from "@/client/hooks/use-harness-settings-data";
import {
  buildAgentHookFlow,
  buildAgentHookWorkbenchEntries,
  getDefaultAgentHookEntry,
  groupAgentHookEntries,
  type AgentHookFlowNodeSpec,
  type AgentHookFlowNodeTone,
  type AgentHookLifecycleGroup,
  type AgentHookWorkbenchEntry,
} from "./harness-agent-hook-workbench-model";

type AgentHookWorkbenchProps = {
  data: AgentHooksResponse;
  unsupportedMessage?: string | null;
  variant?: "full" | "compact";
  embedded?: boolean;
};

type AgentHookWorkbenchCopy = TranslationDictionary["harness"]["agentHookWorkbench"];

type WorkbenchState = {
  contextKey: string;
  selectedEvent: string;
};

type WorkbenchAction =
  | { type: "sync"; contextKey: string; events: string[]; defaultEvent: string }
  | { type: "select-event"; event: string };

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
  activeEntry: AgentHookWorkbenchEntry | null;
  groupedEntries: ReturnType<typeof groupAgentHookEntries>;
  data: AgentHooksResponse;
  compactMode: boolean;
  embedded: boolean;
  copy: AgentHookWorkbenchCopy;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

function toneStyles(tone: AgentHookFlowNodeTone) {
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

function createInitialState(contextKey: string, defaultEvent: string): WorkbenchState {
  return {
    contextKey,
    selectedEvent: defaultEvent,
  };
}

function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "sync": {
      const selectedStillExists = action.events.includes(state.selectedEvent);
      if (state.contextKey !== action.contextKey) {
        return createInitialState(action.contextKey, action.defaultEvent);
      }
      if (selectedStillExists) {
        return state;
      }
      return { ...state, selectedEvent: action.defaultEvent };
    }
    case "select-event":
      return { ...state, selectedEvent: action.event };
    default:
      return state;
  }
}

function useWorkbenchContext() {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error("HarnessAgentHookWorkbench context is missing");
  }
  return context;
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (formatted, [key, value]) => formatted.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatCount(template: string, count: number) {
  return formatTemplate(template, { count });
}

function getRecordValue(record: Record<string, string>, key: string, fallback: string) {
  return record[key] ?? fallback;
}

function formatLifecycleGroupLabel(group: AgentHookLifecycleGroup, copy: AgentHookWorkbenchCopy) {
  return getRecordValue(copy.lifecycleGroups, group, group);
}

function formatLifecycleLabel(entry: AgentHookWorkbenchEntry, copy: AgentHookWorkbenchCopy) {
  return formatLifecycleGroupLabel(entry.lifecycleGroup, copy);
}

function formatLifecycleDescription(entry: AgentHookWorkbenchEntry, copy: AgentHookWorkbenchCopy) {
  return copy.eventDescriptions[entry.event] ?? formatTemplate(copy.customEventDescription, { event: entry.event });
}

function formatEventHint(entry: AgentHookWorkbenchEntry, copy: AgentHookWorkbenchCopy) {
  return copy.eventHints[entry.event] ?? copy.providerSpecificEvent;
}

function formatHookType(type: string, copy: AgentHookWorkbenchCopy) {
  return getRecordValue(copy.hookTypes, type, type);
}

function formatFlowKind(kind: string, copy: AgentHookWorkbenchCopy) {
  return getRecordValue(copy.flowKinds, kind, kind);
}

function formatFlowTitle(value: string, copy: AgentHookWorkbenchCopy) {
  if (value === "Passthrough") return copy.passthrough;
  if (value === "Allow") return copy.allow;
  if (value === "Block") return copy.block;
  if (value === "Signal") return copy.signal;
  if (value.endsWith(" hook")) {
    const type = value.slice(0, -" hook".length);
    return `${formatHookType(type, copy)} ${copy.hook}`;
  }
  return value;
}

function formatFlowSubtitle(value: string | undefined, copy: AgentHookWorkbenchCopy) {
  if (!value) return value;
  if (value === "No hooks configured for this event") return copy.noHooksConfigured;
  if (value === "Hook exits 0 — action proceeds") return copy.hookExitZero;
  if (value === "Hook exits non-zero — action denied") return copy.hookExitNonZero;
  if (value === "Non-blocking — hook output recorded") return copy.nonBlockingOutputRecorded;
  if (value.includes(" · Can block")) return value.replace("Can block", copy.canBlock);
  if (value.includes(" · Non-blocking")) return value.replace("Non-blocking", copy.nonBlocking);
  return value;
}

function formatFlowChip(value: string, copy: AgentHookWorkbenchCopy) {
  if (value === "no hooks configured") return copy.noHooksConfiguredChip;
  if (value === "signal only") return copy.signalOnly;
  if (value === "blocking") return copy.blocking;
  if (value === "async") return copy.async;
  if (value.endsWith(" hooks")) {
    const count = Number(value.replace(" hooks", ""));
    return Number.isFinite(count) ? formatCount(copy.hooksCount, count) : value;
  }
  if (value.endsWith(" blocking")) {
    const count = Number(value.replace(" blocking", ""));
    return Number.isFinite(count) ? formatCount(copy.blockingCount, count) : value;
  }
  if (value.startsWith("matcher: ")) {
    return `${copy.labelMatcher}: ${value.slice("matcher: ".length)}`;
  }
  const knownHookType = copy.hookTypes[value];
  return knownHookType ?? value;
}

type FlowNodeData = AgentHookFlowNodeSpec & {
  displayKind?: string;
};

function formatFlowNode(node: Node<FlowNodeData>, copy: AgentHookWorkbenchCopy): Node<FlowNodeData> {
  return {
    ...node,
    data: {
      ...node.data,
      displayKind: formatFlowKind(node.data.kind, copy),
      title: formatFlowTitle(node.data.title, copy),
      subtitle: formatFlowSubtitle(node.data.subtitle, copy),
      chips: node.data.chips?.map((chip) => formatFlowChip(chip, copy)),
    },
  };
}

function formatAgentHookWarning(warning: string, copy: AgentHookWorkbenchCopy) {
  if (warning.startsWith("No agent hook configuration found. Checked: ")) {
    return formatTemplate(copy.warningsCopy.noConfigFound, {
      paths: warning.slice("No agent hook configuration found. Checked: ".length),
    });
  }
  if (warning === "Failed to read docs/fitness/runtime/agent-hooks.yaml.") {
    return copy.warningsCopy.failedReadRuntimeConfig;
  }
  const parseMatch = warning.match(/^Failed to parse (.+) as JSON\.$/);
  if (parseMatch?.[1]) {
    return formatTemplate(copy.warningsCopy.failedParseJson, { path: parseMatch[1] });
  }
  const invalidYamlMatch = warning.match(/^Invalid YAML in agent-hooks\.yaml: (.+)$/);
  if (invalidYamlMatch?.[1]) {
    return formatTemplate(copy.warningsCopy.invalidYaml, { details: invalidYamlMatch[1] });
  }
  if (warning === "Skipped hook entry with missing event field.") {
    return copy.warningsCopy.missingEventField;
  }
  const unknownEventMatch = warning.match(/^Unknown agent hook event: "(.+)"\.$/);
  if (unknownEventMatch?.[1]) {
    return formatTemplate(copy.warningsCopy.unknownEvent, { event: unknownEventMatch[1] });
  }
  const unknownTypeMatch = warning.match(/^Unknown hook type "(.+)" for event "(.+)"\.$/);
  if (unknownTypeMatch?.[1] && unknownTypeMatch[2]) {
    return formatTemplate(copy.warningsCopy.unknownHookType, {
      type: unknownTypeMatch[1],
      event: unknownTypeMatch[2],
    });
  }
  const unsupportedBlockingMatch = warning.match(/^Event "(.+)" does not support blocking\. Setting blocking to false\.$/);
  if (unsupportedBlockingMatch?.[1]) {
    return formatTemplate(copy.warningsCopy.unsupportedBlocking, { event: unsupportedBlockingMatch[1] });
  }
  return warning;
}

function buildLocalizedAgentHookConfigSource(entry: AgentHookWorkbenchEntry, copy: AgentHookWorkbenchCopy): string {
  if (entry.hooks.length === 0) {
    return [
      formatTemplate(copy.noHooksConfiguredForEventComment, { event: entry.event }),
      copy.exampleComment,
      "# hooks:",
      `#   - event: ${entry.event}`,
      "#     type: command",
      "#     command: \"echo hello\"",
      "#     timeout: 10",
      `#     blocking: ${entry.canBlock}`,
      "",
    ].join("\n");
  }

  const lines = ["hooks:"];
  for (const hook of entry.hooks) {
    lines.push(`  - event: ${hook.event}`);
    if (hook.matcher) {
      lines.push(`    matcher: "${hook.matcher}"`);
    }
    lines.push(`    type: ${hook.type}`);
    if (hook.command) {
      lines.push(`    command: "${hook.command}"`);
    }
    if (hook.url) {
      lines.push(`    url: "${hook.url}"`);
    }
    if ((hook.type === "prompt" || hook.type === "agent") && hook.prompt) {
      lines.push(`    prompt: "${hook.prompt}"`);
    }
    lines.push(`    timeout: ${hook.timeout}`);
    lines.push(`    blocking: ${hook.blocking}`);
    if (hook.description) {
      lines.push(`    description: "${hook.description}"`);
    }
    if (hook.source) {
      lines.push(`    # ${copy.labelSource}: ${hook.source}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function FlowNodeView({ data }: NodeProps<Node<FlowNodeData>>) {
  const tone = toneStyles(data.tone);
  const widthClass = data.kind === "hook" ? "w-[300px]" : "w-[276px]";
  const heightClass = data.kind === "hook" ? "min-h-[132px]" : "min-h-[120px]";

  return (
    <div className="relative">
      <Handle id="left" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <div className={`${widthClass} ${heightClass} rounded-sm border bg-desktop-bg-primary px-4 py-3 ${tone.border} ${tone.glow}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-desktop-text-secondary">{data.displayKind ?? "—"}</div>
        <div className="mt-1 text-[15px] font-semibold leading-6 text-desktop-text-primary">{data.title}</div>
        {data.subtitle ? (
          <div className="mt-1 text-[12px] leading-5 text-desktop-text-secondary">{data.subtitle}</div>
        ) : null}
        {data.chips?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.chips.map((chip) => (
              <span key={`${data.id}:${chip}`} className={`rounded-full border px-2 py-0.5 text-[10px] ${tone.badge}`}>
                {chip}
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

function AgentHookLifecycleRail() {
  const { copy, activeEntry, dispatch, groupedEntries } = useWorkbenchContext();

  return (
    <aside className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex items-center justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="text-[12px] font-semibold text-desktop-text-primary">{copy.agentHooksTitle}</div>
        <div className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-[10px] text-desktop-text-secondary">
          {formatTemplate(copy.configuredEventsCount, {
            configured: groupedEntries.reduce((sum, group) => sum + group.entries.length, 0),
            total: groupedEntries.reduce((sum, group) => sum + group.entries.length, 0),
          })}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {groupedEntries.map((group) => (
          <section key={group.group}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold text-desktop-text-primary">{formatLifecycleGroupLabel(group.group, copy)}</div>
              <div className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2 py-0.5 text-[10px] text-desktop-text-secondary">
                {group.entries.length}
              </div>
            </div>

            <div className="mt-1.5 space-y-1.5">
              {group.entries.map((entry) => {
                const selected = activeEntry?.event === entry.event;
                return (
                  <button
                    key={entry.event}
                    type="button"
                    onClick={() => dispatch({ type: "select-event", event: entry.event })}
                    className={`w-full rounded-sm border px-2.5 py-2 text-left transition ${
                      selected
                        ? "border-sky-300 bg-sky-50/80"
                        : "border-desktop-border bg-white/85 hover:bg-desktop-bg-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-[11px] font-semibold text-desktop-text-primary">{entry.event}</div>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${
                        entry.stats.hookCount > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}>
                        {entry.stats.hookCount > 0 ? `${entry.stats.hookCount}` : "–"}
                      </span>
                    </div>
                    {entry.stats.hookCount > 0 && entry.stats.blockingCount > 0 ? (
                      <div className="mt-1 flex gap-1">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                          {formatCount(copy.blockingCount, entry.stats.blockingCount)}
                        </span>
                      </div>
                    ) : null}
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

function AgentHookFlowCanvas() {
  const { copy, activeEntry, compactMode } = useWorkbenchContext();
  const flowHeight = compactMode ? 440 : 680;

  const flow = useMemo(() => {
    if (!activeEntry) {
      return { nodes: [], edges: [] };
    }

    const { nodes, edges } = buildAgentHookFlow(activeEntry);
    const positionedNodes: Node[] = nodes.map((node) => formatFlowNode({
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
    }, copy));
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
        id: `viewport-anchor:${activeEntry.event}`,
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
  }, [activeEntry, copy, flowHeight]);

  return (
    <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-desktop-text-primary">{copy.eventHookOutcome}</div>
          <div className="mt-1 text-[11px] text-desktop-text-secondary">
            {activeEntry
              ? `${formatLifecycleLabel(activeEntry, copy)} ${copy.lifecycleSuffix} · ${formatEventHint(activeEntry, copy)}`
              : copy.selectEventToInspect}
          </div>
        </div>
        {activeEntry ? (
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatLifecycleLabel(activeEntry, copy)}
            </span>
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatCount(copy.hooksCount, activeEntry.stats.hookCount)}
            </span>
            <span className="rounded-full border border-desktop-border bg-white/80 px-2.5 py-1 text-desktop-text-secondary">
              {formatCount(copy.blockingCount, activeEntry.stats.blockingCount)}
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
          {copy.noEventSelected}
        </div>
      )}
    </section>
  );
}

function AgentHookInspector() {
  const { copy, activeEntry, data } = useWorkbenchContext();
  const [activeTab, setActiveTab] = useState<"basic" | "source">("basic");

  const configSource = useMemo(() => {
    if (!activeEntry) return "";
    return buildLocalizedAgentHookConfigSource(activeEntry, copy);
  }, [activeEntry, copy]);
  const warnings = data.warnings ?? [];

  return (
    <aside className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="border-b border-desktop-border pb-2">
        <h3 className="text-[12px] font-semibold text-desktop-text-primary">
          {activeEntry?.event ?? copy.eventDetails}
        </h3>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-1 rounded-sm border border-desktop-border bg-desktop-bg-primary/80 p-1">
          {[
            { id: "basic", label: copy.tabBasic },
            { id: "source", label: copy.tabSource },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "basic" | "source")}
              className={`rounded-sm px-2.5 py-1 text-[10px] font-medium transition ${
                activeTab === tab.id
                  ? "border border-sky-200 bg-sky-50 text-sky-700"
                  : "border border-transparent text-desktop-text-secondary hover:bg-desktop-bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {warnings.length > 0 ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">{copy.warnings}</div>
            <ul className="mt-1 space-y-1">
              {warnings.map((warning) => (
                <li key={warning} className="text-[11px] text-amber-700">• {formatAgentHookWarning(warning, copy)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "basic" && activeEntry ? (
          <div className="space-y-2">
            <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 p-3 text-[11px] text-desktop-text-secondary">
              <div>{copy.labelLifecycle}: <span className="font-medium text-desktop-text-primary">{formatLifecycleLabel(activeEntry, copy)}</span></div>
              <div className="mt-1">{copy.labelCanBlock}: <span className="font-medium text-desktop-text-primary">{activeEntry.canBlock ? copy.yes : copy.no}</span></div>
              <div className="mt-1">{copy.labelHint}: {formatEventHint(activeEntry, copy)}</div>
              <div className="mt-1">{copy.labelDescription}: {formatLifecycleDescription(activeEntry, copy)}</div>
            </div>

            <div>
              <div className="text-[12px] font-semibold text-desktop-text-primary">{copy.hookListTitle}</div>
              {activeEntry.hooks.length === 0 ? (
                <div className="mt-2 rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-2.5 text-[11px] text-desktop-text-secondary">
                  {copy.noHooksConfigured}
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-desktop-border rounded-sm border border-desktop-border bg-desktop-bg-primary/80">
                  {activeEntry.hooks.map((hook, index) => (
                    <li key={`${hook.event}:${index}`} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-desktop-text-primary">
                            {hook.description || `${formatHookType(hook.type, copy)} ${copy.hook}`}
                          </div>
                          {hook.matcher ? (
                            <div className="mt-0.5 text-[10px] text-desktop-text-secondary">
                              {copy.labelMatcher}: <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">{hook.matcher}</code>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {hook.blocking ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">{copy.blocking}</span>
                          ) : null}
                          <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2 py-0.5 text-[10px] text-desktop-text-secondary">
                            {formatHookType(hook.type, copy)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 space-y-0.5 text-[10px] text-desktop-text-secondary">
                        {hook.command ? <div>{copy.labelCommand}: <code className="break-all rounded bg-slate-100 px-1 py-0.5">{hook.command}</code></div> : null}
                        {hook.url ? <div>{copy.labelUrl}: <code className="rounded bg-slate-100 px-1 py-0.5">{hook.url}</code></div> : null}
                        {hook.prompt ? <div>{copy.labelPrompt}: <code className="rounded bg-slate-100 px-1 py-0.5">{hook.prompt}</code></div> : null}
                        <div>{copy.labelTimeout}: {hook.timeout}{copy.secondsSuffix}</div>
                        {hook.source ? (
                          <div>{copy.labelSource}: <span className="font-medium text-sky-600">{hook.source}</span></div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "source" && activeEntry && configSource ? (
          <div className="overflow-hidden rounded-sm border border-desktop-border">
            <CodeViewer
              code={configSource}
              language="yaml"
              maxHeight="320px"
              showHeader={false}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function HarnessAgentHookWorkbench({
  data,
  unsupportedMessage,
  variant = "full",
  embedded = false,
}: AgentHookWorkbenchProps) {
  const { t } = useTranslation();
  const copy = t.harness.agentHookWorkbench;
  const compactMode = variant === "compact";
  const entries = useMemo(() => buildAgentHookWorkbenchEntries(data), [data]);
  const groupedEntries = useMemo(() => groupAgentHookEntries(entries), [entries]);
  const defaultEntry = useMemo(() => getDefaultAgentHookEntry(entries), [entries]);
  const contextKey = data.generatedAt ?? "";

  const [state, dispatch] = useReducer(
    workbenchReducer,
    createInitialState(contextKey, defaultEntry?.event ?? ""),
  );

  useEffect(() => {
    dispatch({
      type: "sync",
      contextKey,
      events: entries.map((entry) => entry.event),
      defaultEvent: defaultEntry?.event ?? "",
    });
  }, [contextKey, defaultEntry?.event, entries]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.event === state.selectedEvent) ?? null,
    [entries, state.selectedEvent],
  );

  const contextValue = useMemo<WorkbenchContextValue>(() => ({
    state,
    dispatch,
    activeEntry,
    groupedEntries,
    data,
    compactMode,
    embedded,
    copy,
  }), [activeEntry, compactMode, copy, data, embedded, groupedEntries, state]);

  if (unsupportedMessage) {
    return <HarnessUnsupportedState />;
  }

  return (
    <WorkbenchContext.Provider value={contextValue}>
      <section className={embedded ? "space-y-0" : "rounded-sm border border-desktop-border bg-desktop-bg-secondary/40 p-3"}>
        {!embedded ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-desktop-text-secondary">{copy.hookSystems}</div>
              <h3 className="mt-0.5 text-sm font-semibold text-desktop-text-primary">{copy.workbenchTitle}</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2.5 py-1 text-[10px] text-desktop-text-secondary">
                {formatCount(copy.hooksCount, entries.reduce((sum, entry) => sum + entry.stats.hookCount, 0))}
              </span>
              <span className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2.5 py-1 text-[10px] text-desktop-text-secondary">
                {formatTemplate(copy.configuredEventsCount, {
                  configured: entries.filter((entry) => entry.stats.hookCount > 0).length,
                  total: entries.length,
                })}
              </span>
            </div>
          </div>
        ) : null}

        <div
          className={`grid gap-3 ${
            compactMode
              ? "xl:grid-cols-[240px_minmax(0,1fr)]"
              : "xl:grid-cols-[240px_minmax(0,1fr)_320px] 2xl:grid-cols-[240px_minmax(0,1fr)_360px]"
          }`}
        >
          <AgentHookLifecycleRail />
          <AgentHookFlowCanvas />
          <AgentHookInspector key={activeEntry?.event ?? "__no_event__"} />
        </div>
      </section>
    </WorkbenchContext.Provider>
  );
}
