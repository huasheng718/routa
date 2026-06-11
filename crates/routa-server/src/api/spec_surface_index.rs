use std::collections::BTreeMap;
use std::path::Path;

use feature_trace::{
    api_endpoints_from_openapi_contract, ApiEndpointDetail, FeatureTreeCatalog, FrontendPageDetail,
    ImplementationApiRoute,
};
use serde::Deserialize;
use serde_json::{json, Value as JsonValue};

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

pub(crate) fn read_surface_index(repo_root: &Path) -> JsonValue {
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
        .strip_prefix(repo_root)
        .unwrap_or(&index_path)
        .to_string_lossy()
        .to_string();
    let relative_feature_tree_path = feature_tree_path
        .strip_prefix(repo_root)
        .unwrap_or(&feature_tree_path)
        .to_string_lossy()
        .to_string();
    let relative_api_contract_path = api_contract_path
        .strip_prefix(repo_root)
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
        (Some(index), _, openapi_contract_apis) => normalize_surface_index(
            index,
            openapi_contract_apis.unwrap_or_default(),
            repo_root,
            warnings,
        ),
        (None, Some(index), openapi_contract_apis) => normalize_surface_index(
            index,
            openapi_contract_apis.unwrap_or_default(),
            repo_root,
            warnings,
        ),
        (None, None, Some(openapi_contract_apis)) => normalize_surface_index(
            FeatureSurfaceIndexFile::default(),
            openapi_contract_apis,
            repo_root,
            warnings,
        ),
        (None, None, None) => empty_surface_index_response(repo_root, warnings),
    }
}
