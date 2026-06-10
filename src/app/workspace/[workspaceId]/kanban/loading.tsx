import { Columns2 } from "lucide-react";

export default function KanbanLoading() {
  return (
    <div className="flex h-screen flex-col bg-desktop-bg-primary text-desktop-text-primary">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-desktop-border px-4">
        <Columns2 className="h-4 w-4 text-desktop-text-secondary" aria-hidden="true" />
        <div className="h-3 w-24 animate-pulse rounded bg-desktop-bg-active" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        {Array.from({ length: 5 }).map((_, columnIndex) => (
          <div
            key={columnIndex}
            className="flex min-w-[220px] flex-1 flex-col overflow-hidden rounded-lg border border-desktop-border bg-desktop-bg-secondary"
          >
            <div className="flex h-10 shrink-0 items-center border-b border-desktop-border px-3">
              <div className="h-3 w-20 animate-pulse rounded bg-desktop-bg-active" />
            </div>
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div
                  key={cardIndex}
                  className="h-20 animate-pulse rounded-md border border-desktop-border bg-desktop-bg-primary"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
