"use client";

import type React from "react";

export function CompactBadge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${className}`}>
      {children}
    </span>
  );
}

export function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-black/6 bg-[#f8fafc] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {title}
        </div>
        <CompactBadge className="bg-black/[0.04] text-slate-500 dark:bg-white/6 dark:text-slate-300">
          {count}
        </CompactBadge>
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
