// Hash router for the single-file build. Stands in for `next/navigation` there.
// Hosts like claude.ai pages only pass a plain `#name` through, so each route is one word
// and any query (e.g. a chart cell to highlight) is kept in memory instead of the URL.

import { useMemo, useSyncExternalStore } from "react";

const ROUTE_TO_HASH: Record<string, string> = {
  "/": "play",
  "/train": "train",
  "/chart": "chart",
  "/stats": "stats",
  // "#settings" is reserved by some hosts, so Settings lives at #rules.
  "/settings": "rules",
};
const HASH_TO_ROUTE: Record<string, string> = Object.fromEntries(Object.entries(ROUTE_TO_HASH).map(([r, h]) => [h, r]));

interface Location {
  path: string;
  search: string;
}

function fromHash(): Location {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  return { path: HASH_TO_ROUTE[h] ?? "/", search: "" };
}

let current: Location = fromHash();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const next = fromHash();
    if (next.path !== current.path) {
      current = next;
      emit();
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function navigate(href: string) {
  const [path = "/", search = ""] = href.split("?");
  current = { path: ROUTE_TO_HASH[path] ? path : "/", search };
  const hash = ROUTE_TO_HASH[current.path] as string;
  try {
    if (window.location.hash !== `#${hash}`) window.location.hash = hash;
  } catch {
    /* sandboxed frames may refuse; in-memory routing still works */
  }
  window.scrollTo({ top: 0 });
  emit();
}

export function hashFor(href: string): string {
  const path = href.split("?")[0] ?? "/";
  return `#${ROUTE_TO_HASH[path] ?? "play"}`;
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => current.path, () => "/");
}

export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => current.search, () => "");
  return useMemo(() => new URLSearchParams(search), [search]);
}
