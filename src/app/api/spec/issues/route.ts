import { NextRequest, NextResponse } from "next/server";
import {
  type FitnessContext,
  isFitnessContextError,
  normalizeFitnessContextValue,
  resolveFitnessRepoRoot,
} from "@/core/fitness/repo-root";
import {
  createSpecIssue,
  getSpecIssue,
  isUploadedSpecIssueAttachment,
  listSpecIssues,
  normalizeSpecIssueFilename,
  normalizeSpecIssueScalar,
  shouldIncludeSpecIssueBody,
  specIssuesDirExists,
  SpecIssueAttachmentTooLargeError,
  type UploadedSpecIssueAttachmentInput,
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

function parseContextFromBody(searchParams: URLSearchParams, body: Record<string, unknown>): FitnessContext {
  return {
    workspaceId: normalizeFitnessContextValue(body.workspaceId) ?? normalizeFitnessContextValue(searchParams.get("workspaceId")),
    codebaseId: normalizeFitnessContextValue(body.codebaseId) ?? normalizeFitnessContextValue(searchParams.get("codebaseId")),
    repoPath: normalizeFitnessContextValue(body.repoPath) ?? normalizeFitnessContextValue(searchParams.get("repoPath")),
  };
}

async function readCreateIssueInput(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return null;
    }

    const input: Record<string, unknown> = {};
    const attachments: UploadedSpecIssueAttachmentInput[] = [];
    const attachmentNames: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "attachments" && isUploadedSpecIssueAttachment(value)) {
        attachments.push(value);
      } else if (key === "attachmentNames" && typeof value === "string") {
        attachmentNames.push(value);
      } else if (typeof value === "string") {
        input[key] = value;
      }
    }
    input.attachments = attachments;
    input.attachmentNames = attachmentNames;
    return input;
  }

  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

export async function GET(request: NextRequest) {
  const context = parseContext(request.nextUrl.searchParams);
  const includeBody = shouldIncludeSpecIssueBody(request.nextUrl.searchParams.get("includeBody"));
  const requestedFilename = normalizeSpecIssueFilename(request.nextUrl.searchParams.get("filename"));

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

  if (!await specIssuesDirExists(repoRoot)) {
    return NextResponse.json({ issues: [], repoRoot });
  }

  if (requestedFilename) {
    const issue = await getSpecIssue(repoRoot, requestedFilename);
    if (!issue) {
      return NextResponse.json({ error: "未找到需求记录" }, { status: 404 });
    }
    return NextResponse.json({ issue, repoRoot });
  }

  const issues = await listSpecIssues(repoRoot, { includeBody });
  return NextResponse.json({ issues, repoRoot });
}

export async function POST(request: NextRequest) {
  const input = await readCreateIssueInput(request);
  if (!input) {
    return NextResponse.json({ error: "请求内容无效" }, { status: 400 });
  }

  const title = normalizeSpecIssueScalar(input.title);
  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  const context = parseContextFromBody(request.nextUrl.searchParams, input);

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

  try {
    const issue = await createSpecIssue(repoRoot, { ...input, title });
    return NextResponse.json({ issue, repoRoot }, { status: 201 });
  } catch (error) {
    if (error instanceof SpecIssueAttachmentTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "创建需求记录失败", details: message }, { status: 500 });
  }
}
