import { NextRequest, NextResponse } from "next/server";
import {
  type FitnessContext,
  isFitnessContextError,
  normalizeFitnessContextValue,
  resolveFitnessRepoRoot,
} from "@/core/fitness/repo-root";
import {
  normalizeSpecIssueAttachmentPath,
  readSpecIssueAttachment,
} from "@/core/spec/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseContext(searchParams: URLSearchParams): FitnessContext {
  return {
    workspaceId: normalizeFitnessContextValue(searchParams.get("workspaceId")),
    codebaseId: normalizeFitnessContextValue(searchParams.get("codebaseId")),
    repoPath: normalizeFitnessContextValue(searchParams.get("repoPath")),
  };
}

export async function GET(request: NextRequest) {
  const context = parseContext(request.nextUrl.searchParams);
  const attachmentPath = normalizeSpecIssueAttachmentPath(request.nextUrl.searchParams.get("path"));
  if (!attachmentPath) {
    return NextResponse.json({ error: "附件路径不能为空" }, { status: 400 });
  }

  let repoRoot: string;
  try {
    repoRoot = await resolveFitnessRepoRoot(context, {
      preferCurrentRepoForDefaultWorkspace: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isFitnessContextError(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const attachment = await readSpecIssueAttachment(repoRoot, attachmentPath);
  if (attachment) {
    return new NextResponse(Uint8Array.from(attachment.data), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Content-Type": attachment.contentType,
      },
    });
  }

  return NextResponse.json({ error: "未找到附件" }, { status: 404 });
}
