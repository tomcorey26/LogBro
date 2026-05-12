// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoutineBuilder } from "./use-routine-builder";

function createHook(mode: "create" | "edit" = "create", routine?: any) {
  return renderHook(() => useRoutineBuilder(mode, routine));
}

describe("useRoutineBuilder", () => {
  describe("create mode", () => {
    it("starts with empty state", () => {
      const { result } = createHook();
      expect(result.current.routineId).toBeNull();
      expect(result.current.name).toBe("");
      expect(result.current.blocks).toEqual([]);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("edit mode", () => {
    it("hydrates from existing routine", () => {
      const { result } = createHook("edit", {
        id: 5,
        name: "Evening",
        blocks: [
          {
            id: 10, habitId: 1, habitName: "Guitar", sortOrder: 0,
            notes: "Scales",
            sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
          },
        ],
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      });
      expect(result.current.routineId).toBe(5);
      expect(result.current.name).toBe("Evening");
      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0].habitName).toBe("Guitar");
      expect(result.current.blocks[0].notes).toBe("Scales");
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("setName", () => {
    it("sets routine name and marks dirty", () => {
      const { result } = createHook();
      act(() => result.current.setName("Morning"));
      expect(result.current.name).toBe("Morning");
      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("addBlock", () => {
    it("adds a block and marks dirty", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1,
          habitName: "Guitar",
          notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0].habitId).toBe(1);
      expect(result.current.blocks[0].habitName).toBe("Guitar");
      expect(result.current.blocks[0].clientId).toBeTruthy();
      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("removeBlock", () => {
    it("removes a block by clientId", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.removeBlock(clientId));
      expect(result.current.blocks).toHaveLength(0);
    });
  });

  describe("updateBlockNotes", () => {
    it("updates notes for a block", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.updateBlockNotes(clientId, "Focus on scales"));
      expect(result.current.blocks[0].notes).toBe("Focus on scales");
    });
  });

  describe("addSet", () => {
    it("adds a set copying duration but defaulting break to 0", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.addSet(clientId));
      const sets = result.current.blocks[0].sets;
      expect(sets).toHaveLength(2);
      expect(sets[1].durationSeconds).toBe(1500);
      expect(sets[1].breakSeconds).toBe(0);
    });

    it("does not add beyond 10 sets", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: Array.from({ length: 10 }, () => ({ durationSeconds: 1500, breakSeconds: 300 })),
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.addSet(clientId));
      expect(result.current.blocks[0].sets).toHaveLength(10);
    });
  });

  describe("removeSet", () => {
    it("removes a set by index", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [
            { durationSeconds: 1500, breakSeconds: 300 },
            { durationSeconds: 900, breakSeconds: 300 },
          ],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.removeSet(clientId, 0));
      const sets = result.current.blocks[0].sets;
      expect(sets).toHaveLength(1);
      expect(sets[0].durationSeconds).toBe(900);
    });

    it("does not remove the last set", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.removeSet(clientId, 0));
      expect(result.current.blocks[0].sets).toHaveLength(1);
    });
  });

  describe("updateSetDuration", () => {
    it("updates duration for a specific set", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.updateSetDuration(clientId, 0, 900));
      expect(result.current.blocks[0].sets[0].durationSeconds).toBe(900);
    });
  });

  describe("updateSetBreak", () => {
    it("updates break for a specific set", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const clientId = result.current.blocks[0].clientId;
      act(() => result.current.updateSetBreak(clientId, 0, 600));
      expect(result.current.blocks[0].sets[0].breakSeconds).toBe(600);
    });
  });

  describe("moveBlock", () => {
    it("reorders blocks", () => {
      const { result } = createHook();
      act(() => {
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 2, habitName: "Reading", notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        });
      });
      act(() => result.current.moveBlock(1, 0));
      expect(result.current.blocks[0].habitName).toBe("Reading");
      expect(result.current.blocks[1].habitName).toBe("Guitar");
    });
  });

  describe("reorderBlocks", () => {
    it("replaces blocks with the supplied order and marks dirty", () => {
      const { result } = createHook();
      act(() => {
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 2, habitName: "Reading", notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        });
      });
      act(() => {
        const [a, b] = result.current.blocks;
        result.current.reorderBlocks([b, a]);
      });
      expect(result.current.blocks[0].habitName).toBe("Reading");
      expect(result.current.blocks[1].habitName).toBe("Guitar");
      expect(result.current.isDirty).toBe(true);
    });

    it("toPayload returns sortOrder matching the new order after reorder", () => {
      const { result } = createHook();
      act(() => result.current.setName("Morning"));
      act(() => {
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 2, habitName: "Reading", notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        });
      });
      act(() => {
        const [a, b] = result.current.blocks;
        result.current.reorderBlocks([b, a]);
      });
      const payload = result.current.toPayload();
      expect(payload.blocks.map((x) => ({ habitId: x.habitId, sortOrder: x.sortOrder }))).toEqual([
        { habitId: 2, sortOrder: 0 },
        { habitId: 1, sortOrder: 1 },
      ]);
    });
  });

  describe("toPayload", () => {
    it("converts state to API payload", () => {
      const { result } = createHook();
      act(() => result.current.setName("Morning"));
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: "Scales",
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const payload = result.current.toPayload();
      expect(payload).toEqual({
        name: "Morning",
        blocks: [
          {
            habitId: 1, sortOrder: 0, notes: "Scales",
            sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
          },
        ],
      });
    });
  });

  describe("replaceBlock", () => {
    it("swaps habitId/habitName/notes/sets in place and marks dirty", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: "Scales",
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const originalClientId = result.current.blocks[0].clientId;

      act(() =>
        result.current.replaceBlock(originalClientId, {
          habitId: 2,
          habitName: "Reading",
          notes: "Chapter 3",
          sets: [
            { durationSeconds: 900, breakSeconds: 0 },
            { durationSeconds: 900, breakSeconds: 0 },
          ],
        })
      );

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0].clientId).toBe(originalClientId);
      expect(result.current.blocks[0].habitId).toBe(2);
      expect(result.current.blocks[0].habitName).toBe("Reading");
      expect(result.current.blocks[0].notes).toBe("Chapter 3");
      expect(result.current.blocks[0].sets).toHaveLength(2);
      expect(result.current.blocks[0].sets[0].durationSeconds).toBe(900);
      expect(result.current.isDirty).toBe(true);
    });

    it("preserves block position when other blocks exist", () => {
      const { result } = createHook();
      act(() => {
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 2, habitName: "Reading", notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 3, habitName: "Pushups", notes: null,
          sets: [{ durationSeconds: 60, breakSeconds: 30 }],
        });
      });

      const middleClientId = result.current.blocks[1].clientId;
      act(() =>
        result.current.replaceBlock(middleClientId, {
          habitId: 9,
          habitName: "Meditation",
          notes: null,
          sets: [{ durationSeconds: 600, breakSeconds: 0 }],
        })
      );

      expect(result.current.blocks.map((b) => b.habitName)).toEqual([
        "Guitar",
        "Meditation",
        "Pushups",
      ]);
      expect(result.current.blocks[1].clientId).toBe(middleClientId);
    });

    it("generates fresh clientIds for the new sets", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [
            { durationSeconds: 1500, breakSeconds: 300 },
            { durationSeconds: 1500, breakSeconds: 300 },
          ],
        })
      );
      const oldSetClientIds = result.current.blocks[0].sets.map((s) => s.clientId);

      act(() =>
        result.current.replaceBlock(result.current.blocks[0].clientId, {
          habitId: 2,
          habitName: "Reading",
          notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        })
      );

      const newSetClientIds = result.current.blocks[0].sets.map((s) => s.clientId);
      for (const id of newSetClientIds) {
        expect(oldSetClientIds).not.toContain(id);
      }
    });
  });
});
