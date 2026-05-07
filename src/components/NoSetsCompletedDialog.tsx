'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
};

export function NoSetsCompletedDialog({ open, onOpenChange, onDiscard }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>No completed sets</AlertDialogTitle>
          <AlertDialogDescription>
            You haven&apos;t completed any sets yet. Discard the routine instead?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
