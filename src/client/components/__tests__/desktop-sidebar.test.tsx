import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import zh from "@/i18n/locales/zh";

const pathnameState = vi.hoisted(() => ({
  pathname: "/workspace/default/kanban",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.pathname,
}));

import { DesktopSidebar } from "../desktop-sidebar";

describe("DesktopSidebar", () => {
  it("keeps Home, Sessions, Kanban, Requirements, and Team in the primary navigation", () => {
    render(<DesktopSidebar workspaceId="default" />);

    const links = screen.getAllByRole("link").slice(0, 5);
    expect(links.map((link) => link.textContent)).toEqual([
      zh.nav.home,
      zh.nav.sessions,
      zh.nav.kanban,
      zh.nav.spec,
      zh.nav.team,
    ]);

    expect(screen.getByRole("link", { name: zh.nav.sessions }).getAttribute("href")).toBe("/workspace/default/sessions");
    expect(screen.getByRole("link", { name: zh.nav.kanban }).getAttribute("href")).toBe("/workspace/default/kanban");
    expect(screen.getByRole("link", { name: zh.nav.spec }).getAttribute("href")).toBe("/workspace/default/spec");
    expect(screen.getByRole("link", { name: zh.nav.team }).getAttribute("href")).toBe("/workspace/default/team");
  });

  it("keeps Harness and Fluency in the lower menu and uses a direct settings link", () => {
    render(<DesktopSidebar workspaceId="default" />);

    expect(screen.queryByRole("link", { name: "MCP Servers" })).toBeNull();
    expect(screen.getByRole("link", { name: zh.nav.harness }).getAttribute("href")).toBe("/settings/harness?workspaceId=default");
    expect(screen.getByRole("link", { name: zh.nav.fluency }).getAttribute("href")).toBe("/settings/fluency?workspaceId=default");
    expect(screen.getByRole("link", { name: zh.settings.title }).getAttribute("href")).toBe("/settings?workspaceId=default");
    expect(screen.queryByRole("button", { name: zh.settings.title })).toBeNull();
  });

  it("does not mark Settings as active when a settings tool page is active", () => {
    pathnameState.pathname = "/settings/harness";

    render(<DesktopSidebar workspaceId="default" />);

    expect(screen.getByRole("link", { name: zh.nav.harness }).className).toContain("text-desktop-accent");
    expect(screen.getByRole("link", { name: zh.settings.title }).className).not.toContain("text-desktop-accent");
  });

  it("shows a collapse icon when expanded and an expand icon when collapsed", () => {
    const { rerender } = render(<DesktopSidebar workspaceId="default" collapsed={false} />);

    const expandedToggle = screen.getByRole("button", { name: zh.nav.closeSidebar });
    expect(expandedToggle.querySelector("path")?.getAttribute("d")).toBe(
      "M13.5 4.5 6 12l7.5 7.5M18 4.5 10.5 12 18 19.5",
    );

    rerender(<DesktopSidebar workspaceId="default" collapsed />);

    const collapsedToggle = screen.getByRole("button", { name: zh.nav.openSidebar });
    expect(collapsedToggle.querySelector("path")?.getAttribute("d")).toBe(
      "M10.5 4.5 18 12l-7.5 7.5M6 4.5 13.5 12 6 19.5",
    );
  });
});
