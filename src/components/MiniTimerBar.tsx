"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTimerStore } from "@/stores/timer-store";
import { useRoutineSessionStore } from "@/stores/routine-session-store";
import { useHaptics } from "@/hooks/use-haptics";

export function MiniTimerBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { trigger } = useHaptics();
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const displayTime = useTimerStore((s) => s.displayTime);
  const routineMode = useRoutineSessionStore((s) => s.mode);

  // Hidden when an active/summary routine session is in flight (mutual exclusion)
  if (routineMode === "active" || routineMode === "summary") return null;

  // Hidden when no timer or on /habits (which shows full timer view)
  if (!activeTimer || pathname.startsWith("/habits")) return null;

  return (
    <button
      onClick={() => {
        trigger("light");
        router.push("/habits");
      }}
      className="w-full pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-primary/10 border-t border-primary/30 hover:bg-primary/15 transition-colors"
    >
      <div className="md:ml-52 px-4 md:px-6">
        <div className="w-full md:max-w-2xl md:mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-sm truncate max-w-[200px]">
              {activeTimer.habitName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{displayTime}</span>
            <span className="text-xs text-muted-foreground">&rarr;</span>
          </div>
        </div>
      </div>
    </button>
  );
}
