/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hash-based URL router for DevTools deep linking.
 *
 * URL format: #/{tab}/{selectionId}
 * Examples: #/logs/abc123, #/tickets/def456, #/events/ghi789
 *
 * Uses history.replaceState so hash updates don't clutter browser history.
 * The hashchange listener only fires on external changes (manual URL edits).
 */

export { parseRoute, writeRoute, type Route };

type RoutableTab =
  | "jobs"
  | "daemons"
  | "logs"
  | "tickets"
  | "events";

interface Route {
  tab: RoutableTab;
  id?: string;
}

const VALID_TABS = new Set<string>([
  "jobs",
  "daemons",
  "logs",
  "tickets",
  "events",
]);

function parseRoute(hash = location.hash): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { tab: "jobs" };

  const slashIdx = path.indexOf("/");
  const tab = slashIdx === -1 ? path : path.slice(0, slashIdx);
  const id =
    slashIdx === -1 ? undefined : path.slice(slashIdx + 1) || undefined;

  if (!VALID_TABS.has(tab)) return { tab: "jobs" };
  return { tab: tab as RoutableTab, id };
}

function writeRoute(tab: string, id?: string | null): void {
  const hash = id ? `#/${tab}/${id}` : `#/${tab}`;
  if (location.hash === hash) return;
  history.replaceState(null, "", hash);
}
