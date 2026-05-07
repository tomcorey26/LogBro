'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Clock, ListChecks, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSaveRoutineSession } from '@/hooks/use-active-routine';
import { useHaptics } from '@/hooks/use-haptics';
import { formatTime } from '@/lib/format';
import type { RoutineSessionSummary as Summary } from '@/lib/types';

function playFanfare() {
  try {
    new Audio('/fanfare.mp3').play().catch(() => {});
  } catch {}
}

type Props = {
  summary: Summary;
  onDiscard: () => void;
  onSaved: () => void;
  onBack: () => void;
};

export function RoutineSessionSummary({ summary, onDiscard, onSaved, onBack }: Props) {
  const save = useSaveRoutineSession();
  const { trigger } = useHaptics();

  useEffect(() => {
    trigger('light');
  }, [trigger]);

  async function handleSave() {
    try {
      await save.mutateAsync();
      trigger('buzz');
      playFanfare();
      toast.success('Routine saved');
      onSaved();
    } catch {
      toast.error('Could not save routine');
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Sticky header with back button */}
      <div className="sticky -top-0.5 md:-top-6 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to active routine"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h2 className="text-lg font-semibold">Summary</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 py-6 space-y-5">
        {/* Hero card */}
        <Card className="p-6 text-center bg-gradient-to-b from-primary/10 to-primary/5 border-primary/30">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground mb-3">
            <Trophy className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold mb-1">{summary.routineNameSnapshot}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">Complete</p>
          <p className="text-5xl font-mono font-light tracking-tight text-foreground">
            {formatTime(summary.totalActiveSeconds)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">active time</p>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 flex flex-col items-center text-center">
            <ListChecks className="h-5 w-5 text-primary mb-1.5" />
            <p className="text-2xl font-bold">{summary.completedSetCount}</p>
            <p className="text-xs text-muted-foreground">
              {summary.completedSetCount === 1 ? 'set' : 'sets'} completed
            </p>
          </Card>
          <Card className="p-4 flex flex-col items-center text-center">
            <Activity className="h-5 w-5 text-muted-foreground mb-1.5" />
            <p className="text-2xl font-bold font-mono text-muted-foreground">
              {formatTime(summary.totalElapsedSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">elapsed</p>
          </Card>
        </div>

        {/* Habit breakdown */}
        {summary.byHabit.length > 0 && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">By habit</h4>
            </div>
            <div className="space-y-1.5">
              {summary.byHabit.map((h) => (
                <div key={h.habitName} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/40">
                  <span className="text-sm font-medium">{h.habitName}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {h.sets} {h.sets === 1 ? 'set' : 'sets'}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatTime(h.totalSeconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Sticky footer with actions */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDiscard}>
          Discard
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
