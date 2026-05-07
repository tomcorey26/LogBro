'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeleteWithUndo } from '@/hooks/use-delete-with-undo';
import { CalendarView } from '@/components/CalendarView';
import { List, CalendarDays, Trash2, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { useHistory, useDeleteHistoryEntry } from '@/hooks/use-history';
import { useHaptics } from '@/hooks/use-haptics';
import type { HistoryEntry, HistoryListItem, HistoryRoutineGroup } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';

type DateRange = 'today' | 'week' | 'month' | 'all';

export function HistoryView({
  habits,
  initialHistory,
  initialTotalSeconds,
}: {
  habits: { id: number; name: string }[];
  initialHistory?: HistoryListItem[];
  initialTotalSeconds?: number;
}) {
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const { trigger } = useHaptics();
  const deleteEntry = useDeleteHistoryEntry();
  const { pendingIds, scheduleDelete } = useDeleteWithUndo((id) =>
    deleteEntry.mutateAsync(id),
  );

  const initialData = initialHistory ? { history: initialHistory, totalSeconds: initialTotalSeconds ?? 0 } : undefined;
  const { data } = useHistory({ habitId: selectedHabitId || undefined, range: dateRange, viewMode }, initialData);
  const items: HistoryListItem[] = data?.history ?? [];
  const totalSeconds = data?.totalSeconds ?? 0;

  // Filter pending-deleted items: keep groups whose entries aren't all pending,
  // and keep flat sessions whose id isn't pending.
  const visibleItems: HistoryListItem[] = items.flatMap((item): HistoryListItem[] => {
    if (item.kind === 'session') {
      return pendingIds.has(item.entry.id) ? [] : [item];
    }
    const remaining = item.entries.filter((e) => !pendingIds.has(e.id));
    if (remaining.length === 0) return [];
    if (remaining.length === item.entries.length) return [item];
    const totalDurationSeconds = remaining.reduce((s, e) => s + e.durationSeconds, 0);
    return [{ ...item, entries: remaining, totalDurationSeconds }];
  });

  // Flat list of HistoryEntry for calendar view (entries from groups + flat sessions).
  const calendarEntries: HistoryEntry[] = items.flatMap((item) =>
    item.kind === 'session' ? [item.entry] : item.entries,
  ).filter((e) => !pendingIds.has(e.id));

  const dateRanges: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function formatTimeOfDay(iso: string) {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit',
    });
  }

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function itemKey(item: HistoryListItem): string {
    return item.kind === 'session' ? `s-${item.entry.id}` : `r-${item.routineSessionId}`;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="History" />
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-ellipsis"
          >
            <option value="">All Skills</option>
            {habits.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <div className="flex rounded-md border border-input">
            <button
              onClick={() => { trigger('selection'); setViewMode('list'); }}
              className={`p-2 rounded-l-md transition-colors ${viewMode === 'list' ? 'bg-muted' : ''}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => { trigger('selection'); setViewMode('calendar'); }}
              className={`p-2 rounded-r-md transition-colors ${viewMode === 'calendar' ? 'bg-muted' : ''}`}
              aria-label="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="flex gap-1">
            {dateRanges.map(r => (
              <Button
                key={r.value}
                variant={dateRange === r.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => { trigger('light'); setDateRange(r.value); }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {viewMode === 'list' && (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">Total Time</p>
          <p className="text-2xl font-bold">{formatTime(totalSeconds)}</p>
        </div>
      )}

      {/* History list or calendar */}
      {viewMode === 'calendar' ? (
        <CalendarView sessions={calendarEntries} habits={habits} />
      ) : visibleItems.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No history yet</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {visibleItems.map((item) => (
              <motion.div
                key={itemKey(item)}
                layout
                exit={{ opacity: 0, x: -80, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {item.kind === 'session' ? (
                  <SessionCard
                    entry={item.entry}
                    onDelete={() => {
                      trigger('error');
                      scheduleDelete(item.entry.id, `${item.entry.habitName} session`);
                    }}
                    formatDate={formatDate}
                    formatTimeOfDay={formatTimeOfDay}
                    formatDuration={formatDuration}
                  />
                ) : (
                  <RoutineGroupCard
                    group={item}
                    onDeleteEntry={(entry) => {
                      trigger('error');
                      scheduleDelete(entry.id, `${entry.habitName} session`);
                    }}
                    formatDate={formatDate}
                    formatTimeOfDay={formatTimeOfDay}
                    formatDuration={formatDuration}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  entry,
  onDelete,
  formatDate,
  formatTimeOfDay,
  formatDuration,
}: {
  entry: HistoryEntry;
  onDelete: () => void;
  formatDate: (iso: string) => string;
  formatTimeOfDay: (iso: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1 min-w-0">
          <span className="font-medium truncate min-w-0 mr-2">{entry.habitName}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
              {entry.timerMode}
            </span>
            <button
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Delete entry"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatDate(entry.endTime)}</span>
          <span className="font-mono">{formatDuration(entry.durationSeconds)}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {formatTimeOfDay(entry.startTime)} — {formatTimeOfDay(entry.endTime)}
        </div>
      </CardContent>
    </Card>
  );
}

function RoutineGroupCard({
  group,
  onDeleteEntry,
  formatDate,
  formatTimeOfDay,
  formatDuration,
}: {
  group: HistoryRoutineGroup;
  onDeleteEntry: (entry: HistoryEntry) => void;
  formatDate: (iso: string) => string;
  formatTimeOfDay: (iso: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const setCount = group.entries.length;

  return (
    <Card>
      <CardContent className="p-3">
        <button
          type="button"
          className="w-full text-left"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center justify-between mb-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate min-w-0">{group.routineNameSnapshot}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
              routine
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatDate(group.finishedAt)}</span>
            <span className="font-mono">{formatDuration(group.totalDurationSeconds)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {setCount} {setCount === 1 ? 'set' : 'sets'} · {formatTimeOfDay(group.startedAt)} — {formatTimeOfDay(group.finishedAt)}
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {group.entries.map((entry) => (
              <div key={entry.id} className="rounded-md bg-muted/40 p-2">
                <div className="flex items-center justify-between mb-1 min-w-0">
                  <span className="font-medium truncate min-w-0 mr-2 text-sm">{entry.habitName}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete entry"
                    onClick={() => onDeleteEntry(entry)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatTimeOfDay(entry.startTime)} — {formatTimeOfDay(entry.endTime)}
                  </span>
                  <span className="font-mono">{formatDuration(entry.durationSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
