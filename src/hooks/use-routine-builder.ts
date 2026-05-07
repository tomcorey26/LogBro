import { useState } from "react";
import type { Routine, RoutineSet, BuilderBlock } from "@/lib/types";

type AddBlockInput = {
  habitId: number;
  habitName: string;
  notes: string | null;
  sets: RoutineSet[];
};

function generateId(): string {
  return crypto.randomUUID();
}

function blocksFromRoutine(routine: Routine): BuilderBlock[] {
  return routine.blocks.map((b) => ({
    clientId: generateId(),
    habitId: b.habitId,
    habitName: b.habitName,
    notes: b.notes,
    sets: b.sets.map((s) => ({ ...s, clientId: generateId() })),
  }));
}

export function useRoutineBuilder(
  mode: "create" | "edit",
  routine?: Routine
) {
  const [routineId, setRoutineId] = useState<number | null>(
    mode === "edit" && routine ? routine.id : null
  );
  const [name, setNameRaw] = useState(
    mode === "edit" && routine ? routine.name : ""
  );
  const [blocks, setBlocks] = useState<BuilderBlock[]>(
    mode === "edit" && routine ? () => blocksFromRoutine(routine) : []
  );
  const [isDirty, setIsDirty] = useState(false);

  const routineKey = mode === "edit" ? routine?.id ?? null : null;
  const [prevKey, setPrevKey] = useState<{ mode: string; key: number | null }>({
    mode,
    key: routineKey,
  });
  if (prevKey.mode !== mode || prevKey.key !== routineKey) {
    setPrevKey({ mode, key: routineKey });
    if (mode === "edit" && routine) {
      setRoutineId(routine.id);
      setNameRaw(routine.name);
      setBlocks(blocksFromRoutine(routine));
    } else {
      setRoutineId(null);
      setNameRaw("");
      setBlocks([]);
    }
    setIsDirty(false);
  }

  function setName(name: string) {
    setNameRaw(name);
    setIsDirty(true);
  }

  function addBlock(input: AddBlockInput) {
    setBlocks((prev) => [
      ...prev,
      {
        clientId: generateId(),
        ...input,
        sets: input.sets.map((s) => ({ ...s, clientId: generateId() })),
      },
    ]);
    setIsDirty(true);
  }

  function removeBlock(clientId: string) {
    setBlocks((prev) => prev.filter((b) => b.clientId !== clientId));
    setIsDirty(true);
  }

  function updateBlockNotes(clientId: string, notes: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.clientId === clientId ? { ...b, notes } : b))
    );
    setIsDirty(true);
  }

  function addSet(clientId: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.clientId !== clientId || b.sets.length >= 10) return b;
        const lastSet = b.sets[b.sets.length - 1];
        // New set copies duration; previous last set keeps its break, new last set defaults to 0
        return {
          ...b,
          sets: [
            ...b.sets,
            {
              clientId: generateId(),
              durationSeconds: lastSet.durationSeconds,
              breakSeconds: 0,
            },
          ],
        };
      })
    );
    setIsDirty(true);
  }

  function removeSet(clientId: string, setIndex: number) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.clientId !== clientId || b.sets.length <= 1) return b;
        return { ...b, sets: b.sets.filter((_, i) => i !== setIndex) };
      })
    );
    setIsDirty(true);
  }

  function updateSetDuration(
    clientId: string,
    setIndex: number,
    durationSeconds: number
  ) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.clientId === clientId
          ? {
              ...b,
              sets: b.sets.map((s, i) =>
                i === setIndex ? { ...s, durationSeconds } : s
              ),
            }
          : b
      )
    );
    setIsDirty(true);
  }

  function updateSetBreak(
    clientId: string,
    setIndex: number,
    breakSeconds: number
  ) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.clientId === clientId
          ? {
              ...b,
              sets: b.sets.map((s, i) =>
                i === setIndex ? { ...s, breakSeconds } : s
              ),
            }
          : b
      )
    );
    setIsDirty(true);
  }

  function moveBlock(fromIndex: number, toIndex: number) {
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setIsDirty(true);
  }

  function reorderBlocks(newBlocks: BuilderBlock[]) {
    setBlocks(newBlocks);
    setIsDirty(true);
  }

  function toPayload() {
    return {
      name,
      blocks: blocks.map((b, i) => ({
        habitId: b.habitId,
        sortOrder: i,
        notes: b.notes,
        sets: b.sets.map((s) => ({
          durationSeconds: s.durationSeconds,
          breakSeconds: s.breakSeconds,
        })),
      })),
    };
  }

  function markClean() {
    setIsDirty(false);
  }

  return {
    routineId,
    name,
    blocks,
    isDirty,
    markClean,
    setName,
    addBlock,
    removeBlock,
    updateBlockNotes,
    addSet,
    removeSet,
    updateSetDuration,
    updateSetBreak,
    moveBlock,
    reorderBlocks,
    toPayload,
  };
}

export type RoutineBuilderState = ReturnType<typeof useRoutineBuilder>;
