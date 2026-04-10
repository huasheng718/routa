import { execFile as execFileCallback } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isServerlessRuntime(): boolean {
  return !!(
    process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.NETLIFY
    || process.env.FUNCTION_NAME
  );
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeSelectedPath(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function execFileAsync(
  file: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFileCallback(file, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        const execError = error as Error & { stdout?: string; stderr?: string };
        execError.stdout = stdout;
        execError.stderr = stderr;
        reject(execError);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function isDialogCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const execError = error as Error & { code?: number; stderr?: string; stdout?: string };
  const details = `${error.message}\n${execError.stderr ?? ""}\n${execError.stdout ?? ""}`.toLowerCase();
  return execError.code === 1 || details.includes("user canceled");
}

async function pickDirectoryOnMac(title: string, defaultPath?: string): Promise<string | null> {
  const command = [
    "-e",
    defaultPath?.trim()
      ? `set chosenFolder to choose folder with prompt "${escapeAppleScriptString(title)}" default location (POSIX file "${escapeAppleScriptString(defaultPath.trim())}")`
      : `set chosenFolder to choose folder with prompt "${escapeAppleScriptString(title)}"`,
    "-e",
    "POSIX path of chosenFolder",
  ];
  const { stdout } = await execFileAsync("osascript", command, 60_000);
  return normalizeSelectedPath(stdout);
}

async function pickDirectoryOnLinux(title: string, defaultPath?: string): Promise<string | null> {
  const args = ["--file-selection", "--directory", "--title", title];
  if (defaultPath?.trim()) {
    args.push("--filename", defaultPath.trim().replace(/\/?$/, "/"));
  }
  const { stdout } = await execFileAsync("zenity", args, 60_000);
  return normalizeSelectedPath(stdout);
}

async function pickDirectoryOnWindows(title: string, defaultPath?: string): Promise<string | null> {
  const scriptParts = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${escapePowerShellString(title)}'`,
    "$dialog.ShowNewFolderButton = $false",
  ];

  if (defaultPath?.trim()) {
    scriptParts.push(`$dialog.SelectedPath = '${escapePowerShellString(defaultPath.trim())}'`);
  }

  scriptParts.push(
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output $dialog.SelectedPath",
    "}",
  );

  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-STA", "-Command", scriptParts.join("; ")],
    60_000,
  );
  return normalizeSelectedPath(stdout);
}

async function pickDirectory(title: string, defaultPath?: string): Promise<string | null> {
  switch (process.platform) {
    case "darwin":
      return pickDirectoryOnMac(title, defaultPath);
    case "linux":
      return pickDirectoryOnLinux(title, defaultPath);
    case "win32":
      return pickDirectoryOnWindows(title, defaultPath);
    default:
      throw new Error(`Directory picker is not supported on ${process.platform}`);
  }
}

export async function POST(request: NextRequest) {
  if (isServerlessRuntime()) {
    return NextResponse.json(
      { error: "Local directory picker is only available in local Node.js runtime." },
      { status: 501 },
    );
  }

  let title = "Choose Local Project Folder";
  let defaultPath: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim();
    }
    if (typeof body?.defaultPath === "string" && body.defaultPath.trim()) {
      defaultPath = body.defaultPath.trim();
    }
  } catch {
    // ignore invalid JSON body and use defaults
  }

  try {
    const selectedPath = await pickDirectory(title, defaultPath);
    return NextResponse.json({
      cancelled: !selectedPath,
      path: selectedPath,
    });
  } catch (error) {
    if (isDialogCancelled(error)) {
      return NextResponse.json({
        cancelled: true,
        path: null,
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open local directory picker",
      },
      { status: 500 },
    );
  }
}
