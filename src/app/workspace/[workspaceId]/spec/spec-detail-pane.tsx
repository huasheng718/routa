"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList, FilePlus2, FileText, FolderPlus, GitBranch, Image, Link2, Video } from "lucide-react";
import { resolveApiPath } from "@/client/config/backend";
import { getDesktopApiBaseUrl } from "@/client/utils/diagnostics";
import { MarkdownViewer } from "@/client/components/markdown/markdown-viewer";
import { useTranslation } from "@/i18n";
import {
  normalizeSpecStatus,
  type IssueRelations,
  type ResolvedRelation,
  type SpecIssue,
  type SurfaceHit,
} from "./spec-board-model";
import { CompactBadge, DetailSection } from "./spec-shared-components";
import {
  compactText,
  formatFileSize,
  formatTemplate,
  getConfidenceLabel,
  getGithubStateLabel,
  getKindLabel,
  getSeverityLabel,
  getStatusLabels,
  SEVERITY_STYLES,
  STATUS_THEMES,
  SURFACE_CONFIDENCE_STYLES,
} from "./spec-page-helpers";

function RelationPill({
  relation,
  onSelectLocalIssue,
}: {
  relation: ResolvedRelation;
  onSelectLocalIssue: (filename: string) => void;
}) {
  const baseClassName =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors";

  if (relation.targetFilename) {
    return (
      <button
        type="button"
        onClick={() => onSelectLocalIssue(relation.targetFilename as string)}
        className={`${baseClassName} border-black/8 bg-black/[0.03] text-slate-700 hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10`}
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{relation.label}</span>
      </button>
    );
  }

  if (relation.href) {
    return (
      <a
        href={relation.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClassName} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/20`}
      >
        <span className="truncate">{relation.label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      </a>
    );
  }

  return (
    <span className={`${baseClassName} border-black/8 bg-black/[0.03] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200`}>
      {relation.label}
    </span>
  );
}

function IssueButton({
  issue,
  onSelectIssue,
}: {
  issue: SpecIssue;
  onSelectIssue: (filename: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectIssue(issue.filename)}
      className="flex w-full items-start gap-2 rounded-lg border border-black/8 bg-white/80 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
    >
      <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
      <span className="line-clamp-2">{issue.title || issue.filename}</span>
    </button>
  );
}

function SurfaceHitCard({ hit }: { hit: SurfaceHit }) {
  const { t } = useTranslation();

  return (
    <article className="rounded-lg border border-black/6 bg-white/80 p-2.5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
            {hit.label}
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {hit.secondaryLabel}
          </div>
        </div>
        <CompactBadge className={SURFACE_CONFIDENCE_STYLES[hit.confidence]}>
          {getConfidenceLabel(hit.confidence, t)}
        </CompactBadge>
      </div>

      {hit.description ? (
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{hit.description}</div>
      ) : null}

      {hit.evidence.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {hit.evidence.map((evidence) => (
            <CompactBadge
              key={evidence}
              className="bg-black/[0.04] text-slate-600 dark:bg-white/8 dark:text-slate-200"
            >
              {evidence}
            </CompactBadge>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SelectedIssueMergeBar({
  selectedIssues,
  creatingKanbanTask,
  openingWorkspace,
  onCreateKanbanTask,
  onOpenWorkspace,
  onClear,
}: {
  selectedIssues: SpecIssue[];
  creatingKanbanTask: boolean;
  openingWorkspace: boolean;
  onCreateKanbanTask: () => void;
  onOpenWorkspace: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const selectedCount = selectedIssues.length;
  const disabled = selectedCount < 2 || creatingKanbanTask || openingWorkspace;
  const titlePreview = selectedIssues
    .slice(0, 3)
    .map((issue) => compactText(issue.title) || issue.filename)
    .join(t.specBoard.mergeSelectionSeparator);

  return (
    <section className="mt-3 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-left dark:border-sky-500/25 dark:bg-sky-500/10">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-sky-800 dark:text-sky-100">
            {formatTemplate(t.specBoard.mergeSelectedCount, { count: String(selectedCount) })}
          </div>
          <div className="mt-1 truncate text-[11px] text-sky-700/80 dark:text-sky-100/75">
            {titlePreview}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateKanbanTask}
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400/20 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span className="whitespace-nowrap">
            {creatingKanbanTask ? t.specBoard.creatingKanbanTaskFromIssue : t.specBoard.mergeCreateKanbanTask}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenWorkspace}
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-950 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
        >
          <FolderPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span className="whitespace-nowrap">
            {openingWorkspace ? t.specBoard.openingWorkspaceFromIssue : t.specBoard.mergeOpenWorkspace}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={creatingKanbanTask || openingWorkspace}
          className="inline-flex h-8 items-center rounded-md border border-sky-200/80 bg-white/80 px-2.5 text-xs font-medium text-sky-800 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400/20 dark:bg-white/10 dark:text-sky-100 dark:hover:bg-white/15"
        >
          {t.specBoard.mergeClearSelection}
        </button>
      </div>
    </section>
  );
}

function IssueAttachments({
  workspaceId,
  issue,
}: {
  workspaceId: string;
  issue: SpecIssue;
}) {
  const { t } = useTranslation();

  if (!issue.attachments || issue.attachments.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-black/6 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {t.specBoard.createIssueAttachmentsTitle}
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {issue.attachments.map((attachment) => {
          const Icon = attachment.category === "image" ? Image : attachment.category === "video" ? Video : FileText;
          return (
            <a
              key={attachment.path}
              href={resolveApiPath(
                `/spec/issues/assets?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(attachment.path)}`,
                getDesktopApiBaseUrl(),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-black/6 bg-[#f8fafc] px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.07]"
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">{attachment.originalName || attachment.filename}</span>
              <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{formatFileSize(attachment.size)}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function SpecDetailPane({
  workspaceId,
  issue,
  selectedIssues,
  relations,
  surfaceHits,
  surfaceWarnings,
  onSelectLinkedIssue,
  onCreateKanbanTaskFromIssue,
  onOpenWorkspaceFromIssue,
  onCreateKanbanTaskFromSelectedIssues,
  onOpenWorkspaceFromSelectedIssues,
  onClearSelectedIssues,
  onCreateIssue,
  creatingKanbanTask,
  openingWorkspace,
  createKanbanTaskError,
  openWorkspaceError,
  bodyLoading,
  bodyError,
}: {
  workspaceId: string;
  issue: SpecIssue | null;
  selectedIssues: SpecIssue[];
  relations: IssueRelations;
  surfaceHits: SurfaceHit[];
  surfaceWarnings: string[];
  onSelectLinkedIssue: (filename: string) => void;
  onCreateKanbanTaskFromIssue: (issue: SpecIssue) => void;
  onOpenWorkspaceFromIssue: (issue: SpecIssue) => void;
  onCreateKanbanTaskFromSelectedIssues: () => void;
  onOpenWorkspaceFromSelectedIssues: () => void;
  onClearSelectedIssues: () => void;
  onCreateIssue: () => void;
  creatingKanbanTask: boolean;
  openingWorkspace: boolean;
  createKanbanTaskError: string | null;
  openWorkspaceError: string | null;
  bodyLoading: boolean;
  bodyError: string | null;
}) {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const featureExplorerHref = `/workspace/${encodeURIComponent(workspaceId)}/feature-explorer`;
  const mergeActionDisabled = creatingKanbanTask || openingWorkspace;

  if (!issue) {
    return (
      <section
        role="region"
        aria-label={t.specBoard.selectIssue}
        className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-black/8 bg-white/70 p-6 text-center dark:border-white/10 dark:bg-[#0f1722]/70"
      >
        <div className="max-w-md">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t.specBoard.selectIssue}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t.specBoard.selectIssueBody}
          </p>
          <button
            type="button"
            onClick={onCreateIssue}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:border-white/10 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
          >
            <FilePlus2 className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{t.specBoard.createIssue}</span>
          </button>
          {selectedIssues.length > 0 ? (
            <SelectedIssueMergeBar
              selectedIssues={selectedIssues}
              creatingKanbanTask={creatingKanbanTask}
              openingWorkspace={openingWorkspace}
              onCreateKanbanTask={onCreateKanbanTaskFromSelectedIssues}
              onOpenWorkspace={onOpenWorkspaceFromSelectedIssues}
              onClear={onClearSelectedIssues}
            />
          ) : null}
          {surfaceWarnings.length > 0 ? (
            <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="font-semibold">{t.specBoard.surfaceMapUnavailable}</div>
              <p className="leading-5">{t.specBoard.surfaceMapUnavailableBody}</p>
              <Link
                href={featureExplorerHref}
                aria-label={t.specBoard.surfaceMapOpenFeatureExplorer}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/70 bg-white/80 px-2.5 py-1.5 font-medium text-amber-800 transition-colors hover:bg-white dark:border-amber-400/30 dark:bg-white/10 dark:text-amber-100 dark:hover:bg-white/15"
              >
                <span>{t.specBoard.surfaceMapOpenFeatureExplorer}</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const severityClass = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
  const normalizedStatus = normalizeSpecStatus(issue.status);
  const severityLabel = getSeverityLabel(issue.severity, t);
  const visibleSurfaceHits = surfaceHits
    .filter((hit) => hit.explicit || hit.confidence !== "low")
    .slice(0, 4);
  const pages = visibleSurfaceHits.filter((hit) => hit.kind === "page");
  const apis = visibleSurfaceHits.filter((hit) => hit.kind === "api");

  return (
    <section
      role="region"
      aria-label={issue.title || issue.filename}
      className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/6 bg-white/88 dark:border-white/10 dark:bg-[#0f1722]/88"
    >
      <div className="border-b border-black/6 px-3.5 py-3 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t.nav.spec}
            </div>
            <h2 className="mt-1 text-[17px] font-semibold leading-6 text-slate-900 dark:text-slate-50">
              {issue.title || issue.filename}
            </h2>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => onCreateKanbanTaskFromIssue(issue)}
              disabled={mergeActionDisabled}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400/20 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-400"
            >
              <ClipboardList className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              <span className="whitespace-nowrap">
                {creatingKanbanTask ? t.specBoard.creatingKanbanTaskFromIssue : t.specBoard.createKanbanTaskFromIssue}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenWorkspaceFromIssue(issue)}
              disabled={mergeActionDisabled}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-950 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
            >
              <FolderPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              <span className="whitespace-nowrap">
                {openingWorkspace ? t.specBoard.openingWorkspaceFromIssue : t.specBoard.openWorkspaceFromIssue}
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <CompactBadge className={`border font-semibold uppercase ${severityClass}`}>
                {severityLabel}
              </CompactBadge>
              <CompactBadge className={STATUS_THEMES[normalizedStatus].badge}>
                {statusLabels[normalizedStatus]}
              </CompactBadge>
            </div>
          </div>
        </div>

        {selectedIssues.length > 0 ? (
          <SelectedIssueMergeBar
            selectedIssues={selectedIssues}
            creatingKanbanTask={creatingKanbanTask}
            openingWorkspace={openingWorkspace}
            onCreateKanbanTask={onCreateKanbanTaskFromSelectedIssues}
            onOpenWorkspace={onOpenWorkspaceFromSelectedIssues}
            onClear={onClearSelectedIssues}
          />
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/6 dark:text-slate-200">
            {getKindLabel(issue.kind, t)}
          </CompactBadge>
          {issue.area ? (
            <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/6 dark:text-slate-200">
              {issue.area}
            </CompactBadge>
          ) : null}
          {issue.date ? (
            <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/6 dark:text-slate-200">
              {`${t.specBoard.date}: ${issue.date}`}
            </CompactBadge>
          ) : null}
          {issue.reportedBy ? (
            <CompactBadge className="bg-black/[0.04] text-slate-600 dark:bg-white/6 dark:text-slate-200">
              {`${t.specBoard.reportedBy}: ${issue.reportedBy}`}
            </CompactBadge>
          ) : null}
          <CompactBadge className="bg-black/[0.04] font-mono text-slate-600 dark:bg-white/6 dark:text-slate-200">
            {issue.filename}
          </CompactBadge>
          {issue.githubIssue != null ? (
            issue.githubUrl ? (
              <a
                href={issue.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/20"
              >
                <span>#{issue.githubIssue} ({getGithubStateLabel(issue.githubState, t)})</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </a>
            ) : (
              <CompactBadge className="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                #{issue.githubIssue}
              </CompactBadge>
            )
          ) : null}
        </div>

        {createKanbanTaskError ? (
          <div
            role="alert"
            className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {createKanbanTaskError}
          </div>
        ) : null}

        {openWorkspaceError ? (
          <div
            role="alert"
            className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {openWorkspaceError}
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
        <div className="grid gap-3 xl:grid-cols-3">
          <DetailSection title={t.specBoard.linkedFrom} count={relations.incoming.length}>
            {relations.incoming.length > 0 ? (
              relations.incoming.map((incomingIssue) => (
                <IssueButton
                  key={incomingIssue.filename}
                  issue={incomingIssue}
                  onSelectIssue={onSelectLinkedIssue}
                />
              ))
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">{t.specBoard.noBacklinks}</div>
            )}
          </DetailSection>

          <DetailSection title={t.specBoard.sameFamily} count={relations.familyIssues.length}>
            {relations.familyIssues.length > 0 ? (
              relations.familyIssues.map((familyIssue) => (
                <IssueButton
                  key={familyIssue.filename}
                  issue={familyIssue}
                  onSelectIssue={onSelectLinkedIssue}
                />
              ))
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">{t.specBoard.noLinkedIssues}</div>
            )}
          </DetailSection>

          <DetailSection title={t.specBoard.issueLinks} count={relations.outgoing.length}>
            {relations.outgoing.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {relations.outgoing.map((relation) => (
                  <RelationPill
                    key={relation.key}
                    relation={relation}
                    onSelectLocalIssue={onSelectLinkedIssue}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">{t.specBoard.noLinkedIssues}</div>
            )}
          </DetailSection>
        </div>

        <section className="rounded-xl border border-black/6 bg-[#f8fafc] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t.specBoard.featureFootprint}
            </div>
            <div className="flex items-center gap-1">
              <CompactBadge className="bg-black/[0.04] text-slate-500 dark:bg-white/6 dark:text-slate-300">
                {pages.length} {t.specBoard.pages}
              </CompactBadge>
              <CompactBadge className="bg-black/[0.04] text-slate-500 dark:bg-white/6 dark:text-slate-300">
                {apis.length} {t.specBoard.apis}
              </CompactBadge>
            </div>
          </div>

          {visibleSurfaceHits.length > 0 ? (
            <div className="mt-2 grid gap-2 xl:grid-cols-2">
              {visibleSurfaceHits.map((hit) => (
                <SurfaceHitCard key={hit.key} hit={hit} />
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-black/8 bg-white/70 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
              {surfaceWarnings.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    {t.specBoard.surfaceMapUnavailable}
                  </div>
                  <p className="leading-6">
                    {t.specBoard.surfaceMapUnavailableBody}
                  </p>
                  {surfaceWarnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      {warning}
                    </div>
                  ))}
                  <Link
                    href={featureExplorerHref}
                    aria-label={t.specBoard.surfaceMapOpenFeatureExplorer}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                  >
                    <span>{t.specBoard.surfaceMapOpenFeatureExplorer}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </Link>
                </div>
              ) : (
                t.specBoard.noSurfaceHits
              )}
            </div>
          )}
        </section>

        {issue.tags.length > 0 ? (
          <section className="rounded-xl border border-black/6 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap gap-1.5">
              {issue.tags.map((tag) => (
                <CompactBadge
                  key={tag}
                  className="border border-black/6 bg-[#f6f3ee] text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                >
                  {tag}
                </CompactBadge>
              ))}
            </div>
          </section>
        ) : null}

        <IssueAttachments workspaceId={workspaceId} issue={issue} />

        <details className="rounded-xl border border-black/6 bg-[#fdfdfd] p-3 dark:border-white/10 dark:bg-[#0c121b]">
          <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {t.specBoard.body}
          </summary>
          <div className="mt-3">
            {bodyLoading ? (
              <div className="rounded-lg border border-dashed border-black/8 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                {t.common.loading}
              </div>
            ) : bodyError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {bodyError}
              </div>
            ) : (
              <MarkdownViewer content={issue.body} className="text-sm text-slate-700 dark:text-slate-100" />
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
