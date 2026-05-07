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
});
