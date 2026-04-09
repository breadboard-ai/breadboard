/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * URL hash encoding for agent deep linking.
 *
 * Format: `#agent=<id>&view=<tab>`
 * Example: `#agent=abc123&view=app`
 */

export { parseAgentHash, updateAgentHash };

interface AgentHash {
  agentId: string | null;
  view: string | null;
}

function parseAgentHash(hash = location.hash): AgentHash {
  if (!hash.startsWith("#agent=")) return { agentId: null, view: null };

  const params = new URLSearchParams(hash.slice(1));
  const agentId = params.get("agent") || null;
  const view = params.get("view") || null;

  return { agentId, view };
}

function updateAgentHash(
  agentId: string | null,
  view?: string | null
): void {
  if (!agentId) {
    history.replaceState(null, "", location.pathname);
    return;
  }

  const params = new URLSearchParams();
  params.set("agent", agentId);

  // Preserve existing view if not explicitly provided.
  if (view !== undefined) {
    if (view) params.set("view", view);
  } else {
    const current = parseAgentHash();
    if (current.view) params.set("view", current.view);
  }

  const hash = `#${params.toString()}`;
  if (location.hash === hash) return;
  history.replaceState(null, "", hash);
}
