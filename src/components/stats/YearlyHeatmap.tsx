"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import type { HeatmapGrid } from "@/lib/stats";

const BUCKET_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-primary/20",
  2: "bg-primary/40",
  3: "bg-primary/70",
  4: "bg-primary",
};

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTooltipDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthLabels(grid: HeatmapGrid): (string | null)[] {
  // For each week column, label it if its first (Monday) day is in a different
  // calendar month from the previous week's first day.
  const labels: (string | null)[] = [];
  let prevMonth = -1;
  for (const week of grid.weeks) {
    const firstDay = week.days[0].date;
    const month = Number(firstDay.slice(5, 7)) - 1;
    if (month !== prevMonth) {
      labels.push(MONTH_NAMES[month]);
      prevMonth = month;
    } else {
      labels.push(null);
    }
  }
  return labels;
}

export function YearlyHeatmap({
  grid,
  isEmpty,
}: {
  grid: HeatmapGrid;
  isEmpty: boolean;
}) {
  const monthLabels = buildMonthLabels(grid);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Last 12 months</h3>
          {isEmpty && (
            <span className="text-xs text-muted-foreground">
              Log your first session to start your heat map.
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1 min-w-full">
            {/* Month label row */}
            <div className="flex gap-0.5 pl-8">
              {monthLabels.map((label, i) => (
                <div
                  key={i}
                  className="w-3 text-[10px] text-muted-foreground text-left"
                >
                  {label ?? ""}
                </div>
              ))}
            </div>

            {/* Grid: 7 rows × 53 columns */}
            <div className="flex gap-0.5">
              {/* Weekday labels column */}
              <div className="flex flex-col gap-0.5 pr-1 w-7">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="h-3 text-[10px] leading-3 text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {/* Week columns */}
              {grid.weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.days.map((day) => (
                    <div
                      key={day.date}
                      className={`h-3 w-3 rounded-sm ${
                        day.isFuture
                          ? "bg-transparent"
                          : BUCKET_CLASSES[day.bucket]
                      }`}
                      title={
                        day.isFuture
                          ? ""
                          : day.seconds > 0
                            ? `${formatTooltipDate(day.date)} · ${formatTime(day.seconds)}`
                            : `${formatTooltipDate(day.date)} · No sessions`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((b) => (
                <span
                  key={b}
                  className={`block h-3 w-3 rounded-sm ${BUCKET_CLASSES[b]}`}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
