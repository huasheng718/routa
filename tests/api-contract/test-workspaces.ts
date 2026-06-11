/**
 * Workspace API contract tests.
 *
 * Tests the /api/workspaces endpoints against whichever backend is running.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  api,
  assert,
  assertStatus,
  assertHasField,
  assertArrayField,
  assertEnum,
  assertMatchesOperationRequest,
  assertMatchesOperationResponse,
  type TestResult,
} from "./helpers";

export async function testWorkspaces(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let createdId = "";
  let createdCodebaseId = "";
  let tempRepo = "";

  function ensureTempGitRepo(): string {
    if (tempRepo) return tempRepo;
    tempRepo = mkdtempSync(join(tmpdir(), "routa-contract-codebase-"));
    execFileSync("git", ["init"], { cwd: tempRepo, stdio: "ignore" });
    return tempRepo;
  }

  try {
    // ── GET /api/workspaces — list ──
    results.push(
      await runTest("GET /api/workspaces — list workspaces", async () => {
        const { status, data } = await api("GET", "/api/workspaces");
        assertStatus(status, 200);
        const d = data as Record<string, unknown>;
        assertArrayField(d, "workspaces");
      }),
    );

    // ── POST /api/workspaces — create ──
    results.push(
      await runTest("POST /api/workspaces — create workspace", async () => {
        const request = {
          title: "Test Workspace",
          metadata: { source: "api-contract" },
        };
        assertMatchesOperationRequest("createWorkspace", request);
        const { status, data } = await api("POST", "/api/workspaces", {
          ...request,
        });
        assert(
          status === 200 || status === 201,
          `Expected 200 or 201, got ${status}`,
        );
        assertMatchesOperationResponse("createWorkspace", status, data);
        const d = data as Record<string, unknown>;
        assertHasField(d, "workspace");
        const ws = d.workspace as Record<string, unknown>;
        assert(ws.title === "Test Workspace", "Title should match");
        assertEnum(ws.status as string, ["active", "archived"], "status");
        assert(typeof ws.id === "string" && ws.id.length > 0, "Should have id");
        createdId = ws.id as string;
      }),
    );

    // ── GET /api/workspaces/{id} — get single ──
    results.push(
      await runTest("GET /api/workspaces/{id} — get workspace", async () => {
        if (!createdId) throw new Error("Depends on create test");
        const { status, data } = await api(
          "GET",
          `/api/workspaces/${createdId}`,
        );
        assertStatus(status, 200);
        assertMatchesOperationResponse("getWorkspace", status, data);
        const d = data as Record<string, unknown>;
        assertHasField(d, "workspace");
        assertArrayField(d, "codebases");
        const ws = d.workspace as Record<string, unknown>;
        assert(ws.id === createdId, "ID should match");
        assert(ws.title === "Test Workspace", "Title should match");
      }),
    );

    // ── POST /api/workspaces/{id}/codebases — add codebase ──
    results.push(
      await runTest(
        "POST /api/workspaces/{id}/codebases — add codebase",
        async () => {
          if (!createdId) throw new Error("Depends on create test");
          const repoPath = ensureTempGitRepo();
          const request = {
            repoPath,
            branch: "main",
            label: "Contract Repo",
            isDefault: true,
            sourceType: "local",
          };
          assertMatchesOperationRequest("addWorkspaceCodebase", request);
          const { status, data } = await api(
            "POST",
            `/api/workspaces/${createdId}/codebases`,
            request,
          );
          assertStatus(status, 201);
          assertMatchesOperationResponse("addWorkspaceCodebase", status, data);
          const d = data as Record<string, unknown>;
          assertHasField(d, "codebase");
          const codebase = d.codebase as Record<string, unknown>;
          assert(
            typeof codebase.id === "string" && codebase.id.length > 0,
            "Should have codebase id",
          );
          assert(
            codebase.workspaceId === createdId,
            "Codebase workspaceId should match",
          );
          assert(
            typeof codebase.repoPath === "string" &&
              codebase.repoPath.length > 0,
            "Should return repoPath",
          );
          assert(
            codebase.label === "Contract Repo",
            "Codebase label should match",
          );
          assert(
            codebase.isDefault === true,
            "First codebase should be default",
          );
          createdCodebaseId = codebase.id as string;
        },
      ),
    );

    // ── GET /api/workspaces/{id}/codebases — list codebases ──
    results.push(
      await runTest(
        "GET /api/workspaces/{id}/codebases — list codebases",
        async () => {
          if (!createdId || !createdCodebaseId)
            throw new Error("Depends on add codebase test");
          const { status, data } = await api(
            "GET",
            `/api/workspaces/${createdId}/codebases`,
          );
          assertStatus(status, 200);
          assertMatchesOperationResponse(
            "listWorkspaceCodebases",
            status,
            data,
          );
          const d = data as Record<string, unknown>;
          assertArrayField(d, "codebases");
          const codebases = d.codebases as Array<Record<string, unknown>>;
          assert(
            codebases.some((codebase) => codebase.id === createdCodebaseId),
            "Created codebase should be listed",
          );
        },
      ),
    );

    // ── GET /api/workspaces/{id} — not found ──
    results.push(
      await runTest("GET /api/workspaces/{id} — 404 for missing", async () => {
        const { status } = await api(
          "GET",
          "/api/workspaces/nonexistent-id-12345",
        );
        assertStatus(status, 404);
      }),
    );

    // ── DELETE /api/workspaces/{id} — delete ──
    results.push(
      await runTest(
        "DELETE /api/workspaces/{id} — delete workspace",
        async () => {
          if (!createdId) throw new Error("Depends on create test");
          const { status, data } = await api(
            "DELETE",
            `/api/workspaces/${createdId}`,
          );
          assertStatus(status, 200);
          const d = data as Record<string, unknown>;
          assert(d.deleted === true, "Should return deleted: true");
        },
      ),
    );

    return results;
  } finally {
    if (tempRepo) {
      rmSync(tempRepo, { recursive: true, force: true });
    }
  }
}

async function runTest(
  name: string,
  fn: () => Promise<void>,
): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (err) {
    return {
      name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}
