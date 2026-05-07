import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { StatsView } from "@/components/StatsView";
import { getSessionUserId } from "@/lib/auth";
import { getStatsForUser } from "@/server/db/stats";

export default async function StatsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const stats = await getStatsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <StatsView initialStats={stats} />
    </Suspense>
  );
}
