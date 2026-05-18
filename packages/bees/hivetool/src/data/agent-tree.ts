/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Derives a parent–child tree from a flat agent list using
 * `parent_task_id` (falling back to `creator_ticket_id`).
 * Hivetool-specific copy — no filtering beyond what the caller provides
 * (devtools should show everything).
 */

import type { AgentData } from "../../../common/types.js";

export { deriveAgentTree };
export type { AgentTreeNode };

/** A node in the agent tree. */
interface AgentTreeNode {
  agent: AgentData;
  children: AgentTreeNode[];
}

/**
 * Build a forest of agent trees from a flat list.
 *
 * Root nodes are agents with no `parent_task_id`.
 * Children are sorted by `created_at` ascending (oldest first) so the
 * tree reads in chronological order.
 */
function deriveAgentTree(agents: AgentData[]): AgentTreeNode[] {
  const childrenOf = new Map<string, AgentData[]>();
  const roots: AgentData[] = [];

  for (const t of agents) {
    // Fallback for legacy creator_ticket_id
    const parentId = t.parent_task_id || t.creator_ticket_id;
    if (parentId) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(t);
      childrenOf.set(parentId, siblings);
    } else {
      roots.push(t);
    }
  }

  function buildNode(agent: AgentData): AgentTreeNode {
    const children = (childrenOf.get(agent.id) ?? [])
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map(buildNode);
    return { agent, children };
  }

  // Roots sorted newest-first to match the flat list convention.
  return roots
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map(buildNode);
}
