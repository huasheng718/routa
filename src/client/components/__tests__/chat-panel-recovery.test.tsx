import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatPanel } from "../chat-panel";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: {
      common: { tasks: "Tasks", copyToClipboard: "Copy", dismiss: "Dismiss" },
      sessions: { sessionInfo: "Session:", placeholder: "Placeholder", repoPath: "Repo Path", craftersLabel: "Crafters", concurrencyLabel: "Concurrency", mcpTools: "MCP Tools", tracesLabel: "Traces" },
      chat: {
        viewToggle: { chat: "Chat", trace: "Trace" },
        typeMessage: "Type a message",
        typeCreateSession: "Create a session",
        connectFirst: "Connect first",
        authRequiredTitle: "Auth required",
        availableAuthMethods: "Available auth methods",
      },
    },
  }),
}));

vi.mock("../tiptap-input", () => ({
  TiptapInput: ({ onSend }: { onSend: (text: string, context: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => onSend("读取本项目", { provider: "opencode", model: "kimi-k2.5" })}>
      send
    </button>
  ),
}));

vi.mock("../chat-panel/hooks", () => ({
  useChatMessages: () => ({
    visibleMessages: [],
    sessions: [],
    sessionModeById: {},
    isSessionRunning: false,
    checklistItems: [],
    fileChangesState: {
      files: new Map(),
      totalAdded: 0,
      totalRemoved: 0,
    },
    usageInfo: null,
    setMessagesBySession: vi.fn((updater) => updater({})),
    setIsSessionRunning: vi.fn(),
    fetchSessions: vi.fn(),
    resetStreamingRefs: vi.fn(),
  }),
}));

vi.mock("@/client/components/message-bubble", () => ({
  MessageBubble: () => null,
  AskUserQuestionBubble: () => null,
  isAskUserQuestionMessage: () => false,
  hasAskUserQuestionAnswers: () => false,
}));

vi.mock("@/client/components/trace-panel", () => ({
  TracePanel: () => null,
}));

vi.mock("../task-progress-bar", () => ({
  TaskProgressBar: () => null,
}));

vi.mock("./chat-panel/components", () => ({
  SetupView: () => null,
}));

describe("ChatPanel session recovery", () => {
  it("creates a fresh session when the current session cannot be resumed", async () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    const promptSession = vi.fn(async () => {
      throw new Error("Session ownership lease expired on instance next-123 at 2026-04-08T00:00:00.000Z, and embedded ACP processes cannot be resumed on a different instance.");
    });
    const onRecoverSession = vi.fn(async () => "session-2");

    render(
      <ChatPanel
        acp={{
          connected: true,
          loading: false,
          error: null,
          authError: null,
          dockerConfigError: null,
          updates: [],
          providers: [{ id: "opencode", name: "OpenCode", description: "OpenCode", command: "opencode" }],
          selectedProvider: "opencode",
          sessionId: "session-1",
          connect: vi.fn(async () => {}),
          createSession: vi.fn(async () => null),
          selectSession: vi.fn(),
          setProvider: vi.fn(),
          setMode: vi.fn(async () => {}),
          prompt: vi.fn(async () => {}),
          promptSession,
          respondToUserInput: vi.fn(async () => {}),
          respondToUserInputForSession: vi.fn(async () => {}),
          cancel: vi.fn(async () => {}),
          disconnect: vi.fn(),
          clearAuthError: vi.fn(),
          clearDockerConfigError: vi.fn(),
          listProviderModels: vi.fn(async () => []),
          writeTerminal: vi.fn(async () => {}),
          resizeTerminal: vi.fn(async () => {}),
        }}
        activeSessionId="session-1"
        traceSessionId="session-1"
        onEnsureSession={vi.fn(async () => "session-1")}
        onRecoverSession={onRecoverSession}
        onSelectSession={vi.fn(async () => {})}
        repoSelection={{ name: "repo", path: "/tmp/repo", branch: "main" }}
        onRepoChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(promptSession).toHaveBeenCalled();
      expect(onRecoverSession).toHaveBeenCalledWith("读取本项目", {
        provider: "opencode",
        model: "kimi-k2.5",
        cwd: "/tmp/repo",
      });
    });
  });
});
