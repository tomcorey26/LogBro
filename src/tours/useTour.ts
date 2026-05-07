"use client";

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";

import { TOURS } from "./registry";
import { hasSeenTour, markTourSeen, type TourId } from "./storage";

const MAX_WAIT_MS = 3000;
const POLL_INTERVAL_MS = 100;

type UseTourOptions = {
  enabled?: boolean;
};

function getStepSelector(step: DriveStep): string | null {
  if (typeof step.element === "string") return step.element;
  return null;
}

function visibleStepsFor(id: TourId): DriveStep[] {
  return TOURS[id].steps.filter((step) => {
    const selector = getStepSelector(step);
    if (!selector) return true; // intro step with no anchor
    return !!document.querySelector(selector);
  });
}

export function useTour(id: TourId, { enabled = true }: UseTourOptions = {}) {
  useEffect(() => {
    if (!enabled) return;
    if (hasSeenTour(id)) return;

    let cancelled = false;
    let elapsed = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeDriver: ReturnType<typeof driver> | null = null;

    function run() {
      if (cancelled) return;

      const steps = visibleStepsFor(id);
      const hasAnchored = steps.some((s) => getStepSelector(s));

      // Wait for at least one anchored element to mount before starting,
      // so we don't fire while the page is still suspending.
      if (!hasAnchored && elapsed < MAX_WAIT_MS) {
        elapsed += POLL_INTERVAL_MS;
        timer = setTimeout(run, POLL_INTERVAL_MS);
        return;
      }

      if (steps.length === 0) {
        markTourSeen(id);
        return;
      }

      activeDriver = driver({
        showProgress: steps.length > 1,
        allowClose: true,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps,
      });
      // Mark seen on start so reloads/network races never re-show this tour.
      // Replay button on /account explicitly resets the flag.
      markTourSeen(id);
      activeDriver.drive();
    }

    timer = setTimeout(run, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (activeDriver?.isActive()) {
        activeDriver.destroy();
      }
    };
  }, [id, enabled]);
}
