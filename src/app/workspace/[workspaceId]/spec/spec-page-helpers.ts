import { normalizeSpecStatus, type FeatureSurfaceIndexResponse, type SpecIssue, type SpecStatus, type SurfaceHit } from "./spec-board-model";
import type { useTranslation } from "@/i18n";

export type TranslationT = ReturnType<typeof useTranslation>["t"];

export type Filters = {
  status: string;
  kind: string;
  severity: string;
  area: string;
};

export type WorkspacePayload = {
  id: string;
  title: string;
};

export type CodebasePayload = {
  id: string;
  repoPath: string;
  branch?: string;
  label?: string;
};

export type TaskPayload = {
  id: string;
};

export const MERGED_ISSUES_ACTION_KEY = "__merged_spec_issues__";

export type CreateIssueForm = {
  title: string;
  area: string;
  severity: string;
  tags: string;
  body: string;
  attachments: File[];
};

export const EMPTY_CREATE_ISSUE_FORM: CreateIssueForm = {
  title: "",
  area: "",
  severity: "medium",
  tags: "",
  body: "",
  attachments: [],
};

export const SPEC_ISSUE_MAX_ATTACHMENT_COUNT = 10;
export const SPEC_ISSUE_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES = 200 * 1024 * 1024;

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".pdf",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
]);

export function isAllowedSpecIssueAttachment(file: File): boolean {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return true;
  }
  const lowerName = file.name.toLowerCase();
  return Array.from(ALLOWED_ATTACHMENT_EXTENSIONS).some((extension) => lowerName.endsWith(extension));
}

export function validateSpecIssueAttachments(
  files: File[],
  t: TranslationT,
): string | null {
  if (files.length > SPEC_ISSUE_MAX_ATTACHMENT_COUNT) {
    return formatTemplate(t.specBoard.createIssueAttachmentTooMany, {
      max: String(SPEC_ISSUE_MAX_ATTACHMENT_COUNT),
    });
  }

  const invalidType = files.find((file) => !isAllowedSpecIssueAttachment(file));
  if (invalidType) {
    return formatTemplate(t.specBoard.createIssueAttachmentUnsupportedType, {
      name: invalidType.name,
    });
  }

  const oversized = files.find((file) => file.size > SPEC_ISSUE_MAX_ATTACHMENT_BYTES);
  if (oversized) {
    return formatTemplate(t.specBoard.createIssueAttachmentTooLarge, {
      name: oversized.name,
      max: formatFileSize(SPEC_ISSUE_MAX_ATTACHMENT_BYTES),
    });
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES) {
    return formatTemplate(t.specBoard.createIssueAttachmentsTotalTooLarge, {
      max: formatFileSize(SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES),
    });
  }

  return null;
}

export const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  low: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200",
  info: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
};

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const STATUS_THEMES: Record<
  SpecStatus,
  {
    badge: string;
    dot: string;
    selected: string;
  }
> = {
  open: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
    dot: "bg-rose-500",
    selected: "border-rose-300 bg-rose-50/95 dark:border-rose-500/30 dark:bg-rose-500/10",
  },
  investigating: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    dot: "bg-amber-500",
    selected: "border-amber-300 bg-amber-50/95 dark:border-amber-500/30 dark:bg-amber-500/10",
  },
  resolved: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    dot: "bg-emerald-500",
    selected: "border-emerald-300 bg-emerald-50/95 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  },
  wontfix: {
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
    dot: "bg-slate-500",
    selected: "border-slate-300 bg-slate-100/90 dark:border-slate-500/30 dark:bg-slate-500/10",
  },
};

export const SURFACE_CONFIDENCE_STYLES: Record<SurfaceHit["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  low: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
};

export function getStatusLabels(t: TranslationT): Record<SpecStatus, string> {
  return {
    open: t.specBoard.statusOpen,
    investigating: t.specBoard.statusInvestigating,
    resolved: t.specBoard.statusResolved,
    wontfix: t.specBoard.statusWontfix,
  };
}

export function getSeverityLabel(severity: string | null | undefined, t: TranslationT): string {
  switch (compactText(severity).toLowerCase()) {
    case "critical":
      return t.specBoard.severityCritical;
    case "high":
      return t.specBoard.severityHigh;
    case "medium":
      return t.specBoard.severityMedium;
    case "low":
      return t.specBoard.severityLow;
    case "info":
      return t.specBoard.severityInfo;
    default:
      return compactText(severity);
  }
}

export function getKindLabel(kind: string | null | undefined, t: TranslationT): string {
  switch (compactText(kind).toLowerCase()) {
    case "issue":
      return t.specBoard.kindIssue;
    case "analysis":
      return t.specBoard.kindAnalysis;
    case "progress_note":
      return t.specBoard.kindProgressNote;
    case "verification_report":
      return t.specBoard.kindVerificationReport;
    case "github_mirror":
      return t.specBoard.kindGithubMirror;
    default:
      return compactText(kind);
  }
}

export function getConfidenceLabel(confidence: string | null | undefined, t: TranslationT): string {
  switch (compactText(confidence).toLowerCase()) {
    case "high":
      return t.specBoard.confidenceHigh;
    case "medium":
      return t.specBoard.confidenceMedium;
    case "low":
      return t.specBoard.confidenceLow;
    default:
      return compactText(confidence);
  }
}

export function getGithubStateLabel(state: string | null | undefined, t: TranslationT): string {
  switch (compactText(state).toLowerCase()) {
    case "open":
      return t.specBoard.githubStateOpen;
    case "closed":
      return t.specBoard.githubStateClosed;
    default:
      return compactText(state) || t.specBoard.githubStateUnknown;
  }
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybeError = "error" in payload && typeof payload.error === "string" ? payload.error : "";
  const maybeDetails = "details" in payload && typeof payload.details === "string" ? payload.details : "";
  return maybeDetails || maybeError || fallback;
}

export function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template,
  );
}

export function compactText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function buildIssueWorkspaceTitle(issue: SpecIssue, t: TranslationT): string {
  return formatTemplate(t.specBoard.openWorkspaceTitle, {
    title: compactText(issue.title) || issue.filename,
  });
}

export function buildIssuesWorkspaceTitle(issues: SpecIssue[], t: TranslationT): string {
  if (issues.length === 1) {
    return buildIssueWorkspaceTitle(issues[0] as SpecIssue, t);
  }

  const leadIssue = issues[0] as SpecIssue | undefined;
  return formatTemplate(t.specBoard.mergeWorkspaceTitle, {
    title: compactText(leadIssue?.title) || leadIssue?.filename || t.nav.spec,
    count: String(issues.length),
  });
}

export function buildIssuesTaskTitle(issues: SpecIssue[], t: TranslationT): string {
  if (issues.length === 1) {
    const issue = issues[0] as SpecIssue;
    return compactText(issue.title) || issue.filename;
  }

  const leadIssue = issues[0] as SpecIssue | undefined;
  return formatTemplate(t.specBoard.mergeTaskTitle, {
    title: compactText(leadIssue?.title) || leadIssue?.filename || t.nav.spec,
    count: String(issues.length),
  });
}

function priorityFromIssueSeverity(severity: string): "urgent" | "high" | "medium" | "low" | undefined {
  switch (severity.toLowerCase()) {
    case "critical":
      return "urgent";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return undefined;
  }
}

export function priorityFromIssues(issues: SpecIssue[]): "urgent" | "high" | "medium" | "low" | undefined {
  const highestSeverityIssue = [...issues].sort((a, b) => {
    return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
  })[0];
  return highestSeverityIssue ? priorityFromIssueSeverity(highestSeverityIssue.severity) : undefined;
}

function buildIssueTaskObjective(issue: SpecIssue, t: TranslationT, intro: string): string {
  const body = compactText(issue.body) || compactText(issue.surfaceText);
  const statusLabels = getStatusLabels(t);
  const normalizedStatus = normalizeSpecStatus(issue.status);
  const metadataRows = [
    [t.specBoard.openWorkspaceSourceLabel, compactText(issue.title) || issue.filename],
    [t.specBoard.file, issue.filename],
    [t.specBoard.kind, getKindLabel(issue.kind, t) || t.common.none],
    [t.specBoard.severity, getSeverityLabel(issue.severity, t) || t.common.none],
    [t.specBoard.area, compactText(issue.area) || t.common.none],
    [t.specBoard.status, statusLabels[normalizedStatus] || t.common.none],
    [t.specBoard.date, compactText(issue.date) || t.common.none],
    [t.specBoard.reportedBy, compactText(issue.reportedBy) || t.common.none],
    [t.specBoard.github, issue.githubIssue != null ? `#${issue.githubIssue}` : t.common.none],
  ];
  const githubUrl = compactText(issue.githubUrl);
  if (githubUrl) {
    metadataRows.push([t.specBoard.githubLinked, githubUrl]);
  }

  return [
    intro,
    "",
    ...metadataRows.map(([label, value]) => `${label}: ${value}`),
    "",
    body || t.specBoard.openWorkspaceTaskBodyEmpty,
  ].join("\n");
}

export function buildIssuesTaskObjective(issues: SpecIssue[], t: TranslationT, intro: string): string {
  if (issues.length === 1) {
    return buildIssueTaskObjective(issues[0] as SpecIssue, t, intro);
  }

  const sourceSections = issues.flatMap((issue, index) => {
    const body = compactText(issue.body) || compactText(issue.surfaceText) || t.specBoard.openWorkspaceTaskBodyEmpty;
    const statusLabels = getStatusLabels(t);
    const normalizedStatus = normalizeSpecStatus(issue.status);
    const rows = [
      `${index + 1}. ${compactText(issue.title) || issue.filename}`,
      `   ${t.specBoard.file}: ${issue.filename}`,
      `   ${t.specBoard.kind}: ${getKindLabel(issue.kind, t) || t.common.none}`,
      `   ${t.specBoard.severity}: ${getSeverityLabel(issue.severity, t) || t.common.none}`,
      `   ${t.specBoard.area}: ${compactText(issue.area) || t.common.none}`,
      `   ${t.specBoard.status}: ${statusLabels[normalizedStatus] || t.common.none}`,
      `   ${t.specBoard.date}: ${compactText(issue.date) || t.common.none}`,
      `   ${t.specBoard.reportedBy}: ${compactText(issue.reportedBy) || t.common.none}`,
      `   ${t.specBoard.github}: ${issue.githubIssue != null ? `#${issue.githubIssue}` : t.common.none}`,
    ];
    const githubUrl = compactText(issue.githubUrl);
    if (githubUrl) {
      rows.push(`   ${t.specBoard.githubLinked}: ${githubUrl}`);
    }

    return [
      ...rows,
      "",
      body,
      "",
    ];
  });

  return [
    intro,
    "",
    `${t.specBoard.mergeSourcesTitle}:`,
    ...sourceSections,
  ].join("\n");
}

function buildIssueTaskLabels(issue: SpecIssue): string[] {
  return Array.from(new Set([
    issue.kind,
    issue.severity,
    issue.area,
    ...issue.tags,
  ].map((label) => compactText(label)).filter(Boolean)));
}

export function buildIssuesTaskLabels(issues: SpecIssue[]): string[] {
  return Array.from(new Set(issues.flatMap((issue) => buildIssueTaskLabels(issue))));
}

export function buildIssuesTaskScope(issues: SpecIssue[]): string | undefined {
  const areas = Array.from(new Set(issues.map((issue) => compactText(issue.area)).filter(Boolean)));
  if (areas.length > 0) {
    return areas.join(", ");
  }

  const kinds = Array.from(new Set(issues.map((issue) => compactText(issue.kind)).filter(Boolean)));
  return kinds.length > 0 ? kinds.join(", ") : undefined;
}

export function buildIssueGitHubTaskFields(issues: SpecIssue[]) {
  if (issues.length !== 1) {
    return {};
  }

  const issue = issues[0] as SpecIssue;
  return {
    githubNumber: issue.githubIssue ?? undefined,
    githubUrl: issue.githubUrl ?? undefined,
    githubState: issue.githubState ?? undefined,
  };
}

export function getAttachmentCategory(file: File): "image" | "video" | "document" {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return "document";
}

export function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function emptySurfaceIndexResponse(warnings: string[] = []): FeatureSurfaceIndexResponse {
  return {
    generatedAt: "",
    pages: [],
    apis: [],
    metadata: null,
    repoRoot: "",
    warnings,
  };
}

function localizeSurfaceWarning(warning: string, t: TranslationT): string {
  const missingPrefix = "Feature surface index not found at ";
  if (warning.startsWith(missingPrefix)) {
    return formatTemplate(t.specBoard.surfaceMapMissingWarning, {
      path: warning.slice(missingPrefix.length),
    });
  }

  const invalidPrefix = "Feature surface index is not valid JSON at ";
  if (warning.startsWith(invalidPrefix)) {
    return formatTemplate(t.specBoard.surfaceMapInvalidWarning, {
      path: warning.slice(invalidPrefix.length),
    });
  }

  return t.specBoard.surfaceMapWarningGeneric;
}

export function normalizeSurfaceIndexPayload(
  payload: unknown,
  t: TranslationT,
): FeatureSurfaceIndexResponse {
  if (!payload || typeof payload !== "object") {
    return emptySurfaceIndexResponse([t.specBoard.surfaceMapUnavailable]);
  }

  return {
    generatedAt: typeof (payload as { generatedAt?: unknown }).generatedAt === "string"
      ? (payload as { generatedAt: string }).generatedAt
      : "",
    pages: Array.isArray((payload as { pages?: unknown }).pages)
      ? (payload as { pages: FeatureSurfaceIndexResponse["pages"] }).pages
      : [],
    apis: Array.isArray((payload as { apis?: unknown }).apis)
      ? (payload as { apis: FeatureSurfaceIndexResponse["apis"] }).apis
      : [],
    metadata: typeof (payload as { metadata?: unknown }).metadata === "object"
      ? (payload as { metadata: FeatureSurfaceIndexResponse["metadata"] }).metadata
      : null,
    repoRoot: typeof (payload as { repoRoot?: unknown }).repoRoot === "string"
      ? (payload as { repoRoot: string }).repoRoot
      : "",
    warnings: Array.isArray((payload as { warnings?: unknown }).warnings)
      ? (payload as { warnings: unknown[] }).warnings
        .filter((warning): warning is string => typeof warning === "string")
        .map((warning) => localizeSurfaceWarning(warning, t))
      : [],
  };
}
