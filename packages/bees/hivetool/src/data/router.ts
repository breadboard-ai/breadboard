/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hash-based URL router for DevTools deep linking.
 *
 * URL format: #/{tab}/{selectionId}
 * Examples: #/logs/abc123, #/agents/def456, #/tasks/ghi789
 *
 * Uses history.pushState so each navigation creates a history entry,
 * enabling browser back/forward buttons.
 */

export { parseRoute, writeRoute, type Route };

type RoutableTab =
  | "agents"
  | "logs"
  | "tasks"
  | "templates"
  | "skills";

interface Route {
  tab: RoutableTab;
  id?: string;
}

const VALID_TABS = new Set<string>([
  "agents",
  "logs",
  "tasks",
  "templates",
  "skills",
]);

function parseRoute(hash = location.hash): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { tab: "agents" };

  const slashIdx = path.indexOf("/");
  const tab = slashIdx === -1 ? path : path.slice(0, slashIdx);
  const id =
    slashIdx === -1 ? undefined : path.slice(slashIdx + 1) || undefined;

  if (!VALID_TABS.has(tab)) return { tab: "agents" };
  return { tab: tab as RoutableTab, id };
}

function writeRoute(tab: string, id?: string | null): void {
  const hash = id ? `#/${tab}/${id}` : `#/${tab}`;
  if (location.hash === hash) return;
  history.pushState(null, "", hash);
}
