"use client";

import React from "react";
import { RotateCcw, Archive } from "lucide-react";
import { useTranslation } from "@/i18n";

interface KanbanWorkflowActionsProps {
  targetBranch?: string;
  onReset: () => void;
  loading?: boolean;
}

export function KanbanWorkflowActions({
  targetBranch = "main",
  onReset,
  loading = false,
}: KanbanWorkflowActionsProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-[#202433] dark:bg-[#0d1018]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        {t.kanban.workflowActions}
      </div>

      <div className="space-y-2">
        {/* Reset Action */}
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#12141c] dark:hover:border-sky-700 dark:hover:bg-sky-900/20"
        >
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t.kanban.resetAndContinue}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t.kanban.resetAndContinueHint.replace("{branch}", targetBranch)}
            </div>
          </div>
        </button>

        {/* Archive Action */}
        <button
          type="button"
          disabled={true}
          title={t.kanban.archiveActionUnavailable}
          className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-purple-300 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#12141c] dark:hover:border-purple-700 dark:hover:bg-purple-900/20"
        >
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t.kanban.archiveAndStartNewSpace}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t.kanban.archiveAndStartNewSpaceHint}
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
