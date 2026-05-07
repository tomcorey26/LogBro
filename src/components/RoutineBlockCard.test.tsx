// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DragControls } from 'framer-motion';
import { RoutineBlockCard } from './RoutineBlockCard';
import type { BuilderBlock } from '@/lib/types';

const baseBlock: BuilderBlock = {
  clientId: 'c1',
  habitId: 1,
  habitName: 'Guitar',
  notes: null,
  sets: [{ clientId: 's1', durationSeconds: 60, breakSeconds: 0 }],
};

const noopHandlers = {
  onRemoveBlock: () => {},
  onAddSet: () => {},
  onRemoveSet: () => {},
  onUpdateDuration: () => {},
  onUpdateBreak: () => {},
  onUpdateNotes: () => {},
};

function fakeDragControls(): DragControls {
  return { start: vi.fn() } as unknown as DragControls;
}

describe('RoutineBlockCard editable', () => {
  it('renders a reorder handle when dragControls is provided', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        dragControls={fakeDragControls()}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /reorder block/i })).toBeInTheDocument();
  });

  it('does not render a reorder handle when dragControls is omitted', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.queryByRole('button', { name: /reorder block/i })).not.toBeInTheDocument();
  });

  it('renders enabled Move up button when onMoveUp provided', async () => {
    const onMoveUp = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveUp={onMoveUp}
        {...noopHandlers}
      />
    );
    const btn = screen.getByRole('button', { name: /move block up/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onMoveUp).toHaveBeenCalled();
  });

  it('renders disabled Move up button when onMoveUp missing', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /move block up/i })).toBeDisabled();
  });

  it('renders enabled Move down button when onMoveDown provided', async () => {
    const onMoveDown = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveDown={onMoveDown}
        {...noopHandlers}
      />
    );
    const btn = screen.getByRole('button', { name: /move block down/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onMoveDown).toHaveBeenCalled();
  });

  it('renders disabled Move down button when onMoveDown missing', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /move block down/i })).toBeDisabled();
  });

  it('hides notes, sets, and Add a Set when isCompact is true', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        isCompact
        {...noopHandlers}
      />
    );
    expect(screen.queryByPlaceholderText(/add notes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^set$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a set/i })).not.toBeInTheDocument();
    // Header (habit name) still renders
    expect(screen.getByText('Guitar')).toBeInTheDocument();
  });

  it('renders full body when isCompact is false', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        isCompact={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByPlaceholderText(/add notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a set/i })).toBeInTheDocument();
  });
});
