"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type NavigationAttempt =
  | { type: "back" }
  | { type: "link"; href: string };

type Options = {
  shouldGuard: boolean;
  onAttempt: (attempt: NavigationAttempt, proceed: () => void) => void;
};

const SENTINEL_KEY = "__routine_builder_nav_guard__";

export function useNavigationGuard({ shouldGuard, onAttempt }: Options) {
  const router = useRouter();
  // Keep a ref so listeners always read the latest callback without re-binding.
  const onAttemptRef = useRef(onAttempt);
  useEffect(() => {
    onAttemptRef.current = onAttempt;
  }, [onAttempt]);

  useEffect(() => {
    if (!shouldGuard) return;

    // 1. beforeunload — tab close, refresh, address bar, external link.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older Safari needs a return value set to trigger the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);

    // 2. popstate sentinel — push a duplicate state so back/forward fires popstate
    //    while keeping the user on the same URL. On popstate, push another
    //    sentinel to stay, then surface the attempt.
    history.pushState({ [SENTINEL_KEY]: true }, "", location.href);
    const onPopState = () => {
      // Re-pin the user before showing the dialog.
      history.pushState({ [SENTINEL_KEY]: true }, "", location.href);
      onAttemptRef.current({ type: "back" }, () => {
        // Pop the sentinel (current pushed state) so history.back() lands on
        // the original previous entry the user wanted.
        history.go(-2);
      });
    };
    window.addEventListener("popstate", onPopState);

    // 3. In-app anchor click capture.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const path = e.composedPath ? e.composedPath() : [];
      let anchor: HTMLAnchorElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
      }
      if (!anchor) return;
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Resolve to URL to detect external origin.
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;

      e.preventDefault();
      const target = url.pathname + url.search + url.hash;
      onAttemptRef.current({ type: "link", href: target }, () => {
        router.push(target);
      });
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, [shouldGuard, router]);
}
