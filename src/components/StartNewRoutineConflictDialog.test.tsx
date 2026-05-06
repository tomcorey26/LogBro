// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartNewRoutineConflictDialog } from './StartNewRoutineConflictDialog';

describe('StartNewRoutineConflictDialog', () => {
  it('disables both action buttons and shows "Starting..." when pending', () => {
    render(
      <StartNewRoutineConflictDialog
        open
        onOpenChange={vi.fn()}
        onResume={vi.fn()}
        onStartNew={vi.fn()}
        pending
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: /resume/i })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /starting/i })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('does not call onStartNew when click happens while pending', async () => {
    const onStartNew = vi.fn();
    render(
      <StartNewRoutineConflictDialog
        open
        onOpenChange={vi.fn()}
        onResume={vi.fn()}
        onStartNew={onStartNew}
        pending
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /starting/i }));
    expect(onStartNew).not.toHaveBeenCalled();
  });

  it('calls onStartNew when not pending', async () => {
    const onStartNew = vi.fn();
    render(
      <StartNewRoutineConflictDialog
        open
        onOpenChange={vi.fn()}
        onResume={vi.fn()}
        onStartNew={onStartNew}
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /start new routine/i }));
    expect(onStartNew).toHaveBeenCalled();
  });
});
