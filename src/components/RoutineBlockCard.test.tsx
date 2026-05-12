// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  onReplace: () => {},
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

  it('renders the block actions overflow trigger', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /block actions/i })).toBeInTheDocument();
  });

  it('Move up menu item is enabled and calls onMoveUp when onMoveUp provided', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveUp={onMoveUp}
        {...noopHandlers}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move up/i });
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('Move up menu item is disabled when onMoveUp is missing', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move up/i });
    expect(item).toHaveAttribute('data-disabled');
  });

  it('Move down menu item is enabled and calls onMoveDown when onMoveDown provided', async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveDown={onMoveDown}
        {...noopHandlers}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move down/i });
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('Move down menu item is disabled when onMoveDown is missing', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move down/i });
    expect(item).toHaveAttribute('data-disabled');
  });

  it('Replace habit menu item calls onReplace', async () => {
    const user = userEvent.setup();
    const onReplace = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        {...noopHandlers}
        onReplace={onReplace}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it('Delete menu item opens the destructive confirmation dialog', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^delete$/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/remove block\?/i)).toBeInTheDocument();
  });
});
