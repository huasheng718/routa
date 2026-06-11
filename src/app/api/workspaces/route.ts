/**
 * /api/workspaces - REST API for workspace management.
 *
 * GET    /api/workspaces?status=active|archived  → List workspaces
 * POST   /api/workspaces                         → Create a workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { createWorkspace, getEffectiveWorkspaceMetadata, WorkspaceStatus } from "@/core/models/workspace";

export const dynamic = "force-dynamic";

function serializeWorkspace(workspace: { id: string; title: string; status: WorkspaceStatus; metadata: Record<string, string>; createdAt: Date; updatedAt: Date; }) {
  return {
    ...workspace,
    metadata: getEffectiveWorkspaceMetadata(workspace),
  };
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") as WorkspaceStatus | null;
  const system = getRoutaSystem();

  const workspaces = status
    ? await system.workspaceStore.listByStatus(status)
    : await system.workspaceStore.list();

  return NextResponse.json({ workspaces: workspaces.map(serializeWorkspace) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { title } = body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const system = getRoutaSystem();
  const workspace = createWorkspace({
    id: crypto.randomUUID(),
    title: title.trim(),
  });

  await system.workspaceStore.save(workspace);

  return NextResponse.json({ workspace: serializeWorkspace(workspace) }, { status: 201 });
}
