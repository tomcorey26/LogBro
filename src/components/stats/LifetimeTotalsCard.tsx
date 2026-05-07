"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";

export function LifetimeTotalsCard({
  totalSeconds,
  totalSessions,
}: {
  totalSeconds: number;
  totalSessions: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Lifetime</h3>
        <p className="text-3xl font-bold mt-1">{formatTime(totalSeconds)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {totalSessions} {totalSessions === 1 ? "session" : "sessions"}
        </p>
      </CardContent>
    </Card>
  );
}
