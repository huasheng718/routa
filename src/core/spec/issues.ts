import { promises as fsp } from "fs";
import matter from "gray-matter";
import * as path from "path";

export const SPEC_STATUSES = ["open", "investigating", "resolved", "wontfix"] as const;
export const SPEC_KINDS = ["issue", "analysis", "progress_note", "verification_report", "github_mirror"] as const;
export const SPEC_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export const SPEC_ATTACHMENT_CATEGORIES = ["document", "image", "video"] as const;

export const SPEC_ISSUE_MAX_ATTACHMENT_COUNT = 10;
export const SPEC_ISSUE_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES = 200 * 1024 * 1024;

const ALLOWED_DOCUMENT_ATTACHMENT_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".pdf",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
]);
const ALLOWED_IMAGE_ATTACHMENT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]);
const ALLOWED_VIDEO_ATTACHMENT_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

export type SpecStatus = typeof SPEC_STATUSES[number];
export type SpecKind = typeof SPEC_KINDS[number];
export type SpecSeverity = typeof SPEC_SEVERITIES[number];
export type SpecIssueAttachmentCategory = typeof SPEC_ATTACHMENT_CATEGORIES[number];

export type SpecIssueAttachment = {
  filename: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  category: SpecIssueAttachmentCategory;
};

export type SpecIssue = {
  filename: string;
  title: string;
  date: string;
  kind: string;
  status: SpecStatus;
  severity: string;
  area: string;
  tags: string[];
  reportedBy: string;
  relatedIssues: string[];
  githubIssue: number | null;
  githubState: string | null;
  githubUrl: string | null;
  attachments: SpecIssueAttachment[];
  body: string;
  bodyLoaded: boolean;
  surfaceText: string;
};

export type UploadedSpecIssueAttachmentInput = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type CreateSpecIssueInput = {
  title?: unknown;
  body?: unknown;
  date?: unknown;
  kind?: unknown;
  status?: unknown;
  severity?: unknown;
  area?: unknown;
  tags?: unknown;
  reportedBy?: unknown;
  reported_by?: unknown;
  relatedIssues?: unknown;
  related_issues?: unknown;
  attachments?: unknown;
  attachmentNames?: unknown;
};

export class SpecIssueAttachmentValidationError extends Error {}

export class SpecIssueAttachmentTooManyError extends SpecIssueAttachmentValidationError {
  constructor() {
    super(`最多上传 ${SPEC_ISSUE_MAX_ATTACHMENT_COUNT} 个附件。`);
  }
}

export class SpecIssueAttachmentUnsupportedTypeError extends SpecIssueAttachmentValidationError {
  constructor(filename: string) {
    super(`不支持的附件类型：${filename}`);
  }
}

export class SpecIssueAttachmentTooLargeError extends SpecIssueAttachmentValidationError {
  constructor(filename: string) {
    super(`附件过大：${filename}`);
  }
}

export class SpecIssueAttachmentsTotalTooLargeError extends SpecIssueAttachmentValidationError {
  constructor() {
    super(`附件总大小过大，最多 ${formatBytes(SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES)}。`);
  }
}

export function normalizeSpecIssueScalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function shouldIncludeSpecIssueBody(value: string | null): boolean {
  return value !== "false" && value !== "0";
}

export function normalizeSpecIssueFilename(value: string | null): string | null {
  if (!value) return null;
  const normalized = path.basename(value.trim());
  return normalized.endsWith(".md") && normalized !== "_template.md" ? normalized : null;
}

export function contentTypeForSpecIssueAttachment(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"].includes(extension)) {
    return extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : `image/${extension.slice(1)}`;
  }
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export function normalizeSpecIssueAttachmentPath(value: string | null): string | null {
  if (!value) return null;
  const normalized = path.posix.normalize(value.trim().replace(/\\/gu, "/"));
  if (!normalized || normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    return null;
  }
  return normalized.startsWith("assets/") ? normalized : null;
}

export function resolveSpecIssueAttachmentFile(
  repoRoot: string,
  requestedPath: string | null,
): { filePath: string; fileName: string; contentType: string } | null {
  const attachmentPath = normalizeSpecIssueAttachmentPath(requestedPath);
  if (!attachmentPath) return null;

  const issuesDir = path.join(repoRoot, "docs", "issues");
  const assetsDir = path.join(issuesDir, "assets");
  const filePath = path.join(issuesDir, attachmentPath);
  if (!filePath.startsWith(`${assetsDir}${path.sep}`)) {
    return null;
  }

  const fileName = path.basename(filePath);
  return {
    filePath,
    fileName,
    contentType: contentTypeForSpecIssueAttachment(fileName),
  };
}

export async function readSpecIssueAttachment(
  repoRoot: string,
  requestedPath: string | null,
): Promise<{ data: Buffer; fileName: string; contentType: string } | null> {
  const resolved = resolveSpecIssueAttachmentFile(repoRoot, requestedPath);
  if (!resolved) return null;

  try {
    const assetsDir = path.join(repoRoot, "docs", "issues", "assets");
    const [realAssetsDir, realFilePath] = await Promise.all([
      fsp.realpath(assetsDir),
      fsp.realpath(resolved.filePath),
    ]);
    if (realFilePath !== realAssetsDir && !realFilePath.startsWith(`${realAssetsDir}${path.sep}`)) {
      return null;
    }

    const data = await fsp.readFile(realFilePath);
    return {
      data,
      fileName: resolved.fileName,
      contentType: resolved.contentType,
    };
  } catch {
    return null;
  }
}

function normalizeAttachmentCategory(value: unknown): SpecIssueAttachmentCategory {
  const normalized = normalizeSpecIssueScalar(value).toLowerCase();
  return SPEC_ATTACHMENT_CATEGORIES.includes(normalized as SpecIssueAttachmentCategory)
    ? normalized as SpecIssueAttachmentCategory
    : "document";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeSpecIssueScalar(item)).filter(Boolean);
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeSpecIssueScalar(value);
  return normalized.length > 0 ? normalized : null;
}

function toAttachmentArray(value: unknown): SpecIssueAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      filename: normalizeSpecIssueScalar(item.filename),
      originalName: normalizeSpecIssueScalar(item.original_name ?? item.originalName),
      path: normalizeSpecIssueScalar(item.path),
      mimeType: normalizeSpecIssueScalar(item.mime_type ?? item.mimeType),
      size: typeof item.size === "number" && Number.isFinite(item.size)
        ? item.size
        : Number(normalizeSpecIssueScalar(item.size)) || 0,
      category: normalizeAttachmentCategory(item.category),
    }))
    .filter((attachment) => attachment.filename && attachment.path);
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/u.test(value.trim())) {
    return Number(value);
  }

  return null;
}

function normalizeStatus(value: unknown): SpecStatus {
  const normalized = normalizeSpecIssueScalar(value).toLowerCase();
  if (normalized === "closed") return "resolved";
  return SPEC_STATUSES.includes(normalized as SpecStatus) ? normalized as SpecStatus : "open";
}

function normalizeKind(value: unknown): SpecKind {
  const normalized = normalizeSpecIssueScalar(value).toLowerCase();
  return SPEC_KINDS.includes(normalized as SpecKind) ? normalized as SpecKind : "issue";
}

function normalizeSeverity(value: unknown): SpecSeverity {
  const normalized = normalizeSpecIssueScalar(value).toLowerCase();
  return SPEC_SEVERITIES.includes(normalized as SpecSeverity) ? normalized as SpecSeverity : "medium";
}

function normalizeIssueDate(value: unknown): string {
  const normalized = normalizeSpecIssueScalar(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : new Date().toISOString().slice(0, 10);
}

function buildSurfaceText(content: string): string {
  const lines = content.split(/\r?\n/u);
  const relevant = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("#")
      || /`(?:src|docs|crates|apps|resources)\//u.test(trimmed)
      || /\b(?:src|docs|crates|apps|resources)\/[^\s`),]+/u.test(trimmed)
      || /\/api\/[^\s`),]+/u.test(trimmed)
      || /\/(?:workspace|settings|messages|traces|debug|mcp-tools|a2a|ag-ui)[^\s`),]*/u.test(trimmed);
  });

  return relevant.join("\n").slice(0, 4_000);
}

function toDelimitedStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSpecIssueScalar(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,，\n]/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80)
    .replace(/^-+|-+$/gu, "");

  return slug || "demand";
}

function sanitizeAttachmentFilename(filename: string): string {
  const parsed = path.parse(path.basename(filename || "attachment"));
  const base = slugifyTitle(parsed.name || "attachment").slice(0, 64) || "attachment";
  const ext = parsed.ext
    .toLowerCase()
    .replace(/[^a-z0-9.]/gu, "")
    .slice(0, 16);
  return `${base}${ext}`;
}

function attachmentExtension(file: UploadedSpecIssueAttachmentInput, fallbackName?: string): string {
  return path.extname(fallbackName || file.name).toLowerCase();
}

export function isAllowedUploadedSpecIssueAttachment(
  file: UploadedSpecIssueAttachmentInput,
  fallbackName?: string,
): boolean {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return true;
  }

  const extension = attachmentExtension(file, fallbackName);
  return ALLOWED_DOCUMENT_ATTACHMENT_EXTENSIONS.has(extension)
    || ALLOWED_IMAGE_ATTACHMENT_EXTENSIONS.has(extension)
    || ALLOWED_VIDEO_ATTACHMENT_EXTENSIONS.has(extension);
}

function inferAttachmentCategory(file: UploadedSpecIssueAttachmentInput): SpecIssueAttachmentCategory {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  const extension = attachmentExtension(file);
  if (ALLOWED_IMAGE_ATTACHMENT_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (ALLOWED_VIDEO_ATTACHMENT_EXTENSIONS.has(extension)) {
    return "video";
  }
  return "document";
}

export function isUploadedSpecIssueAttachment(value: unknown): value is UploadedSpecIssueAttachmentInput {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
    && typeof (value as { name?: unknown }).name === "string"
    && typeof (value as { size?: unknown }).size === "number";
}

function buildAttachmentMarkdown(attachments: SpecIssueAttachment[]): string {
  if (attachments.length === 0) {
    return "";
  }

  return [
    "## 附件",
    "",
    ...attachments.map((attachment) => (
      `- [${attachment.originalName || attachment.filename}](./${attachment.path})`
    )),
  ].join("\n");
}

function appendAttachmentMarkdown(body: string, attachments: SpecIssueAttachment[]): string {
  const attachmentMarkdown = buildAttachmentMarkdown(attachments);
  if (!attachmentMarkdown) {
    return body;
  }

  return [body.trim(), attachmentMarkdown].filter(Boolean).join("\n\n");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function validateUploadedSpecIssueAttachments(
  files: UploadedSpecIssueAttachmentInput[],
  attachmentNames: string[],
) {
  if (files.length > SPEC_ISSUE_MAX_ATTACHMENT_COUNT) {
    throw new SpecIssueAttachmentTooManyError();
  }

  const unsupported = files.find((file, index) => !isAllowedUploadedSpecIssueAttachment(file, attachmentNames[index]));
  if (unsupported) {
    const unsupportedIndex = files.indexOf(unsupported);
    throw new SpecIssueAttachmentUnsupportedTypeError(attachmentNames[unsupportedIndex] || unsupported.name);
  }

  const oversized = files.find((file) => file.size > SPEC_ISSUE_MAX_ATTACHMENT_BYTES);
  if (oversized) {
    throw new SpecIssueAttachmentTooLargeError(oversized.name);
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > SPEC_ISSUE_MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new SpecIssueAttachmentsTotalTooLargeError();
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === "object" && "code" in error;
}

async function reserveIssueFilename(
  issuesDir: string,
  title: string,
  date: string,
): Promise<string> {
  const slug = slugifyTitle(title);
  let counter = 1;

  while (true) {
    const filename = counter === 1 ? `${date}-${slug}.md` : `${date}-${slug}-${counter}.md`;
    try {
      await fsp.writeFile(path.join(issuesDir, filename), "", {
        encoding: "utf-8",
        flag: "wx",
      });
      return filename;
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") {
        counter += 1;
        continue;
      }
      throw error;
    }
  }
}

export async function parseSpecIssueFile(
  issuesDir: string,
  filename: string,
  includeBody: boolean,
): Promise<SpecIssue | null> {
  const fullPath = path.join(issuesDir, filename);
  const raw = await fsp.readFile(fullPath, "utf-8");
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    return null;
  }

  const { data, content } = matter(raw);
  const title = normalizeSpecIssueScalar(data.title) || filename.replace(/\.md$/, "");
  const kind = normalizeSpecIssueScalar(data.kind).toLowerCase() || "issue";
  const severity = normalizeSpecIssueScalar(data.severity).toLowerCase() || "medium";
  const body = content.trim();

  return {
    filename,
    title,
    date: normalizeSpecIssueScalar(data.date),
    kind,
    status: normalizeStatus(data.status),
    severity,
    area: normalizeSpecIssueScalar(data.area),
    tags: toStringArray(data.tags),
    reportedBy: normalizeSpecIssueScalar(data.reported_by),
    relatedIssues: toStringArray(data.related_issues),
    githubIssue: toNullableNumber(data.github_issue),
    githubState: toNullableString(data.github_state),
    githubUrl: toNullableString(data.github_url),
    attachments: toAttachmentArray(data.attachments),
    body: includeBody ? body : "",
    bodyLoaded: includeBody,
    surfaceText: buildSurfaceText(body),
  };
}

export async function listSpecIssues(
  repoRoot: string,
  options: { includeBody: boolean },
): Promise<SpecIssue[]> {
  const issuesDir = path.join(repoRoot, "docs", "issues");
  const entries = await fsp.readdir(issuesDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "_template.md")
    .sort((a, b) => b.name.localeCompare(a.name));

  const issues: SpecIssue[] = [];
  for (const entry of mdFiles) {
    try {
      const issue = await parseSpecIssueFile(issuesDir, entry.name, options.includeBody);
      if (issue) issues.push(issue);
    } catch {
      // Skip malformed files so one bad tracker does not hide the rest.
    }
  }

  return issues;
}

export async function getSpecIssue(
  repoRoot: string,
  filename: string,
): Promise<SpecIssue | null> {
  try {
    return await parseSpecIssueFile(path.join(repoRoot, "docs", "issues"), filename, true);
  } catch {
    return null;
  }
}

export async function specIssuesDirExists(repoRoot: string): Promise<boolean> {
  try {
    await fsp.access(path.join(repoRoot, "docs", "issues"));
    return true;
  } catch {
    return false;
  }
}

export async function createSpecIssue(
  repoRoot: string,
  input: CreateSpecIssueInput,
): Promise<SpecIssue | null> {
  const title = normalizeSpecIssueScalar(input.title);
  const issuesDir = path.join(repoRoot, "docs", "issues");
  const date = normalizeIssueDate(input.date);
  const issueBody = normalizeSpecIssueScalar(input.body);
  const attachmentFiles = Array.isArray(input.attachments)
    ? input.attachments.filter((file): file is UploadedSpecIssueAttachmentInput => (
      isUploadedSpecIssueAttachment(file) && file.size > 0
    ))
    : [];
  const attachmentNames = Array.isArray(input.attachmentNames)
    ? input.attachmentNames.map((name) => normalizeSpecIssueScalar(name))
    : [];
  const metadata = {
    title,
    date,
    kind: normalizeKind(input.kind),
    status: normalizeStatus(input.status),
    severity: normalizeSeverity(input.severity),
    area: normalizeSpecIssueScalar(input.area),
    tags: toDelimitedStringArray(input.tags),
    reported_by: normalizeSpecIssueScalar(input.reportedBy) || normalizeSpecIssueScalar(input.reported_by) || "human",
    related_issues: toDelimitedStringArray(input.relatedIssues ?? input.related_issues),
    github_issue: null,
    github_state: null,
    github_url: null,
  };

  await fsp.mkdir(issuesDir, { recursive: true });
  validateUploadedSpecIssueAttachments(attachmentFiles, attachmentNames);
  const filename = await reserveIssueFilename(issuesDir, title, date);
  const issueSlug = filename.replace(/\.md$/u, "");
  const issuePath = path.join(issuesDir, filename);
  const attachmentDir = path.join(issuesDir, "assets", issueSlug);
  const attachments: SpecIssueAttachment[] = [];
  try {
    for (const [index, file] of attachmentFiles.entries()) {
      await fsp.mkdir(attachmentDir, { recursive: true });
      const originalName = attachmentNames[index] || file.name;
      const baseFilename = sanitizeAttachmentFilename(originalName);
      let attachmentFilename = baseFilename;
      let counter = 2;
      while (await fileExists(path.join(attachmentDir, attachmentFilename))) {
        const parsed = path.parse(baseFilename);
        attachmentFilename = `${parsed.name}-${counter}${parsed.ext}`;
        counter += 1;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await fsp.writeFile(path.join(attachmentDir, attachmentFilename), buffer);
      attachments.push({
        filename: attachmentFilename,
        originalName,
        path: `assets/${issueSlug}/${attachmentFilename}`,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category: inferAttachmentCategory(file),
      });
    }

    const content = matter.stringify(appendAttachmentMarkdown(issueBody, attachments), {
      ...metadata,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        original_name: attachment.originalName,
        path: attachment.path,
        mime_type: attachment.mimeType,
        size: attachment.size,
        category: attachment.category,
      })),
    });
    await fsp.writeFile(issuePath, content, "utf-8");
  } catch (error) {
    await Promise.all([
      fsp.rm(issuePath, { force: true }).catch(() => undefined),
      fsp.rm(attachmentDir, { recursive: true, force: true }).catch(() => undefined),
    ]);
    throw error;
  }

  return parseSpecIssueFile(issuesDir, filename, true);
}
