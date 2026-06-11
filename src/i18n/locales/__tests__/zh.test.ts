import { describe, expect, it } from "vitest";
import zh from "../zh";

describe("zh spec board copy", () => {
  it("includes the spec relationship labels used by the workspace spec page", () => {
    expect(zh.specBoard.description).toContain("本地需求记录层");
    expect(zh.specBoard.status).toBe("状态");
    expect(zh.specBoard.githubLinked).toBe("已关联 GitHub");
    expect(zh.specBoard.connectedIssues).toBe("已连接问题");
    expect(zh.specBoard.families).toBe("关系簇");
    expect(zh.specBoard.featureFootprint).toBe("影响面");
    expect(zh.specBoard.expandBranch).toBe("展开分支");
    expect(zh.specBoard.issueLinks).toBe("关联需求");
    expect(zh.specBoard.linkedFrom).toBe("被这些需求引用");
    expect(zh.specBoard.noLinkedIssues).toBe("当前没有记录关联需求。");
    expect(zh.specBoard.noBacklinks).toBe("目前还没有其它需求指向这里。");
    expect(zh.specBoard.createIssuePrimarySection).toBe("需求内容");
    expect(zh.specBoard.createIssueMetaSection).toBe("分类信息");
    expect(zh.specBoard.createIssueAttachmentsTitle).toBe("附件材料");
    expect(zh.specBoard.mergeCreateKanbanTask).toBe("合并创建看板任务");
    expect(zh.specBoard.mergeOpenWorkspace).toBe("合并开启工作区");
    expect(zh.specBoard.mergeSourcesTitle).toBe("合并来源需求");
  });
});
