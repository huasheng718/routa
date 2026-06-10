"use client";

import React, { useRef, useCallback } from "react";
import { GitBranch, Tag, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { GitCommit } from "./types";
import { CommitGraphCell } from "./commit-graph-cell";

interface CommitListProps {
  commits: GitCommit[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template,
  );
}

function formatRelativeTime(iso: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.gitLog.justNow;
  if (mins < 60) return formatTemplate(t.gitLog.minutesAgo, { count: String(mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return formatTemplate(t.gitLog.hoursAgo, { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days < 30) return formatTemplate(t.gitLog.daysAgo, { count: String(days) });
  const months = Math.floor(days / 30);
  if (months < 12) return formatTemplate(t.gitLog.monthsAgo, { count: String(months) });
  return formatTemplate(t.gitLog.yearsAgo, { count: String(Math.floor(months / 12)) });
}

function RefBadge({ name, kind }: { name: string; kind: string }) {
  if (kind === "tag") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1 py-px text-[9px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400">
        <Tag className="h-2 w-2" />
        {name}
      </span>
    );
  }

  const isRemote = kind === "remote";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1 py-px text-[9px] font-medium ${
        isRemote
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-400"
          : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400"
      }`}
    >
      <GitBranch className="h-2 w-2" />
      {name}
    </span>
  );
}

export function CommitList({
  commits,
  selectedSha,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
  loading,
}: CommitListProps) {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Infinite scroll via IntersectionObserver
  const sentinelCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
            onLoadMore();
          }
        },
        { rootMargin: "100px" },
      );
      observerRef.current.observe(node);
      sentinelRef.current = node;
    },
    [hasMore, loadingMore, onLoadMore],
  );

  // Compute max lane for graph width
  const totalLanes = Math.max(2, ...commits.map((c) => (c.lane ?? 0) + 1));

  if (loading && commits.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-[11px]">{t.gitLog.loadingCommits}</span>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="py-8 text-center text-[11px] text-slate-400 dark:text-slate-500">
        {t.gitLog.noCommits}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" data-testid="git-log-commit-list">
      {/* Header row */}
      <div className="sticky top-0 z-10 flex items-center border-b border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-[#1c1f2e] dark:bg-[#0d1018] dark:text-slate-500">
        <div style={{ width: totalLanes * 14 + 4 }} className="shrink-0" />
        <div className="min-w-0 flex-1 px-1">{t.gitLog.message}</div>
        <div className="w-[120px] shrink-0 px-1 text-right">{t.gitLog.author}</div>
        <div className="w-[72px] shrink-0 px-1 text-right">{t.gitLog.date}</div>
        <div className="w-[64px] shrink-0 px-1 text-right">{t.gitLog.hash}</div>
      </div>

      {/* Commit rows */}
      {commits.map((commit) => (
        <button
          key={commit.sha}
          type="button"
          onClick={() => onSelect(commit.sha)}
          className={`flex w-full items-center border-b border-slate-100 px-1 py-[3px] text-left transition-colors dark:border-[#181b27] ${
            selectedSha === commit.sha
              ? "bg-amber-50 dark:bg-amber-900/15"
              : "hover:bg-slate-50 dark:hover:bg-[#13151f]"
          }`}
        >
          {/* Graph */}
          <CommitGraphCell commit={commit} totalLanes={totalLanes} />

          {/* Message + refs */}
          <div className="min-w-0 flex-1 px-1">
            <div className="flex min-w-0 items-center gap-1">
              {/* Ref badges */}
              {commit.refs.map((r) => (
                <RefBadge
                  key={`${r.kind}-${r.remote ?? ""}-${r.name}`}
                  name={r.remote ? `${r.remote}/${r.name}` : r.name}
                  kind={r.kind}
                />
              ))}
              <span
                className="min-w-0 truncate text-[11px] text-slate-700 dark:text-slate-200"
                title={commit.summary}
              >
                {commit.summary}
              </span>
            </div>
          </div>

          {/* Author */}
          <div
            className="w-[120px] shrink-0 truncate px-1 text-right text-[11px] text-slate-500 dark:text-slate-400"
            title={commit.authorEmail}
          >
            {commit.authorName}
          </div>

          {/* Date */}
          <div
            className="w-[72px] shrink-0 px-1 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
            title={new Date(commit.authoredAt).toLocaleString()}
          >
            {formatRelativeTime(commit.authoredAt, t)}
          </div>

          {/* Hash */}
          <div className="w-[64px] shrink-0 px-1 text-right font-mono text-[10px] text-slate-400 dark:text-slate-500">
            {commit.shortSha}
          </div>
        </button>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelCallback} className="h-4" />

      {loadingMore && (
        <div className="flex items-center justify-center py-2 text-slate-400">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          <span className="text-[10px]">{t.gitLog.loadingMore}</span>
        </div>
      )}
    </div>
  );
}
