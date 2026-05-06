'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResume: () => void;
  onStartNew: () => void;
  pending?: boolean;
};

export function StartNewRoutineConflictDialog({ open, onOpenChange, onResume, onStartNew, pending = false }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Routine in progress</AlertDialogTitle>
          <AlertDialogDescription>
            Starting a new routine will permanently delete your routine in progress. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={onResume} disabled={pending}>Resume routine in progress</Button>
          <Button variant="destructive" onClick={onStartNew} disabled={pending}>
            {pending ? 'Starting...' : 'Start new routine'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
