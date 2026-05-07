import Image from "next/image";
import Link from "next/link";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import { TabNav } from "@/components/TabNav";
import { LogoutButton } from "@/components/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import { TimerSync } from "@/components/TimerSync";
import { MiniTimerBar } from "@/components/MiniTimerBar";
import { RoutineSync } from "@/components/RoutineSync";
import { RoutineActionBar } from "@/components/RoutineActionBar";
import { APP_NAME } from "@/data/app";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="h-dvh flex flex-col bg-background">
        {/* Header */}
        <header className="shrink-0 px-4 pt-6 pb-4 flex items-center justify-between md:px-6 md:border-b">
          <div className="flex items-center gap-2">
            <Image src="/icon.webp" alt="" width={28} height={28} />
            <h1 className="text-xl font-mono font-semibold">{APP_NAME}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Account
            </Link>
            <LogoutButton />
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 min-h-0 min-w-0">
          {/* Sidebar – desktop only */}
          <aside className="hidden md:flex flex-col w-52 shrink-0 border-r px-3 py-4">
            <TabNav orientation="vertical" />
          </aside>

          {/* Content column */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Mobile tab nav */}
            <div className="px-4 pt-2 md:hidden">
              <TabNav />
            </div>

            <main className="flex-1 min-h-0 overflow-auto py-0.5 px-4 md:px-6 md:pt-6 pb-16 md:pb-6">
              <div className="w-full md:max-w-2xl md:mx-auto min-h-full flex flex-col">
                {children}
              </div>
            </main>
          </div>
        </div>

        <RoutineActionBar />
        <MiniTimerBar />
        <Toaster position="top-center" />
        <TimerSync />
        <RoutineSync />
      </div>
    </Providers>
  );
}
