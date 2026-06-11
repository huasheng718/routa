use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use axum::{
    body::to_bytes,
    extract::{DefaultBodyLimit, FromRequest, Query, Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::Multipart;
use feature_trace::{
    api_endpoints_from_openapi_contract, ApiEndpointDetail, FeatureTreeCatalog, FrontendPageDetail,
    ImplementationApiRoute,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::collections::BTreeMap;

use crate::api::repo_context::{extract_frontmatter, resolve_repo_root, ResolveRepoRootOptions};
use crate::error::ServerError;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/issues", get(list_spec_issues).post(create_spec_issue))
        .route("/issues/assets", get(get_spec_issue_asset))
        .route("/surface-index", get(get_surface_index))
        .route("/feature-tree/preflight", get(preflight_feature_tree))
        .route("/feature-tree/generate", post(generate_feature_tree))
        .route("/feature-tree/commit", post(commit_feature_tree))
        .layer(DefaultBodyLimit::max(SPEC_ISSUE_BODY_LIMIT_BYTES))
}

const SPEC_STATUSES: [&str; 4] = ["open", "investigating", "resolved", "wontfix"];
const SPEC_KINDS: [&str; 5] = [
    "issue",
    "analysis",
    "progress_note",
    "verification_report",
    "github_mirror",
];
const SPEC_SEVERITIES: [&str; 5] = ["critical", "high", "medium", "low", "info"];
const MAX_ATTACHMENT_SIZE_BYTES: usize = 50 * 1024 * 1024;
const SPEC_ISSUE_BODY_LIMIT_BYTES: usize = 220 * 1024 * 1024;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpecIssuesQuery {
    workspace_id: Option<String>,
    codebase_id: Option<String>,
    repo_path: Option<String>,
    include_body: Option<String>,
    filename: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpecIssueAssetQuery {
    workspace_id: Option<String>,
    codebase_id: Option<String>,
    repo_path: Option<String>,
    path: Option<String>,
}

#[derive(Debug, Default)]
struct CreateSpecIssueInput {
    fields: serde_json::Map<String, JsonValue>,
    attachment_names: Vec<String>,
    attachments: Vec<UploadedSpecIssueAttachment>,
}

#[derive(Debug)]
struct UploadedSpecIssueAttachment {
    name: String,
    mime_type: String,
    data: Vec<u8>,
}

#[derive(Debug, Serialize)]
struct SpecIssueFrontmatter {
    title: String,
    date: String,
    kind: String,
    status: String,
    severity: String,
    area: String,
    tags: Vec<String>,
    reported_by: String,
    related_issues: Vec<String>,
    github_issue: Option<u64>,
    github_state: Option<String>,
    github_url: Option<String>,
    attachments: Vec<SpecIssueAttachmentFrontmatter>,
}

#[derive(Clone, Debug, Serialize)]
struct SpecIssueAttachmentFrontmatter {
    filename: String,
    original_name: String,
    path: String,
    mime_type: String,
    size: u64,
    category: String,
}

#[derive(Debug)]
enum CreateSpecIssueError {
    AttachmentTooLarge(String),
    Internal(String),
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureSurfaceIndexFile {
    generated_at: Option<String>,
    #[serde(default)]
    pages: Vec<FeatureSurfacePage>,
    #[serde(default)]
    apis: Vec<FeatureSurfaceApi>,
    #[serde(default)]
    contract_apis: Vec<FeatureSurfaceApi>,
    #[serde(default)]
    nextjs_apis: Vec<FeatureSurfaceImplementationApi>,
    #[serde(default)]
    rust_apis: Vec<FeatureSurfaceImplementationApi>,
    #[serde(default)]
    implementation_apis: Vec<FeatureSurfaceImplementationApi>,
    metadata: Option<JsonValue>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureSurfacePage {
    route: String,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    source_file: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureSurfaceApi {
    domain: String,
    method: String,
    path: String,
    #[serde(default)]
    operation_id: String,
    #[serde(default)]
    summary: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureSurfaceImplementationApi {
    domain: String,
    method: String,
    path: String,
    #[serde(default)]
    source_files: Vec<String>,
}

fn yaml_scalar_to_string(value: &serde_yaml::Value) -> Option<String> {
    match value {
        serde_yaml::Value::Null => None,
        serde_yaml::Value::Bool(value) => Some(value.to_string()),
        serde_yaml::Value::Number(value) => Some(value.to_string()),
        serde_yaml::Value::String(value) => Some(value.trim().to_string()),
        serde_yaml::Value::Tagged(tagged) => yaml_scalar_to_string(&tagged.value),
        _ => None,
    }
}

fn yaml_string_field(frontmatter: &serde_yaml::Value, key: &str) -> String {
    frontmatter
        .get(key)
        .and_then(yaml_scalar_to_string)
        .unwrap_or_default()
}

fn yaml_string_field_or(frontmatter: &serde_yaml::Value, key: &str, default: &str) -> String {
    let value = yaml_string_field(frontmatter, key);
    if value.is_empty() {
        default.to_string()
    } else {
        value
    }
}

fn yaml_string_vec(frontmatter: &serde_yaml::Value, key: &str) -> Vec<String> {
    match frontmatter.get(key) {
        Some(serde_yaml::Value::Sequence(values)) => values
            .iter()
            .filter_map(yaml_scalar_to_string)
            .filter(|value| !value.is_empty())
            .collect(),
        Some(serde_yaml::Value::Tagged(tagged)) => match &tagged.value {
            serde_yaml::Value::Sequence(values) => values
                .iter()
                .filter_map(yaml_scalar_to_string)
                .filter(|value| !value.is_empty())
                .collect(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    }
}

fn yaml_optional_number(frontmatter: &serde_yaml::Value, key: &str) -> Option<JsonValue> {
    match frontmatter.get(key) {
        Some(serde_yaml::Value::Number(value)) => value
            .as_u64()
            .map(|number| JsonValue::Number(number.into())),
        Some(serde_yaml::Value::String(value)) => value
            .trim()
            .parse::<u64>()
            .ok()
            .map(|number| JsonValue::Number(number.into())),
        Some(serde_yaml::Value::Tagged(tagged)) => match &tagged.value {
            serde_yaml::Value::Number(value) => value
                .as_u64()
                .map(|number| JsonValue::Number(number.into())),
            serde_yaml::Value::String(value) => value
                .trim()
                .parse::<u64>()
                .ok()
                .map(|number| JsonValue::Number(number.into())),
            _ => None,
        },
        _ => None,
    }
}

fn yaml_optional_string(frontmatter: &serde_yaml::Value, key: &str) -> Option<JsonValue> {
    let value = yaml_string_field(frontmatter, key);
    if value.is_empty() {
        None
    } else {
        Some(JsonValue::String(value))
    }
}

fn yaml_string_field_any(frontmatter: &serde_yaml::Value, keys: &[&str]) -> String {
    keys.iter()
        .map(|key| yaml_string_field(frontmatter, key))
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn yaml_attachment_size(value: &serde_yaml::Value) -> u64 {
    match value {
        serde_yaml::Value::Number(value) => value.as_u64().unwrap_or_default(),
        serde_yaml::Value::String(value) => value.trim().parse::<u64>().unwrap_or_default(),
        serde_yaml::Value::Tagged(tagged) => yaml_attachment_size(&tagged.value),
        _ => 0,
    }
}

fn normalize_attachment_category(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "image" => "image",
        "video" => "video",
        _ => "document",
    }
}

fn yaml_attachments(frontmatter: &serde_yaml::Value) -> Vec<JsonValue> {
    let Some(value) = frontmatter.get("attachments") else {
        return Vec::new();
    };
    let sequence = match value {
        serde_yaml::Value::Sequence(values) => values,
        serde_yaml::Value::Tagged(tagged) => match &tagged.value {
            serde_yaml::Value::Sequence(values) => values,
            _ => return Vec::new(),
        },
        _ => return Vec::new(),
    };

    sequence
        .iter()
        .filter_map(|attachment| {
            let filename = yaml_string_field(attachment, "filename");
            let path = yaml_string_field(attachment, "path");
            if filename.is_empty() || path.is_empty() {
                return None;
            }

            Some(json!({
                "filename": filename,
                "originalName": yaml_string_field_any(attachment, &["original_name", "originalName"]),
                "path": path,
                "mimeType": yaml_string_field_any(attachment, &["mime_type", "mimeType"]),
                "size": attachment.get("size").map(yaml_attachment_size).unwrap_or_default(),
                "category": normalize_attachment_category(&yaml_string_field(attachment, "category")),
            }))
        })
        .collect()
}

fn normalize_spec_scalar(value: Option<&JsonValue>) -> String {
    match value {
        Some(JsonValue::String(value)) => value.trim().to_string(),
        Some(JsonValue::Number(value)) => value.to_string(),
        Some(JsonValue::Bool(value)) => value.to_string(),
        _ => String::new(),
    }
}

fn normalize_status(raw: &str) -> String {
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized == "closed" {
        return "resolved".to_string();
    }

    if SPEC_STATUSES.contains(&normalized.as_str()) {
        normalized
    } else {
        "open".to_string()
    }
}

fn normalize_kind(raw: &str) -> String {
    let normalized = raw.trim().to_ascii_lowercase();
    if SPEC_KINDS.contains(&normalized.as_str()) {
        normalized
    } else {
        "issue".to_string()
    }
}

fn normalize_severity(raw: &str) -> String {
    let normalized = raw.trim().to_ascii_lowercase();
    if SPEC_SEVERITIES.contains(&normalized.as_str()) {
        normalized
    } else {
        "medium".to_string()
    }
}

fn normalize_issue_date(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() == 10
        && trimmed.as_bytes().get(4) == Some(&b'-')
        && trimmed.as_bytes().get(7) == Some(&b'-')
        && chrono::NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").is_ok()
    {
        trimmed.to_string()
    } else {
        chrono::Utc::now().date_naive().to_string()
    }
}

fn should_include_body(value: Option<&str>) -> bool {
    !matches!(value, Some("false" | "0"))
}

fn normalize_issue_filename(value: Option<&str>) -> Option<String> {
    let file_name = Path::new(value?.trim())
        .file_name()?
        .to_string_lossy()
        .to_string();
    if file_name.ends_with(".md") && file_name != "_template.md" {
        Some(file_name)
    } else {
        None
    }
}

fn normalize_attachment_path(value: Option<&str>) -> Option<String> {
    let raw = value?.trim().replace('\\', "/");
    if raw.is_empty() || raw.starts_with('/') {
        return None;
    }

    let mut parts = Vec::new();
    for part in raw.split('/') {
        match part {
            "" | "." => {}
            ".." => return None,
            value => parts.push(value),
        }
    }

    let normalized = parts.join("/");
    if normalized.starts_with("assets/") {
        Some(normalized)
    } else {
        None
    }
}

fn content_type_for_attachment(file_name: &str) -> &'static str {
    match Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "pdf" => "application/pdf",
        "txt" => "text/plain; charset=utf-8",
        "md" => "text/markdown; charset=utf-8",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

fn slugify_title(title: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;
    for ch in title.trim().to_lowercase().chars() {
        if ch.is_alphanumeric() {
            slug.push(ch);
            last_was_dash = false;
        } else if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }

        if slug.len() >= 80 {
            break;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "demand".to_string()
    } else {
        slug
    }
}

fn truncate_to_char_boundary(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }

    let mut truncated = String::new();
    for ch in value.chars() {
        if truncated.len() + ch.len_utf8() > max_bytes {
            break;
        }
        truncated.push(ch);
    }
    truncated.trim_end_matches('-').to_string()
}

fn sanitize_attachment_filename(filename: &str) -> String {
    let basename = Path::new(filename.trim())
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment");
    let parsed = Path::new(basename);
    let stem = parsed
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment");
    let extension = parsed
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| {
            value
                .to_ascii_lowercase()
                .chars()
                .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '.')
                .take(16)
                .collect::<String>()
        })
        .filter(|value| !value.is_empty());
    let mut slug = truncate_to_char_boundary(&slugify_title(stem), 64);
    if slug.is_empty() {
        slug = "attachment".to_string();
    }

    match extension {
        Some(extension) => format!("{slug}.{extension}"),
        None => slug,
    }
}

fn split_filename_extension(filename: &str) -> (String, String) {
    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(filename)
        .to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();
    (stem, extension)
}

fn issue_filename_candidate(title: &str, date: &str, counter: usize) -> String {
    let slug = slugify_title(title);

    if counter <= 1 {
        format!("{date}-{slug}.md")
    } else {
        format!("{date}-{slug}-{counter}.md")
    }
}

fn write_issue_markdown_atomic(
    issues_dir: &Path,
    title: &str,
    date: &str,
    markdown: &str,
) -> std::io::Result<(String, PathBuf, std::fs::File)> {
    let mut counter = 1;

    loop {
        let filename = issue_filename_candidate(title, date, counter);
        let issue_path = issues_dir.join(&filename);
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&issue_path)
        {
            Ok(mut file) => {
                file.write_all(markdown.as_bytes())?;
                return Ok((filename, issue_path, file));
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                counter += 1;
            }
            Err(error) => return Err(error),
        }
    }
}

fn pick_attachment_filename(attachment_dir: &Path, original_name: &str) -> String {
    let base_filename = sanitize_attachment_filename(original_name);
    let mut filename = base_filename.clone();
    let (stem, extension) = split_filename_extension(&base_filename);
    let mut counter = 2;
    while attachment_dir.join(&filename).exists() {
        filename = format!("{stem}-{counter}{extension}");
        counter += 1;
    }

    filename
}

fn to_delimited_string_array(value: Option<&JsonValue>) -> Vec<String> {
    match value {
        Some(JsonValue::Array(values)) => values
            .iter()
            .map(|value| normalize_spec_scalar(Some(value)))
            .filter(|value| !value.is_empty())
            .collect(),
        Some(JsonValue::String(value)) => value
            .split([',', '，', '\n'])
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .collect(),
        Some(value) => {
            let normalized = normalize_spec_scalar(Some(value));
            if normalized.is_empty() {
                Vec::new()
            } else {
                vec![normalized]
            }
        }
        None => Vec::new(),
    }
}

fn infer_attachment_category(mime_type: &str) -> &'static str {
    if mime_type.starts_with("image/") {
        "image"
    } else if mime_type.starts_with("video/") {
        "video"
    } else {
        "document"
    }
}

fn build_attachment_markdown(attachments: &[SpecIssueAttachmentFrontmatter]) -> String {
    if attachments.is_empty() {
        return String::new();
    }

    let mut markdown = "## 附件\n\n".to_string();
    for (index, attachment) in attachments.iter().enumerate() {
        if index > 0 {
            markdown.push('\n');
        }
        markdown.push_str(&format!(
            "- [{}](./{})",
            attachment.original_name, attachment.path
        ));
    }

    markdown
}

fn append_attachment_markdown(
    body: &str,
    attachments: &[SpecIssueAttachmentFrontmatter],
) -> String {
    let attachment_markdown = build_attachment_markdown(attachments);
    if attachment_markdown.is_empty() {
        return body.to_string();
    }

    let trimmed = body.trim();
    if trimmed.is_empty() {
        attachment_markdown
    } else {
        format!("{trimmed}\n\n{attachment_markdown}")
    }
}

fn issue_markdown_content(
    frontmatter: &SpecIssueFrontmatter,
    body: &str,
) -> Result<String, ServerError> {
    let frontmatter = serde_yaml::to_string(frontmatter)
        .map_err(|error| ServerError::Internal(format!("创建需求记录失败: {error}")))?;
    Ok(format!("---\n{}---\n{}", frontmatter, body))
}

fn context_value_from_input(
    input: &CreateSpecIssueInput,
    key: &str,
    query_value: Option<String>,
) -> Option<String> {
    let body_value = normalize_spec_scalar(input.fields.get(key));
    let body_value = body_value.trim();
    if body_value.is_empty() {
        query_value
    } else {
        Some(body_value.to_string())
    }
}

fn build_surface_text(content: &str) -> String {
    let mut surface = String::new();
    for line in content.lines() {
        let trimmed = line.trim();
        let relevant = trimmed.starts_with('#')
            || trimmed.contains("`src/")
            || trimmed.contains("`docs/")
            || trimmed.contains("`crates/")
            || trimmed.contains("`apps/")
            || trimmed.contains("`resources/")
            || trimmed.contains("src/")
            || trimmed.contains("docs/")
            || trimmed.contains("crates/")
            || trimmed.contains("apps/")
            || trimmed.contains("resources/")
            || trimmed.contains("/api/")
            || trimmed.contains("/workspace")
            || trimmed.contains("/settings")
            || trimmed.contains("/messages")
            || trimmed.contains("/traces")
            || trimmed.contains("/debug")
            || trimmed.contains("/mcp-tools")
            || trimmed.contains("/a2a")
            || trimmed.contains("/ag-ui");
        if relevant {
            if !surface.is_empty() {
                surface.push('\n');
            }
            surface.push_str(trimmed);
            if surface.len() >= 4_000 {
                surface.truncate(4_000);
                break;
            }
        }
    }

    surface
}

fn parse_spec_issue_file(entry_path: &Path, include_body: bool) -> Option<JsonValue> {
    let raw = std::fs::read_to_string(entry_path).ok()?;
    let filename = entry_path.file_name()?.to_string_lossy().to_string();
    let (frontmatter_str, body) = extract_frontmatter(&raw)?;
    let fm: serde_yaml::Value = serde_yaml::from_str(&frontmatter_str).ok()?;

    let title_fallback = filename.trim_end_matches(".md").to_string();
    let title = yaml_string_field_or(&fm, "title", &title_fallback);
    let kind = yaml_string_field_or(&fm, "kind", "issue").to_ascii_lowercase();
    let severity = yaml_string_field_or(&fm, "severity", "medium").to_ascii_lowercase();
    let status = normalize_status(&yaml_string_field(&fm, "status"));
    let body = body.trim();

    Some(json!({
        "filename": filename,
        "title": title,
        "date": yaml_string_field(&fm, "date"),
        "kind": kind,
        "status": status,
        "severity": severity,
        "area": yaml_string_field(&fm, "area"),
        "tags": yaml_string_vec(&fm, "tags"),
        "reportedBy": yaml_string_field(&fm, "reported_by"),
        "relatedIssues": yaml_string_vec(&fm, "related_issues"),
        "githubIssue": yaml_optional_number(&fm, "github_issue"),
        "githubState": yaml_optional_string(&fm, "github_state"),
        "githubUrl": yaml_optional_string(&fm, "github_url"),
        "attachments": yaml_attachments(&fm),
        "body": if include_body { body } else { "" },
        "bodyLoaded": include_body,
        "surfaceText": build_surface_text(body),
    }))
}

fn input_field(input: &CreateSpecIssueInput, key: &str) -> String {
    normalize_spec_scalar(input.fields.get(key))
}

fn input_field_any(input: &CreateSpecIssueInput, keys: &[&str]) -> String {
    keys.iter()
        .map(|key| input_field(input, key))
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn create_spec_issue_file(
    repo_root: &Path,
    input: CreateSpecIssueInput,
) -> Result<JsonValue, CreateSpecIssueError> {
    let title = input_field(&input, "title");
    let issues_dir = repo_root.join("docs").join("issues");
    let date = normalize_issue_date(&input_field(&input, "date"));
    let issue_body = input_field(&input, "body");
    let metadata = SpecIssueFrontmatter {
        title: title.clone(),
        date: date.clone(),
        kind: normalize_kind(&input_field(&input, "kind")),
        status: normalize_status(&input_field(&input, "status")),
        severity: normalize_severity(&input_field(&input, "severity")),
        area: input_field(&input, "area"),
        tags: to_delimited_string_array(input.fields.get("tags")),
        reported_by: {
            let reported_by = input_field_any(&input, &["reportedBy", "reported_by"]);
            if reported_by.is_empty() {
                "human".to_string()
            } else {
                reported_by
            }
        },
        related_issues: to_delimited_string_array(
            input
                .fields
                .get("relatedIssues")
                .or_else(|| input.fields.get("related_issues")),
        ),
        github_issue: None,
        github_state: None,
        github_url: None,
        attachments: Vec::new(),
    };

    for file in &input.attachments {
        if !file.data.is_empty() && file.data.len() > MAX_ATTACHMENT_SIZE_BYTES {
            return Err(CreateSpecIssueError::AttachmentTooLarge(file.name.clone()));
        }
    }

    std::fs::create_dir_all(&issues_dir)
        .map_err(|error| CreateSpecIssueError::Internal(format!("创建需求目录失败: {error}")))?;
    let placeholder_markdown = issue_markdown_content(&metadata, &issue_body)
        .map_err(|error| CreateSpecIssueError::Internal(error.to_string()))?;
    let (filename, issue_path, mut issue_file) =
        write_issue_markdown_atomic(&issues_dir, &title, &date, &placeholder_markdown).map_err(
            |error| CreateSpecIssueError::Internal(format!("创建需求记录失败: {error}")),
        )?;
    let issue_slug = filename.trim_end_matches(".md").to_string();
    let attachment_dir = issues_dir.join("assets").join(&issue_slug);
    let mut attachments = Vec::new();

    for (index, file) in input.attachments.into_iter().enumerate() {
        if file.data.is_empty() {
            continue;
        }
        if file.data.len() > MAX_ATTACHMENT_SIZE_BYTES {
            return Err(CreateSpecIssueError::AttachmentTooLarge(file.name));
        }

        std::fs::create_dir_all(&attachment_dir).map_err(|error| {
            CreateSpecIssueError::Internal(format!("创建附件目录失败: {error}"))
        })?;
        let original_name = input
            .attachment_names
            .get(index)
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(&file.name)
            .to_string();
        let attachment_filename = pick_attachment_filename(&attachment_dir, &original_name);
        let attachment_path = attachment_dir.join(&attachment_filename);
        std::fs::write(&attachment_path, &file.data)
            .map_err(|error| CreateSpecIssueError::Internal(format!("写入附件失败: {error}")))?;
        let mime_type = if file.mime_type.trim().is_empty() {
            "application/octet-stream".to_string()
        } else {
            file.mime_type.trim().to_string()
        };
        attachments.push(SpecIssueAttachmentFrontmatter {
            filename: attachment_filename.clone(),
            original_name,
            path: format!("assets/{issue_slug}/{attachment_filename}"),
            mime_type: mime_type.clone(),
            size: file.data.len() as u64,
            category: infer_attachment_category(&mime_type).to_string(),
        });
    }

    let mut metadata = metadata;
    metadata.attachments = attachments.clone();
    let content = append_attachment_markdown(&issue_body, &attachments);
    let markdown = issue_markdown_content(&metadata, &content)
        .map_err(|error| CreateSpecIssueError::Internal(error.to_string()))?;
    issue_file
        .set_len(0)
        .and_then(|_| issue_file.seek(SeekFrom::Start(0)).map(|_| ()))
        .and_then(|_| issue_file.write_all(markdown.as_bytes()))
        .and_then(|_| issue_file.sync_all())
        .map_err(|error| CreateSpecIssueError::Internal(format!("写入需求记录失败: {error}")))?;

    parse_spec_issue_file(&issue_path, true)
        .ok_or_else(|| CreateSpecIssueError::Internal("读取需求记录失败".to_string()))
}

async fn read_create_spec_issue_input(
    state: &AppState,
    request: Request,
) -> Result<CreateSpecIssueInput, ServerError> {
    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if content_type.contains("multipart/form-data") {
        let mut multipart = Multipart::from_request(request, state)
            .await
            .map_err(|_| ServerError::BadRequest("请求内容无效".to_string()))?;
        let mut input = CreateSpecIssueInput::default();
        while let Some(field) = multipart
            .next_field()
            .await
            .map_err(|_| ServerError::BadRequest("请求内容无效".to_string()))?
        {
            let name = field.name().unwrap_or_default().to_string();
            let file_name = field.file_name().unwrap_or("attachment").to_string();
            let mime_type = field
                .content_type()
                .map(ToString::to_string)
                .unwrap_or_default();
            let data = field
                .bytes()
                .await
                .map_err(|_| ServerError::BadRequest("请求内容无效".to_string()))?;
            if name == "attachments" {
                input.attachments.push(UploadedSpecIssueAttachment {
                    name: file_name,
                    mime_type,
                    data: data.to_vec(),
                });
            } else if name == "attachmentNames" {
                input
                    .attachment_names
                    .push(String::from_utf8_lossy(&data).trim().to_string());
            } else if !name.is_empty() {
                input.fields.insert(
                    name,
                    JsonValue::String(String::from_utf8_lossy(&data).to_string()),
                );
            }
        }
        return Ok(input);
    }

    let bytes = to_bytes(request.into_body(), SPEC_ISSUE_BODY_LIMIT_BYTES)
        .await
        .map_err(|_| ServerError::BadRequest("请求内容无效".to_string()))?;
    let value = serde_json::from_slice::<JsonValue>(&bytes)
        .map_err(|_| ServerError::BadRequest("请求内容无效".to_string()))?;
    let fields = value
        .as_object()
        .cloned()
        .ok_or_else(|| ServerError::BadRequest("请求内容无效".to_string()))?;
    Ok(CreateSpecIssueInput {
        fields,
        attachment_names: Vec::new(),
        attachments: Vec::new(),
    })
}

fn empty_surface_index_response(repo_root: &Path, warnings: Vec<String>) -> JsonValue {
    json!({
        "generatedAt": "",
        "pages": [],
        "apis": [],
        "contractApis": [],
        "nextjsApis": [],
        "rustApis": [],
        "implementationApis": [],
        "metadata": JsonValue::Null,
        "repoRoot": repo_root.to_string_lossy(),
        "warnings": warnings,
    })
}

fn normalize_surface_pages(pages: Vec<FeatureSurfacePage>) -> Vec<JsonValue> {
    pages
        .into_iter()
        .filter(|page| !page.route.trim().is_empty() && !page.title.trim().is_empty())
        .map(|page| {
            json!({
                "route": page.route.trim(),
                "title": page.title.trim(),
                "description": page.description.trim(),
                "sourceFile": page.source_file.trim(),
            })
        })
        .collect()
}

fn merge_surface_api_lists<const N: usize>(
    lists: [Vec<FeatureSurfaceApi>; N],
) -> Vec<FeatureSurfaceApi> {
    let mut merged: BTreeMap<(String, String), FeatureSurfaceApi> = BTreeMap::new();

    for list in lists {
        for api in list {
            let method = api.method.trim().to_ascii_uppercase();
            let path = api.path.trim().to_string();
            if method.is_empty() || path.is_empty() {
                continue;
            }

            let key = (method.clone(), path.clone());
            if let Some(existing) = merged.get_mut(&key) {
                if existing.domain.trim().is_empty() && !api.domain.trim().is_empty() {
                    existing.domain = api.domain.trim().to_string();
                }
                if existing.operation_id.trim().is_empty() && !api.operation_id.trim().is_empty() {
                    existing.operation_id = api.operation_id.trim().to_string();
                }
                if existing.summary.trim().is_empty() && !api.summary.trim().is_empty() {
                    existing.summary = api.summary.trim().to_string();
                }
                continue;
            }

            merged.insert(
                key,
                FeatureSurfaceApi {
                    domain: api.domain.trim().to_string(),
                    method,
                    path,
                    operation_id: api.operation_id.trim().to_string(),
                    summary: api.summary.trim().to_string(),
                },
            );
        }
    }

    merged.into_values().collect()
}

fn normalize_surface_apis(apis: Vec<FeatureSurfaceApi>) -> Vec<JsonValue> {
    merge_surface_api_lists([apis])
        .into_iter()
        .filter(|api| !api.domain.trim().is_empty())
        .map(|api| {
            json!({
                "domain": api.domain.trim(),
                "method": api.method.trim(),
                "path": api.path.trim(),
                "operationId": api.operation_id.trim(),
                "summary": api.summary.trim(),
            })
        })
        .collect()
}

fn normalize_surface_implementation_apis(
    apis: Vec<FeatureSurfaceImplementationApi>,
) -> Vec<JsonValue> {
    apis.into_iter()
        .filter(|api| {
            !api.domain.trim().is_empty()
                && !api.method.trim().is_empty()
                && !api.path.trim().is_empty()
        })
        .map(|api| {
            json!({
                "domain": api.domain.trim(),
                "method": api.method.trim().to_ascii_uppercase(),
                "path": api.path.trim(),
                "sourceFiles": api.source_files,
            })
        })
        .collect()
}

fn to_surface_page(page: FrontendPageDetail) -> FeatureSurfacePage {
    FeatureSurfacePage {
        route: page.route,
        title: page.name,
        description: page.description,
        source_file: String::new(),
    }
}

fn to_surface_api(api: ApiEndpointDetail) -> FeatureSurfaceApi {
    FeatureSurfaceApi {
        domain: api.domain,
        method: api.method,
        path: api.endpoint,
        operation_id: String::new(),
        summary: api.description,
    }
}

fn to_surface_implementation_api(api: ImplementationApiRoute) -> FeatureSurfaceImplementationApi {
    FeatureSurfaceImplementationApi {
        domain: api.domain,
        method: api.method,
        path: api.endpoint,
        source_files: api.source_files,
    }
}

fn to_surface_api_from_contract(apis: Vec<ApiEndpointDetail>) -> Vec<FeatureSurfaceApi> {
    apis.into_iter().map(to_surface_api).collect()
}

fn to_surface_index_from_feature_tree(catalog: FeatureTreeCatalog) -> FeatureSurfaceIndexFile {
    let metadata = json!({
        "capabilityGroups": catalog.capability_groups,
        "features": catalog.features,
    });

    FeatureSurfaceIndexFile {
        generated_at: None,
        pages: catalog
            .frontend_pages
            .into_iter()
            .map(to_surface_page)
            .collect(),
        apis: catalog
            .api_endpoints
            .into_iter()
            .map(to_surface_api)
            .collect(),
        contract_apis: Vec::new(),
        nextjs_apis: catalog
            .nextjs_api_routes
            .into_iter()
            .map(to_surface_implementation_api)
            .collect(),
        rust_apis: catalog
            .rust_api_routes
            .into_iter()
            .map(to_surface_implementation_api)
            .collect(),
        implementation_apis: Vec::new(),
        metadata: Some(metadata),
    }
}

fn normalize_surface_index(
    index: FeatureSurfaceIndexFile,
    openapi_contract_apis: Vec<FeatureSurfaceApi>,
    repo_root: &Path,
    warnings: Vec<String>,
) -> JsonValue {
    let pages = index.pages;
    let nextjs_apis = index.nextjs_apis;
    let rust_apis = index.rust_apis;
    let implementation_apis = if index.implementation_apis.is_empty() {
        nextjs_apis
            .iter()
            .cloned()
            .chain(rust_apis.iter().cloned())
            .collect()
    } else {
        index.implementation_apis
    };
    let fallback_contract_apis = if index.contract_apis.is_empty() {
        index.apis.clone()
    } else {
        index.contract_apis.clone()
    };
    let resolved_apis = if index.apis.is_empty() {
        merge_surface_api_lists([
            openapi_contract_apis.clone(),
            fallback_contract_apis.clone(),
        ])
    } else {
        merge_surface_api_lists([openapi_contract_apis.clone(), index.apis])
    };
    let resolved_contract_apis =
        merge_surface_api_lists([openapi_contract_apis, fallback_contract_apis]);

    json!({
        "generatedAt": index.generated_at.unwrap_or_default(),
        "pages": normalize_surface_pages(pages),
        "apis": normalize_surface_apis(resolved_apis),
        "contractApis": normalize_surface_apis(resolved_contract_apis),
        "nextjsApis": normalize_surface_implementation_apis(nextjs_apis),
        "rustApis": normalize_surface_implementation_apis(rust_apis),
        "implementationApis": normalize_surface_implementation_apis(implementation_apis),
        "metadata": index.metadata.unwrap_or(JsonValue::Null),
        "repoRoot": repo_root.to_string_lossy(),
        "warnings": warnings,
    })
}

async fn list_spec_issues(
    State(state): State<AppState>,
    Query(query): Query<SpecIssuesQuery>,
) -> Result<Json<JsonValue>, ServerError> {
    let repo_root = resolve_repo_root(
        &state,
        query.workspace_id.as_deref(),
        query.codebase_id.as_deref(),
        query.repo_path.as_deref(),
        "缺少上下文：请提供 workspaceId、codebaseId 或 repoPath",
        ResolveRepoRootOptions {
            prefer_current_repo_for_default_workspace: true,
        },
    )
    .await?;

    let issues_dir = repo_root.join("docs").join("issues");
    if !issues_dir.is_dir() {
        return Ok(Json(json!({
            "issues": [],
            "repoRoot": repo_root.to_string_lossy(),
        })));
    }

    if let Some(filename) = normalize_issue_filename(query.filename.as_deref()) {
        let issue_path = issues_dir.join(filename);
        let issue = parse_spec_issue_file(&issue_path, true)
            .ok_or_else(|| ServerError::NotFound("未找到需求记录".to_string()))?;
        return Ok(Json(json!({
            "issue": issue,
            "repoRoot": repo_root.to_string_lossy(),
        })));
    }

    let include_body = should_include_body(query.include_body.as_deref());
    let mut entries: Vec<PathBuf> = std::fs::read_dir(&issues_dir)
        .map_err(|e| ServerError::Internal(format!("读取需求目录失败: {e}")))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".md") && name != "_template.md" && entry.file_type().ok()?.is_file()
            {
                Some(entry.path())
            } else {
                None
            }
        })
        .collect();

    entries.sort_by(|a, b| {
        let a_name = a.file_name().unwrap_or_default().to_string_lossy();
        let b_name = b.file_name().unwrap_or_default().to_string_lossy();
        b_name.cmp(&a_name)
    });

    let mut issues = Vec::new();
    for entry_path in &entries {
        if let Some(issue) = parse_spec_issue_file(entry_path, include_body) {
            issues.push(issue);
        }
    }

    Ok(Json(json!({
        "issues": issues,
        "repoRoot": repo_root.to_string_lossy(),
    })))
}

async fn create_spec_issue(
    State(state): State<AppState>,
    Query(query): Query<SpecIssuesQuery>,
    request: Request,
) -> Result<Response, ServerError> {
    let input = read_create_spec_issue_input(&state, request).await?;
    let title = input_field(&input, "title");
    if title.is_empty() {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "标题不能为空" })),
        )
            .into_response());
    }

    let workspace_id = context_value_from_input(&input, "workspaceId", query.workspace_id);
    let codebase_id = context_value_from_input(&input, "codebaseId", query.codebase_id);
    let repo_path = context_value_from_input(&input, "repoPath", query.repo_path);
    let repo_root = resolve_repo_root(
        &state,
        workspace_id.as_deref(),
        codebase_id.as_deref(),
        repo_path.as_deref(),
        "缺少上下文：请提供 workspaceId、codebaseId 或 repoPath",
        ResolveRepoRootOptions {
            prefer_current_repo_for_default_workspace: true,
        },
    )
    .await?;

    let repo_root_for_response = repo_root.to_string_lossy().to_string();
    let issue = tokio::task::spawn_blocking(move || create_spec_issue_file(&repo_root, input))
        .await
        .map_err(|error| ServerError::Internal(format!("创建需求记录失败: {error}")))?;

    match issue {
        Ok(issue) => Ok((
            StatusCode::CREATED,
            Json(json!({
                "issue": issue,
                "repoRoot": repo_root_for_response,
            })),
        )
            .into_response()),
        Err(CreateSpecIssueError::AttachmentTooLarge(filename)) => Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("附件过大：{filename}") })),
        )
            .into_response()),
        Err(CreateSpecIssueError::Internal(message)) => Ok((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": "创建需求记录失败",
                "details": message,
            })),
        )
            .into_response()),
    }
}

async fn get_spec_issue_asset(
    State(state): State<AppState>,
    Query(query): Query<SpecIssueAssetQuery>,
) -> Result<(HeaderMap, Vec<u8>), ServerError> {
    let attachment_path = normalize_attachment_path(query.path.as_deref())
        .ok_or_else(|| ServerError::BadRequest("附件路径不能为空".to_string()))?;
    let repo_root = resolve_repo_root(
        &state,
        query.workspace_id.as_deref(),
        query.codebase_id.as_deref(),
        query.repo_path.as_deref(),
        "缺少上下文：请提供 workspaceId、codebaseId 或 repoPath",
        ResolveRepoRootOptions {
            prefer_current_repo_for_default_workspace: true,
        },
    )
    .await?;

    let issues_dir = repo_root.join("docs").join("issues");
    let assets_dir = issues_dir.join("assets");
    let file_path = issues_dir.join(&attachment_path);
    if !file_path.starts_with(&assets_dir) {
        return Err(ServerError::BadRequest("附件路径无效".to_string()));
    }

    let real_assets_dir = assets_dir
        .canonicalize()
        .map_err(|_| ServerError::NotFound("未找到附件".to_string()))?;
    let real_file_path = file_path
        .canonicalize()
        .map_err(|_| ServerError::NotFound("未找到附件".to_string()))?;
    if real_file_path != real_assets_dir && !real_file_path.starts_with(&real_assets_dir) {
        return Err(ServerError::BadRequest("附件路径无效".to_string()));
    }

    let data = std::fs::read(&real_file_path)
        .map_err(|_| ServerError::NotFound("未找到附件".to_string()))?;
    let file_name = real_file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let encoded_name = urlencoding::encode(&file_name);
    let mut headers = HeaderMap::new();
    headers.insert("cache-control", "no-store".parse().unwrap());
    headers.insert(
        "content-type",
        content_type_for_attachment(&file_name).parse().unwrap(),
    );
    headers.insert(
        "content-disposition",
        format!("inline; filename*=UTF-8''{encoded_name}")
            .parse()
            .unwrap(),
    );

    Ok((headers, data))
}

async fn get_surface_index(
    State(state): State<AppState>,
    Query(query): Query<SpecIssuesQuery>,
) -> Result<Json<JsonValue>, ServerError> {
    let repo_root = resolve_repo_root(
        &state,
        query.workspace_id.as_deref(),
        query.codebase_id.as_deref(),
        query.repo_path.as_deref(),
        "缺少上下文：请提供 workspaceId、codebaseId 或 repoPath",
        ResolveRepoRootOptions {
            prefer_current_repo_for_default_workspace: true,
        },
    )
    .await?;

    let index_path = repo_root
        .join("docs")
        .join("product-specs")
        .join("feature-tree.index.json");
    let feature_tree_path = repo_root
        .join("docs")
        .join("product-specs")
        .join("FEATURE_TREE.md");
    let api_contract_path = repo_root.join("api-contract.yaml");
    let relative_index_path = index_path
        .strip_prefix(&repo_root)
        .unwrap_or(&index_path)
        .to_string_lossy()
        .to_string();
    let relative_feature_tree_path = feature_tree_path
        .strip_prefix(&repo_root)
        .unwrap_or(&feature_tree_path)
        .to_string_lossy()
        .to_string();
    let relative_api_contract_path = api_contract_path
        .strip_prefix(&repo_root)
        .unwrap_or(&api_contract_path)
        .to_string_lossy()
        .to_string();

    let mut warnings = Vec::new();
    let parsed_markdown = if feature_tree_path.exists() {
        match FeatureTreeCatalog::from_feature_tree_markdown(&feature_tree_path) {
            Ok(catalog) => Some(to_surface_index_from_feature_tree(catalog)),
            Err(error) => {
                warnings.push(format!(
                    "解析产品面索引失败：{relative_feature_tree_path}: {error}"
                ));
                None
            }
        }
    } else {
        None
    };
    let parsed_index = if parsed_markdown.is_none() {
        match std::fs::read_to_string(&index_path) {
            Ok(raw) => match serde_json::from_str::<FeatureSurfaceIndexFile>(&raw) {
                Ok(index) => Some(index),
                Err(_) => {
                    warnings.push(format!("产品面索引 JSON 无效：{relative_index_path}"));
                    None
                }
            },
            Err(_) => {
                warnings.push(format!("未找到产品面索引：{relative_index_path}"));
                None
            }
        }
    } else {
        None
    };

    let openapi_contract_apis = if api_contract_path.exists() {
        match api_endpoints_from_openapi_contract(&api_contract_path) {
            Ok(apis) => {
                if apis.is_empty() {
                    warnings.push(format!(
                        "OpenAPI 合约未生成端点：{relative_api_contract_path}"
                    ));
                }
                Some(to_surface_api_from_contract(apis))
            }
            Err(error) => {
                warnings.push(format!(
                    "解析 OpenAPI 合约失败：{relative_api_contract_path}: {error}"
                ));
                None
            }
        }
    } else {
        None
    };

    match (parsed_markdown, parsed_index, openapi_contract_apis) {
        (Some(index), _, openapi_contract_apis) => Ok(Json(normalize_surface_index(
            index,
            openapi_contract_apis.unwrap_or_default(),
            &repo_root,
            warnings,
        ))),
        (None, Some(index), openapi_contract_apis) => Ok(Json(normalize_surface_index(
            index,
            openapi_contract_apis.unwrap_or_default(),
            &repo_root,
            warnings,
        ))),
        (None, None, Some(openapi_contract_apis)) => Ok(Json(normalize_surface_index(
            FeatureSurfaceIndexFile::default(),
            openapi_contract_apis,
            &repo_root,
            warnings,
        ))),
        (None, None, None) => Ok(Json(empty_surface_index_response(&repo_root, warnings))),
    }
}

// ── Feature tree generation ─────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureTreeContextQuery {
    workspace_id: Option<String>,
    codebase_id: Option<String>,
    repo_path: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateFeatureTreeRequest {
    workspace_id: Option<String>,
    codebase_id: Option<String>,
    repo_path: Option<String>,
    #[serde(default)]
    dry_run: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitFeatureTreeRequest {
    workspace_id: Option<String>,
    codebase_id: Option<String>,
    repo_path: Option<String>,
    scan_root: Option<String>,
    metadata: Option<JsonValue>,
}

async fn resolve_feature_tree_repo_root(
    state: &AppState,
    workspace_id: Option<&str>,
    codebase_id: Option<&str>,
    repo_path: Option<&str>,
) -> Result<PathBuf, ServerError> {
    resolve_repo_root(
        state,
        workspace_id,
        codebase_id,
        repo_path,
        "缺少上下文：请提供 workspaceId、codebaseId 或 repoPath",
        ResolveRepoRootOptions {
            prefer_current_repo_for_default_workspace: true,
        },
    )
    .await
}

fn resolve_feature_tree_scan_root(
    repo_root: &Path,
    scan_root: Option<&str>,
) -> Result<Option<PathBuf>, ServerError> {
    let Some(scan_root) = scan_root else {
        return Ok(None);
    };

    let resolved = PathBuf::from(scan_root);
    if !resolved.exists() {
        return Err(ServerError::BadRequest(
            "scanRoot does not exist".to_string(),
        ));
    }

    let real_scan_root = resolved
        .canonicalize()
        .map_err(|e| ServerError::Internal(format!("Failed to resolve scanRoot: {e}")))?;
    let real_repo_root = repo_root
        .canonicalize()
        .map_err(|e| ServerError::Internal(format!("Failed to resolve repoPath: {e}")))?;

    if real_scan_root != real_repo_root && !real_scan_root.starts_with(&real_repo_root) {
        return Err(ServerError::BadRequest(
            "scanRoot must be inside the repository".to_string(),
        ));
    }

    Ok(Some(real_scan_root))
}

fn validate_feature_tree_metadata(
    metadata: Option<JsonValue>,
) -> Result<Option<JsonValue>, ServerError> {
    let Some(metadata) = metadata else {
        return Ok(None);
    };

    let has_features = metadata
        .as_object()
        .and_then(|object| object.get("features"))
        .and_then(JsonValue::as_array)
        .is_some();

    if !has_features {
        return Err(ServerError::BadRequest(
            "Invalid metadata: must contain a features array".to_string(),
        ));
    }

    Ok(Some(metadata))
}

async fn preflight_feature_tree(
    State(state): State<AppState>,
    Query(query): Query<FeatureTreeContextQuery>,
) -> Result<Json<JsonValue>, ServerError> {
    let repo_root = resolve_feature_tree_repo_root(
        &state,
        query.workspace_id.as_deref(),
        query.codebase_id.as_deref(),
        query.repo_path.as_deref(),
    )
    .await?;

    let result = tokio::task::spawn_blocking(move || {
        crate::feature_tree::preflight_feature_tree_json(&repo_root)
    })
    .await
    .map_err(|e| ServerError::Internal(format!("Task join error: {e}")))?
    .map_err(ServerError::Internal)?;

    Ok(Json(result))
}

async fn generate_feature_tree(
    State(state): State<AppState>,
    body: Result<Json<GenerateFeatureTreeRequest>, axum::extract::rejection::JsonRejection>,
) -> Result<Json<JsonValue>, ServerError> {
    let Json(body) = body.map_err(|_| ServerError::BadRequest("Invalid JSON body".to_string()))?;
    let repo_root = resolve_feature_tree_repo_root(
        &state,
        body.workspace_id.as_deref(),
        body.codebase_id.as_deref(),
        body.repo_path.as_deref(),
    )
    .await?;

    let dry_run = body.dry_run;
    let result = tokio::task::spawn_blocking(move || {
        crate::feature_tree::generate_feature_tree_json(&repo_root, dry_run)
    })
    .await
    .map_err(|e| ServerError::Internal(format!("Task join error: {e}")))?
    .map_err(ServerError::Internal)?;

    Ok(Json(result))
}

async fn commit_feature_tree(
    State(state): State<AppState>,
    body: Result<Json<CommitFeatureTreeRequest>, axum::extract::rejection::JsonRejection>,
) -> Result<Json<JsonValue>, ServerError> {
    let Json(body) = body.map_err(|_| ServerError::BadRequest("Invalid JSON body".to_string()))?;
    let repo_root = resolve_feature_tree_repo_root(
        &state,
        body.workspace_id.as_deref(),
        body.codebase_id.as_deref(),
        body.repo_path.as_deref(),
    )
    .await?;
    let scan_root = resolve_feature_tree_scan_root(&repo_root, body.scan_root.as_deref())?;
    let metadata = validate_feature_tree_metadata(body.metadata)?;

    let result = tokio::task::spawn_blocking(move || {
        crate::feature_tree::commit_feature_tree_json(
            &repo_root,
            scan_root.as_deref(),
            metadata.as_ref(),
        )
    })
    .await
    .map_err(|e| ServerError::Internal(format!("Task join error: {e}")))?
    .map_err(ServerError::Internal)?;

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_issue_frontmatter() {
        let temp = tempfile::tempdir().unwrap();
        let issues_dir = temp.path().join("docs").join("issues");
        fs::create_dir_all(&issues_dir).unwrap();
        fs::write(
            issues_dir.join("2026-01-01-test-issue.md"),
            r#"---
title: "Test Issue"
date: "2026-01-01"
kind: issue
status: open
severity: high
area: "frontend"
tags: ["bug", "ui"]
reported_by: "agent"
related_issues: []
---

# Test Issue

Some body content."#,
        )
        .unwrap();

        let raw = fs::read_to_string(issues_dir.join("2026-01-01-test-issue.md")).unwrap();
        let (fm_str, body) = extract_frontmatter(&raw).unwrap();
        let fm: serde_yaml::Value = serde_yaml::from_str(&fm_str).unwrap();

        assert_eq!(fm.get("title").unwrap().as_str().unwrap(), "Test Issue");
        assert_eq!(fm.get("status").unwrap().as_str().unwrap(), "open");
        assert_eq!(fm.get("severity").unwrap().as_str().unwrap(), "high");
        assert!(body.contains("Some body content."));
    }

    #[test]
    fn normalizes_unquoted_dates_and_closed_status() {
        let fm: serde_yaml::Value = serde_yaml::from_str(
            r#"
date: 2026-03-02
status: closed
github_issue: "410"
"#,
        )
        .unwrap();

        assert_eq!(yaml_string_field(&fm, "date"), "2026-03-02");
        assert_eq!(
            normalize_status(&yaml_string_field(&fm, "status")),
            "resolved"
        );
        assert_eq!(
            yaml_optional_number(&fm, "github_issue"),
            Some(JsonValue::Number(410.into()))
        );
    }
}
