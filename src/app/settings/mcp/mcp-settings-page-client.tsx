"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { SettingsRouteShell } from "@/client/components/settings-route-shell";
import { SettingsPageHeader } from "@/client/components/settings-page-header";
import { McpToolsExplorer } from "@/client/components/mcp-tools-explorer";
import { McpServersTab } from "@/client/components/settings-panel-mcp-tab";
import { useTranslation } from "@/i18n";
import { Server } from "lucide-react";

type McpTab = "servers" | "tools";

export function McpSettingsPageClient() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const activeTab = useMemo<McpTab>(() => (
    searchParams.get("tab") === "tools" ? "tools" : "servers"
  ), [searchParams]);
  const tabMeta: Array<{ key: McpTab; label: string; href: string }> = [
    { key: "servers", label: t.nav.mcpServers, href: "/settings/mcp?tab=servers" },
    { key: "tools", label: t.mcpTools.title, href: "/settings/mcp?tab=tools" },
  ];
  const metadata = [
    { label: t.mcp.transport, value: t.mcp.stdioHttpSse },
    { label: t.mcp.scope, value: activeTab === "tools" ? t.mcp.toolExplorer : t.mcp.workspaceIntegrations },
  ];

  return (
    <SettingsRouteShell
      activeSettingsItem="mcp"
      title={t.nav.mcpServers}
      description={t.mcp.description}
      badgeLabel={t.mcp.integration}
      contentClassName="flex h-full min-h-0 w-full flex-col"
      icon={(
        <Server className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
      )}
      summary={[
        { label: t.mcp.transport, value: t.mcp.stdioHttpSse },
        { label: t.mcp.scope, value: t.mcp.workspaceIntegrations },
      ]}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <SettingsPageHeader
          title={activeTab === "tools" ? t.mcpTools.title : t.nav.mcpServers}
          metadata={metadata}
          extra={(
            <div className="inline-flex rounded-full border border-desktop-border bg-desktop-bg-primary/60 p-1">
              {tabMeta.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-desktop-bg-secondary text-desktop-text-primary shadow-sm"
                        : "text-desktop-text-secondary hover:bg-desktop-bg-secondary/80 hover:text-desktop-text-primary"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          )}
        />
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          {activeTab === "tools" ? (
            <McpToolsExplorer />
          ) : (
            <div className="border border-desktop-border bg-desktop-bg-secondary/70">
              <McpServersTab />
            </div>
          )}
        </div>
      </div>
    </SettingsRouteShell>
  );
}
