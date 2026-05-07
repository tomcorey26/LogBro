"use client";

import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StreaksCard({
  current,
  longest,
}: {
  current: number;
  longest: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground">Streaks</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-2xl font-bold mt-1">
              {current} <span className="text-sm font-normal text-muted-foreground">{current === 1 ? "day" : "days"}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Longest</p>
            <p className="text-2xl font-bold mt-1">
              {longest} <span className="text-sm font-normal text-muted-foreground">{longest === 1 ? "day" : "days"}</span>
            </p>
          </div>
        </div>
        {current > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Don&apos;t break the chain.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
