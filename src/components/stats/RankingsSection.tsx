"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import type { Ranking } from "@/server/db/stats";

const RANK_COLORS: Record<number, string> = {
  1: "text-rank-gold",
  2: "text-rank-silver",
  3: "text-rank-bronze",
};

const TOP_N = 5;

export function RankingsSection({ rankings }: { rankings: Ranking[] }) {
  const [expanded, setExpanded] = useState(false);

  if (rankings.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-2">Rankings</h3>
        <p className="text-sm text-muted-foreground py-4">No rankings yet</p>
      </div>
    );
  }

  const visible = expanded ? rankings : rankings.slice(0, TOP_N);
  const hasMore = rankings.length > TOP_N;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Rankings</h3>
      {visible.map((r) => (
        <Card key={r.habitId}>
          <CardContent className="p-3 flex items-center gap-3">
            <span
              className={`text-lg font-bold w-8 ${
                RANK_COLORS[r.rank] || "text-muted-foreground"
              }`}
            >
              #{r.rank}
            </span>
            <span className="font-medium flex-1 truncate min-w-0">
              {r.habitName}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              {formatTime(r.totalSeconds)}
            </span>
          </CardContent>
        </Card>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all (${rankings.length})`}
        </Button>
      )}
    </div>
  );
}
