"use client";

import { useTranslation } from "@/i18n";
import { RefreshCw, Zap, ChartColumn, Settings } from "lucide-react";


type QuickStartAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type HarnessQuickStartCardProps = {
  dimensionCount: number;
  metricCount?: number;
  hardGateCount?: number;
  hookCount?: number;
  workflowCount?: number;
  onNavigateToSection: (sectionId: string) => void;
};

export function HarnessQuickStartCard({
  dimensionCount,
  metricCount: _metricCount = 0,
  hardGateCount = 0,
  hookCount = 0,
  workflowCount = 0,
  onNavigateToSection,
}: HarnessQuickStartCardProps) {
  const { t } = useTranslation();
  const quickStart = t.settings.harness.quickStart;

  const actions: QuickStartAction[] = [
    {
      id: "fitness",
      title: quickStart.viewQualityDimensions,
      description: quickStart.fitnessDescription.replace("{count}", String(dimensionCount)),
      icon: (
        <ChartColumn className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("entrix-fitness"),
    },
    {
      id: "hooks",
      title: quickStart.reviewHooks,
      description: quickStart.hooksDescription.replace("{count}", String(hookCount)),
      icon: (
        <Settings className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("hook-systems"),
    },
    {
      id: "cicd",
      title: quickStart.checkCICD,
      description: quickStart.cicdDescription.replace("{count}", String(workflowCount)),
      icon: (
        <RefreshCw className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("ci-cd"),
    },
  ];

  const stats = [
    { label: quickStart.statFitness, value: dimensionCount, color: "emerald", section: "entrix-fitness" },
    { label: quickStart.statGates, value: hardGateCount, color: "amber", section: "entrix-fitness" },
    { label: quickStart.statHooks, value: hookCount, color: "blue", section: "hook-systems" },
    { label: quickStart.statWorkflows, value: workflowCount, color: "violet", section: "ci-cd" },
  ];

  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    violet: "text-violet-600 dark:text-violet-400",
  };

  const StatItem = ({ stat }: { stat: typeof stats[0] }) => (
    <button
      onClick={() => onNavigateToSection(stat.section)}
      className="flex items-center gap-2 rounded-md border border-desktop-border bg-desktop-bg-primary px-2 py-1.5 transition-colors hover:bg-desktop-bg-active"
    >
      <div className={`text-[14px] font-bold leading-none ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
        {stat.value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-desktop-text-secondary">
        {stat.label}
      </div>
    </button>
  );

  return (
    <div className="rounded-lg border border-desktop-border bg-desktop-bg-secondary/80 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-desktop-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        <h2 className="text-[12px] font-semibold text-desktop-text-primary">
          {quickStart.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
        {/* Left: Health Metrics */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex flex-col gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="group flex items-center gap-1.5 rounded-md border border-desktop-border bg-desktop-bg-primary px-2 py-1.5 text-left transition-colors hover:bg-desktop-bg-active"
            >
              <div className="shrink-0 text-desktop-accent">
                {action.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold leading-tight text-desktop-text-primary">
                  {action.title}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
