"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";

export function WeekMonthCard({
  weekSeconds,
  monthSeconds,
}: {
  weekSeconds: number;
  monthSeconds: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            This week
          </h3>
          <p className="text-2xl font-bold mt-1">{formatTime(weekSeconds)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            This month
          </h3>
          <p className="text-2xl font-bold mt-1">{formatTime(monthSeconds)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
