use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use reqwest::multipart::{Form, Part};
use reqwest::StatusCode;
use serde_json::{json, Value};
use tempfile::TempDir;

#[path = "common/mod.rs"]
mod common;
use common::ApiFixture;

struct GitRepoFixture {
    _temp: TempDir,
    repo_path: PathBuf,
}

impl GitRepoFixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let repo_path = temp.path().join("repo");
        fs::create_dir_all(&repo_path).expect("repo dir should exist");

        run_git(&repo_path, &["init", "--no-bare", "-b", "main"]);
        run_git(&repo_path, &["config", "user.name", "Routa Test"]);
        run_git(
            &repo_path,
            &["config", "user.email", "routa-test@example.com"],
        );
        write_file(&repo_path, "README.md", "# Codebase Fixture\n");
        write_file(&repo_path, "src/lib.rs", "pub fn parity_fixture() {}\n");
        run_git(&repo_path, &["add", "README.md", "src/lib.rs"]);
        run_git(&repo_path, &["commit", "-m", "chore: initial repo fixture"]);

        Self {
            _temp: temp,
            repo_path,
        }
    }
}

fn run_git(repo_path: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"])
        .args(args)
        .current_dir(repo_path)
        .output()
        .unwrap_or_else(|error| panic!("git {args:?} failed to start: {error}"));

    if !output.status.success() {
        panic!(
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn write_file(repo_path: &Path, relative_path: &str, content: &str) {
    let path = repo_path.join(relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("parent directory should exist");
    }
    fs::write(path, content).expect("file should be written");
}

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("workspace root")
        .to_path_buf()
}

fn json_has_error(resp: &Value, expected: &str) -> bool {
    resp.get("error")
        .and_then(Value::as_str)
        .is_some_and(|message| message.contains(expected))
}

#[tokio::test]
async fn api_spec_issue_create_json_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");

    let response = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .json(&json!({
            "repoPath": repo_root.path().to_string_lossy().to_string(),
            "title": "需求管理支持桌面新建",
            "date": "2026-05-02",
            "body": "# 需求管理支持桌面新建\n\n涉及 `src/app/workspace/[workspaceId]/spec` 和 /api/spec/issues。",
            "status": "closed",
            "kind": "issue",
            "severity": "high",
            "area": "spec",
            "tags": "桌面,需求\n附件",
            "reportedBy": "human",
            "relatedIssues": "GH-1，GH-2"
        }))
        .send()
        .await
        .expect("create spec issue");

    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: Value = response.json().await.expect("decode create response");
    assert_eq!(
        payload["repoRoot"],
        json!(repo_root.path().to_string_lossy().to_string())
    );
    assert_eq!(payload["issue"]["title"], json!("需求管理支持桌面新建"));
    assert_eq!(payload["issue"]["date"], json!("2026-05-02"));
    assert_eq!(payload["issue"]["status"], json!("resolved"));
    assert_eq!(payload["issue"]["severity"], json!("high"));
    assert_eq!(payload["issue"]["reportedBy"], json!("human"));
    assert_eq!(payload["issue"]["tags"], json!(["桌面", "需求", "附件"]));
    assert_eq!(payload["issue"]["relatedIssues"], json!(["GH-1", "GH-2"]));
    assert_eq!(payload["issue"]["bodyLoaded"], json!(true));
    assert!(payload["issue"]["surfaceText"]
        .as_str()
        .is_some_and(|surface| surface.contains("/api/spec/issues")));

    let filename = payload["issue"]["filename"]
        .as_str()
        .expect("created filename");
    assert!(repo_root
        .path()
        .join("docs")
        .join("issues")
        .join(filename)
        .exists());

    let duplicate = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .json(&json!({
            "repoPath": repo_root.path().to_string_lossy().to_string(),
            "title": "需求管理支持桌面新建",
            "date": "2026-05-02"
        }))
        .send()
        .await
        .expect("create duplicate spec issue");
    assert_eq!(duplicate.status(), StatusCode::CREATED);
    let duplicate_payload: Value = duplicate.json().await.expect("decode duplicate response");
    let duplicate_filename = duplicate_payload["issue"]["filename"]
        .as_str()
        .expect("duplicate filename");
    assert_ne!(duplicate_filename, filename);
    assert!(duplicate_filename.ends_with("-2.md"));

    let list_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues"))
        .query(&[
            ("repoPath", repo_root.path().to_string_lossy().to_string()),
            ("includeBody", "false".to_string()),
        ])
        .send()
        .await
        .expect("list created spec issues");
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_payload: Value = list_response.json().await.expect("decode list response");
    let first_issue = &list_payload["issues"].as_array().expect("issues array")[0];
    assert_eq!(first_issue["body"], json!(""));
    assert_eq!(first_issue["bodyLoaded"], json!(false));
}

#[tokio::test]
async fn api_spec_issue_create_concurrent_same_title_does_not_overwrite() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let repo_path = repo_root.path().to_string_lossy().to_string();
    let endpoint = fixture.endpoint("/api/spec/issues");

    let first = fixture.client.post(&endpoint).json(&json!({
        "repoPath": repo_path,
        "title": "并发创建同名需求",
        "date": "2026-05-04",
        "body": "来自第一个请求"
    }));
    let second = fixture.client.post(&endpoint).json(&json!({
        "repoPath": repo_root.path().to_string_lossy().to_string(),
        "title": "并发创建同名需求",
        "date": "2026-05-04",
        "body": "来自第二个请求"
    }));

    let (first_response, second_response) = tokio::join!(first.send(), second.send());
    let first_response = first_response.expect("first concurrent create");
    let second_response = second_response.expect("second concurrent create");
    assert_eq!(first_response.status(), StatusCode::CREATED);
    assert_eq!(second_response.status(), StatusCode::CREATED);

    let first_payload: Value = first_response.json().await.expect("decode first");
    let second_payload: Value = second_response.json().await.expect("decode second");
    let first_filename = first_payload["issue"]["filename"]
        .as_str()
        .expect("first filename");
    let second_filename = second_payload["issue"]["filename"]
        .as_str()
        .expect("second filename");

    assert_ne!(first_filename, second_filename);
    let issues_dir = repo_root.path().join("docs").join("issues");
    let first_markdown =
        fs::read_to_string(issues_dir.join(first_filename)).expect("first issue markdown");
    let second_markdown =
        fs::read_to_string(issues_dir.join(second_filename)).expect("second issue markdown");
    assert!(
        first_markdown.contains("来自第一个请求") || second_markdown.contains("来自第一个请求"),
        "one persisted issue should contain the first body"
    );
    assert!(
        first_markdown.contains("来自第二个请求") || second_markdown.contains("来自第二个请求"),
        "one persisted issue should contain the second body"
    );
}

#[tokio::test]
async fn api_spec_issue_create_multipart_attachment_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let form = Form::new()
        .text("title", "带附件的需求")
        .text("date", "2026-05-03")
        .text("body", "需要沉淀附件材料。")
        .text("area", "spec")
        .text("tags", "附件,素材")
        .part(
            "attachments",
            Part::bytes(b"image-bytes".to_vec())
                .file_name("flow.png")
                .mime_str("image/png")
                .expect("valid image mime"),
        )
        .text("attachmentNames", "流程 图.png")
        .part(
            "attachments",
            Part::bytes(b"video-bytes".to_vec())
                .file_name("demo.mp4")
                .mime_str("video/mp4")
                .expect("valid video mime"),
        )
        .text("attachmentNames", "演示.mp4")
        .part(
            "attachments",
            Part::bytes(b"doc-bytes".to_vec())
                .file_name("brief.docx")
                .mime_str("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .expect("valid doc mime"),
        )
        .text("attachmentNames", "说明.docx");

    let response = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .multipart(form)
        .send()
        .await
        .expect("create spec issue with attachments");

    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: Value = response.json().await.expect("decode multipart response");
    let attachments = payload["issue"]["attachments"]
        .as_array()
        .expect("attachments array");
    assert_eq!(attachments.len(), 3);
    assert_eq!(attachments[0]["category"], json!("image"));
    assert_eq!(attachments[1]["category"], json!("video"));
    assert_eq!(attachments[2]["category"], json!("document"));
    assert!(payload["issue"]["body"]
        .as_str()
        .is_some_and(|body| body.contains("## 附件") && body.contains("流程 图.png")));

    for attachment in attachments {
        let path = attachment["path"].as_str().expect("attachment path");
        assert!(repo_root
            .path()
            .join("docs")
            .join("issues")
            .join(path)
            .exists());
    }

    let first_path = attachments[0]["path"].as_str().expect("first path");
    let asset_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues/assets"))
        .query(&[
            ("repoPath", repo_root.path().to_string_lossy().to_string()),
            ("path", first_path.to_string()),
        ])
        .send()
        .await
        .expect("read created attachment");
    assert_eq!(asset_response.status(), StatusCode::OK);
    assert_eq!(
        asset_response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("image/png")
    );
    let asset_body = asset_response.bytes().await.expect("asset bytes");
    assert_eq!(&asset_body[..], b"image-bytes");
}

#[tokio::test]
async fn api_spec_issue_create_rejects_invalid_input() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");

    let empty_title = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .json(&json!({
            "repoPath": repo_root.path().to_string_lossy().to_string(),
            "title": "  "
        }))
        .send()
        .await
        .expect("create issue with empty title");
    assert_eq!(empty_title.status(), StatusCode::BAD_REQUEST);
    let empty_title_payload: Value = empty_title.json().await.expect("decode empty title");
    assert!(json_has_error(&empty_title_payload, "标题不能为空"));

    let invalid_json = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .header("content-type", "application/json")
        .body("{")
        .send()
        .await
        .expect("create issue with invalid json");
    assert_eq!(invalid_json.status(), StatusCode::BAD_REQUEST);
    let invalid_json_payload: Value = invalid_json.json().await.expect("decode invalid json");
    assert!(json_has_error(&invalid_json_payload, "请求内容无效"));

    let oversized_form = Form::new().text("title", "过大的附件").part(
        "attachments",
        Part::bytes(vec![b'x'; 50 * 1024 * 1024 + 1])
            .file_name("huge.bin")
            .mime_str("application/octet-stream")
            .expect("valid mime"),
    );
    let oversized = fixture
        .client
        .post(fixture.endpoint("/api/spec/issues"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .multipart(oversized_form)
        .send()
        .await
        .expect("create issue with oversized attachment");
    assert_eq!(oversized.status(), StatusCode::BAD_REQUEST);
    let oversized_payload: Value = oversized.json().await.expect("decode oversized");
    assert!(json_has_error(&oversized_payload, "附件过大"));
}

#[tokio::test]
async fn api_spec_issues_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let issues_dir = repo_root.path().join("docs").join("issues");

    fs::create_dir_all(&issues_dir).expect("issues dir");
    fs::write(
        issues_dir.join("2026-04-11-spec-board.md"),
        r#"---
title: "Spec board"
date: 2026-04-11
kind: progress_note
status: closed
severity: high
area: ui
tags: ["spec", "board"]
reported_by: codex
related_issues: ["https://github.com/phodal/routa/issues/410"]
github_issue: "410"
github_state: closed
github_url: "https://github.com/phodal/routa/issues/410"
---

# Spec board

Rendered as markdown.
"#,
    )
    .expect("write issue file");
    fs::write(
        issues_dir.join("2026-04-10-malformed.md"),
        "not frontmatter",
    )
    .expect("write malformed file");

    let success_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .send()
        .await
        .expect("list spec issues");
    assert_eq!(success_response.status(), StatusCode::OK);

    let success_json: Value = success_response
        .json()
        .await
        .expect("decode spec issues response");
    assert_eq!(
        success_json["repoRoot"],
        json!(repo_root.path().to_string_lossy().to_string())
    );
    let issues = success_json["issues"].as_array().expect("issues array");
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0]["title"], json!("Spec board"));
    assert_eq!(issues[0]["date"], json!("2026-04-11"));
    assert_eq!(issues[0]["status"], json!("resolved"));
    assert_eq!(issues[0]["kind"], json!("progress_note"));
    assert_eq!(issues[0]["githubIssue"], json!(410));

    let missing_repo = repo_root.path().join("missing");
    let error_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues"))
        .query(&[("repoPath", missing_repo.to_string_lossy().to_string())])
        .send()
        .await
        .expect("list spec issues with invalid repo");
    assert_eq!(error_response.status(), StatusCode::BAD_REQUEST);

    let error_json: Value = error_response
        .json()
        .await
        .expect("decode invalid repo response");
    assert!(
        json_has_error(&error_json, "repoPath"),
        "expected invalid repoPath error, got {error_json:?}"
    );
}

#[tokio::test]
async fn api_spec_issue_assets_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let assets_dir = repo_root
        .path()
        .join("docs")
        .join("issues")
        .join("assets")
        .join("issue-1");

    fs::create_dir_all(&assets_dir).expect("assets dir");
    fs::write(assets_dir.join("flow.png"), b"image").expect("write asset");

    let success_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues/assets"))
        .query(&[
            ("repoPath", repo_root.path().to_string_lossy().to_string()),
            ("path", "assets/issue-1/flow.png".to_string()),
        ])
        .send()
        .await
        .expect("read spec issue asset");
    assert_eq!(success_response.status(), StatusCode::OK);
    assert!(success_response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == "image/png"));
    assert!(success_response
        .headers()
        .get("content-disposition")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("flow.png")));
    let body = success_response.bytes().await.expect("asset body");
    assert_eq!(&body[..], b"image");

    let invalid_path_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues/assets"))
        .query(&[
            ("repoPath", repo_root.path().to_string_lossy().to_string()),
            ("path", "../secret.txt".to_string()),
        ])
        .send()
        .await
        .expect("read invalid spec issue asset path");
    assert_eq!(invalid_path_response.status(), StatusCode::BAD_REQUEST);
    let invalid_path_json: Value = invalid_path_response
        .json()
        .await
        .expect("decode invalid path response");
    assert!(
        json_has_error(&invalid_path_json, "附件路径"),
        "expected attachment path error, got {invalid_path_json:?}"
    );

    let missing_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/issues/assets"))
        .query(&[
            ("repoPath", repo_root.path().to_string_lossy().to_string()),
            ("path", "assets/issue-1/missing.pdf".to_string()),
        ])
        .send()
        .await
        .expect("read missing spec issue asset");
    assert_eq!(missing_response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn api_spec_surface_index_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let specs_dir = repo_root.path().join("docs").join("product-specs");

    fs::create_dir_all(&specs_dir).expect("product specs dir");
    fs::write(
        specs_dir.join("feature-tree.index.json"),
        r#"{
  "generatedAt": "2026-04-16T12:00:00.000Z",
  "pages": [
    {
      "route": "/workspace/:workspaceId/spec",
      "title": "Workspace / Spec",
      "description": "Dense issue relationship board",
      "sourceFile": "src/app/workspace/[workspaceId]/spec/page.tsx"
    }
  ],
  "apis": [
    {
      "domain": "spec",
      "method": "GET",
      "path": "/api/spec/issues",
      "operationId": "listSpecIssues",
      "summary": "List local issue specs"
    }
  ],
  "contractApis": [
    {
      "domain": "spec",
      "method": "GET",
      "path": "/api/spec/issues",
      "summary": "List local issue specs"
    }
  ],
  "rustApis": [
    {
      "domain": "spec",
      "method": "GET",
      "path": "/api/spec/issues",
      "sourceFiles": ["crates/routa-server/src/api/spec.rs"]
    }
  ],
  "metadata": {
    "capabilityGroups": [
      {
        "id": "governance-settings",
        "name": "Governance and Settings"
      }
    ]
  }
}"#,
    )
    .expect("write surface index");

    let success_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/surface-index"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .send()
        .await
        .expect("get spec surface index");
    assert_eq!(success_response.status(), StatusCode::OK);

    let success_json: Value = success_response
        .json()
        .await
        .expect("decode spec surface index");
    assert_eq!(success_json["warnings"], json!([]));
    assert_eq!(
        success_json["pages"][0]["route"],
        json!("/workspace/:workspaceId/spec")
    );
    assert_eq!(success_json["apis"][0]["domain"], json!("spec"));
    assert_eq!(
        success_json["contractApis"][0]["path"],
        json!("/api/spec/issues")
    );
    assert_eq!(
        success_json["rustApis"][0]["sourceFiles"][0],
        json!("crates/routa-server/src/api/spec.rs")
    );
    assert_eq!(
        success_json["metadata"]["capabilityGroups"][0]["id"],
        json!("governance-settings")
    );

    fs::remove_file(specs_dir.join("feature-tree.index.json")).expect("remove surface index");
    fs::write(
        repo_root.path().join("api-contract.yaml"),
        r#"openapi: 3.1.0
paths:
  /api/spec/issues:
    get:
      summary: List local issue specs
"#,
    )
    .expect("write api contract");

    let missing_response = fixture
        .client
        .get(fixture.endpoint("/api/spec/surface-index"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .send()
        .await
        .expect("get missing spec surface index");
    assert_eq!(missing_response.status(), StatusCode::OK);

    let missing_json: Value = missing_response
        .json()
        .await
        .expect("decode missing spec surface index");
    assert_eq!(missing_json["pages"], json!([]));
    assert_eq!(missing_json["apis"][0]["path"], json!("/api/spec/issues"));
    assert_eq!(
        missing_json["contractApis"][0]["summary"],
        json!("List local issue specs")
    );
    assert!(
        missing_json["warnings"][0]
            .as_str()
            .is_some_and(|warning| warning.contains("未找到产品面索引")),
        "expected missing surface index warning, got {missing_json:?}"
    );
}

#[tokio::test]
async fn api_spec_surface_index_reads_feature_tree_markdown_without_json_index() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");
    let specs_dir = repo_root.path().join("docs").join("product-specs");

    fs::create_dir_all(&specs_dir).expect("product specs dir");
    fs::write(
        specs_dir.join("FEATURE_TREE.md"),
        r#"---
feature_metadata:
  schema_version: 1
  capability_groups:
    - id: governance-settings
      name: Governance and Settings
  features:
    - id: spec-management
      name: Spec Management
      group: governance-settings
      pages:
        - /workspace/:workspaceId/spec
      apis:
        - GET /api/spec/issues
---

# Product Feature Specification

## Frontend Pages

| Page | Route | Source File | Description |
|------|-------|-------------|-------------|
| Workspace / Spec | `/workspace/:workspaceId/spec` | `src/app/workspace/[workspaceId]/spec/page.tsx` | Dense issue relationship board |

## API Contract Endpoints

### Spec (1)

| Method | Endpoint | Details | Next.js | Rust |
|--------|----------|---------|---------|------|
| GET | `/api/spec/issues` | List local issue specs | `src/app/api/spec/issues/route.ts` | `crates/routa-server/src/api/spec.rs` |
"#,
    )
    .expect("write feature tree markdown");

    let response = fixture
        .client
        .get(fixture.endpoint("/api/spec/surface-index"))
        .query(&[("repoPath", repo_root.path().to_string_lossy().to_string())])
        .send()
        .await
        .expect("get markdown-backed spec surface index");
    assert_eq!(response.status(), StatusCode::OK);

    let payload: Value = response.json().await.expect("decode surface index");
    assert_eq!(payload["warnings"], json!([]));
    assert_eq!(
        payload["pages"][0]["route"],
        json!("/workspace/:workspaceId/spec")
    );
    assert_eq!(
        payload["contractApis"][0]["path"],
        json!("/api/spec/issues")
    );
    assert_eq!(
        payload["nextjsApis"][0]["sourceFiles"][0],
        json!("src/app/api/spec/issues/route.ts")
    );
    assert_eq!(
        payload["rustApis"][0]["sourceFiles"][0],
        json!("crates/routa-server/src/api/spec.rs")
    );
    assert_eq!(payload["implementationApis"].as_array().unwrap().len(), 2);
    assert_eq!(
        payload["metadata"]["features"][0]["id"],
        json!("spec-management")
    );
}

#[tokio::test]
async fn api_spec_surface_index_falls_back_from_invalid_repo_path_to_workspace_codebase() {
    let fixture = ApiFixture::new().await;
    let repo = GitRepoFixture::new();

    let create_codebase = fixture
        .client
        .post(fixture.endpoint("/api/workspaces/default/codebases"))
        .json(&json!({
            "repoPath": repo.repo_path.to_string_lossy().to_string(),
            "branch": "main",
            "label": "fixture",
            "isDefault": true
        }))
        .send()
        .await
        .expect("create codebase for default workspace");
    assert_eq!(create_codebase.status(), StatusCode::CREATED);

    let response = fixture
        .client
        .get(fixture.endpoint("/api/spec/surface-index"))
        .query(&[
            ("workspaceId", "default".to_string()),
            (
                "repoPath",
                repo.repo_path.join("missing").to_string_lossy().to_string(),
            ),
        ])
        .send()
        .await
        .expect("get spec surface index with invalid explicit repo path");

    assert_eq!(response.status(), StatusCode::OK);

    let payload: Value = response
        .json()
        .await
        .expect("decode fallback surface index response");

    assert_eq!(
        payload["repoRoot"],
        json!(repo.repo_path.to_string_lossy().to_string())
    );
    assert!(payload["warnings"].as_array().is_some());
}

#[tokio::test]
async fn api_spec_feature_tree_generate_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = workspace_root();

    let response = fixture
        .client
        .post(fixture.endpoint("/api/spec/feature-tree/generate"))
        .json(&json!({
            "repoPath": repo_root.to_string_lossy().to_string(),
            "dryRun": true
        }))
        .send()
        .await
        .expect("generate feature tree");

    assert_eq!(response.status(), StatusCode::OK);

    let payload: Value = response
        .json()
        .await
        .expect("decode feature tree generate response");

    assert!(payload["generatedAt"].as_str().is_some());
    let frameworks = payload["frameworksDetected"]
        .as_array()
        .expect("frameworksDetected should be an array");
    assert!(
        frameworks.iter().any(|f| f.as_str() == Some("nextjs")),
        "frameworksDetected should include nextjs, got: {frameworks:?}"
    );
    assert_eq!(
        payload["wroteFiles"],
        json!([
            "docs/product-specs/FEATURE_TREE.md",
            "docs/product-specs/feature-tree.index.json"
        ])
    );
    assert!(payload["warnings"].as_array().is_some());
    assert!(payload["pagesCount"]
        .as_u64()
        .is_some_and(|count| count > 0));
    assert!(payload["apisCount"].as_u64().is_some_and(|count| count > 0));
}

#[tokio::test]
async fn api_spec_feature_tree_preflight_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = workspace_root();

    let response = fixture
        .client
        .get(fixture.endpoint("/api/spec/feature-tree/preflight"))
        .query(&[("repoPath", repo_root.to_string_lossy().to_string())])
        .send()
        .await
        .expect("preflight feature tree");

    assert_eq!(response.status(), StatusCode::OK);

    let payload: Value = response
        .json()
        .await
        .expect("decode feature tree preflight response");

    assert_eq!(
        payload["repoRoot"],
        json!(repo_root.to_string_lossy().to_string())
    );
    assert_eq!(
        payload["selectedScanRoot"],
        json!(repo_root.to_string_lossy().to_string())
    );
    let frameworks = payload["frameworksDetected"]
        .as_array()
        .expect("frameworksDetected should be an array");
    assert!(
        frameworks.iter().any(|f| f.as_str() == Some("nextjs")),
        "frameworksDetected should include nextjs, got: {frameworks:?}"
    );
    assert!(payload["candidateRoots"].as_array().is_some());
    assert!(payload["warnings"].as_array().is_some());
}

#[tokio::test]
async fn api_spec_feature_tree_commit_contract() {
    let fixture = ApiFixture::new().await;
    let repo_root = tempfile::tempdir().expect("temp repo");

    write_file(
        repo_root.path(),
        "package.json",
        r#"{"name":"feature-tree-commit-fixture"}"#,
    );
    write_file(
        repo_root.path(),
        "pages/index.tsx",
        "export default function Home() { return null; }\n",
    );

    let response = fixture
        .client
        .post(fixture.endpoint("/api/spec/feature-tree/commit"))
        .json(&json!({
            "repoPath": repo_root.path().to_string_lossy().to_string(),
            "metadata": {
                "schemaVersion": 1,
                "capabilityGroups": [],
                "features": [
                    {
                        "id": "home",
                        "name": "Home",
                        "description": "Generated in rust contract test",
                        "route": "/"
                    }
                ]
            }
        }))
        .send()
        .await
        .expect("commit feature tree");

    assert_eq!(response.status(), StatusCode::OK);

    let payload: Value = response
        .json()
        .await
        .expect("decode feature tree commit response");

    assert!(payload["generatedAt"].as_str().is_some());
    assert_eq!(payload["pagesCount"], json!(1));
    assert!(payload["warnings"].as_array().is_some());

    let feature_tree_index_path = repo_root
        .path()
        .join("docs")
        .join("product-specs")
        .join("feature-tree.index.json");
    let feature_tree_markdown_path = repo_root
        .path()
        .join("docs")
        .join("product-specs")
        .join("FEATURE_TREE.md");
    assert!(feature_tree_index_path.exists());
    assert!(feature_tree_markdown_path.exists());

    let saved_index: Value = serde_json::from_str(
        &fs::read_to_string(&feature_tree_index_path).expect("read committed feature tree index"),
    )
    .expect("decode committed feature tree index");
    assert_eq!(saved_index["pages"][0]["route"], json!("/"));
    assert_eq!(
        saved_index["metadata"]["features"]
            .as_array()
            .map(|items| items.len()),
        Some(1)
    );
}
