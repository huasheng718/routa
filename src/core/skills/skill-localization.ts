import type { SkillDefinition } from "./skill-loader";

export const DEFAULT_SKILL_LOCALE = "en";
export const ZH_CN_SKILL_LOCALE = "zh-CN";

type SkillLocalizationEntry = {
  description?: string;
  shortDescription?: string;
};

const ZH_CN_SKILL_LOCALIZATIONS: Record<string, SkillLocalizationEntry> = {
  "agent-browser": {
    description: "浏览器自动化 CLI，适合打开网站、填写表单、点击按钮、截图、抓取数据和联调 Web 流程。",
    shortDescription: "浏览器自动化与网页联调",
  },
  docx: {
    description: "用于创建、编辑、审阅 DOCX 文档，包括格式化、批注、修订、无障碍检查和差异校验。",
    shortDescription: "DOCX 文档处理",
  },
  dogfood: {
    description: "系统化探索和测试 Web 应用，输出可复现的缺陷、截图、录像和复现步骤。",
    shortDescription: "Web 产品体验测试",
  },
  electron: {
    description: "通过桌面自动化控制 Electron 应用，例如 VS Code、Slack、Discord、Figma、Notion 等。",
    shortDescription: "Electron 桌面应用自动化",
  },
  pdf: {
    description: "用于 PDF 生成、转换、检查、抽取、表单填写、OCR、比对和脱敏。",
    shortDescription: "PDF 处理",
  },
  slack: {
    description: "通过浏览器自动化操作 Slack，适合查未读、搜消息、提取信息和发送消息。",
    shortDescription: "Slack 自动化",
  },
  slide: {
    description: "用于创建和编辑演示文稿，可作为幻灯片结构、文案和版式参考技能。",
    shortDescription: "演示文稿与幻灯片",
  },
  spreadsheets: {
    description: "用于创建和编辑电子表格，包括公式、建模、图表、格式化和数据分析。",
    shortDescription: "电子表格处理",
  },
  "find-skills": {
    description: "帮助发现、推荐和安装适合当前任务的技能。",
    shortDescription: "查找并安装技能",
  },
  playwright: {
    description: "适合在真实浏览器里做页面自动化、导航、填表、抓取、快照和 UI 联调。",
    shortDescription: "Playwright 浏览器自动化",
  },
  "playwright-interactive": {
    description: "提供持久化浏览器/Electron 交互环境，适合迭代式 UI 调试。",
    shortDescription: "交互式浏览器调试",
  },
  "skill-creator": {
    description: "用于创建、改进和评估技能，优化技能描述、结构和触发效果。",
    shortDescription: "技能创建与优化",
  },
  imagegen: {
    description: "生成或编辑位图图像，适合照片、插画、材质、精灵图和透明背景素材。",
    shortDescription: "位图图像生成与编辑",
  },
  "openai-docs": {
    description: "查询 OpenAI 官方文档，适合模型选型、API 用法和最新能力说明。",
    shortDescription: "OpenAI 官方文档查询",
  },
  "plugin-creator": {
    description: "用于创建和搭建 Codex 插件目录、插件清单与基础结构。",
    shortDescription: "插件创建",
  },
  "skill-installer": {
    description: "从精选列表或 GitHub 仓库安装技能到本地技能目录。",
    shortDescription: "技能安装器",
  },
};

function extractPrimaryLocale(locale?: string | null): string | undefined {
  const trimmed = locale?.trim();
  if (!trimmed) return undefined;
  return trimmed.split(",")[0]?.split(";")[0]?.trim();
}

export function normalizeSkillLocale(locale?: string | null): string {
  const primary = extractPrimaryLocale(locale);
  if (!primary) return DEFAULT_SKILL_LOCALE;

  const lower = primary.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) {
    return ZH_CN_SKILL_LOCALE;
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return DEFAULT_SKILL_LOCALE;
  }

  return primary;
}

export function localizeSkillDefinition(
  skill: SkillDefinition,
  locale?: string | null,
): SkillDefinition {
  const normalizedLocale = normalizeSkillLocale(locale);
  if (normalizedLocale !== ZH_CN_SKILL_LOCALE) {
    return skill;
  }

  const localized = ZH_CN_SKILL_LOCALIZATIONS[skill.name];
  if (!localized) {
    return skill;
  }

  return {
    ...skill,
    description: localized.description ?? skill.description,
    shortDescription: localized.shortDescription ?? skill.shortDescription,
  };
}
