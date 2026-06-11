export const AGENT_REFRESH_BURST_DELAYS_MS = [1_000, 4_000, 8_000, 12_000] as const;
export { buildKanbanTaskAgentPrompt } from "./i18n/kanban-task-agent";

let activeBurstCancel: (() => void) | null = null;

export function scheduleKanbanRefreshBurst(onRefresh: () => void): () => void {
  activeBurstCancel?.();

  const timerIds = AGENT_REFRESH_BURST_DELAYS_MS.map((delay) => window.setTimeout(() => {
    onRefresh();
  }, delay));

  const cancel = () => {
    for (const timerId of timerIds) {
      window.clearTimeout(timerId);
    }
    if (activeBurstCancel === cancel) {
      activeBurstCancel = null;
    }
  };
  activeBurstCancel = cancel;
  return cancel;
}
