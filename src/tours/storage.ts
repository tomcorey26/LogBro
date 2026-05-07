export const TOUR_IDS = ["habits", "routines", "stats"] as const;
export type TourId = (typeof TOUR_IDS)[number];

export const TOUR_SEEN_PREFIX = "tours.seen.";

function safeGet(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasSeenTour(id: TourId): boolean {
  const storage = safeGet();
  if (!storage) return false;
  try {
    return storage.getItem(`${TOUR_SEEN_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(id: TourId): void {
  const storage = safeGet();
  if (!storage) return;
  try {
    storage.setItem(`${TOUR_SEEN_PREFIX}${id}`, "1");
  } catch {
    // ignore (quota / private mode)
  }
}

export function resetAllTours(): void {
  const storage = safeGet();
  if (!storage) return;
  try {
    for (const id of TOUR_IDS) {
      storage.removeItem(`${TOUR_SEEN_PREFIX}${id}`);
    }
  } catch {
    // ignore
  }
}
