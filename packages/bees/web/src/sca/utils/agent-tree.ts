/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TaskData } from "../../../../common/types.js";

export {
  deriveAgentTree,
  deriveChildAgents,
  derivePerspectives,
  deriveAncestorPath,
};
export type { AgentTreeNode, AgentPerspectives };

/** A node in the agent tree. */
interface AgentTreeNode {
  ticket: TaskData;
  children: AgentTreeNode[];
}

/** Which perspectives are available for a given agent. */
interface AgentPerspectives {
  hasSubagents: boolean;
  hasChat: boolean;
  hasBundle: boolean;
}

/**
 * Derive a forest of agent trees from a flat ticket list.
 *
 * Root nodes are tickets with no `parent_task_id` (or legacy `creator_ticket_id`) (user-initiated).
 * Coordination and internal-only tickets are excluded.
 */
function deriveAgentTree(tickets: TaskData[]): AgentTreeNode[] {
  // Filter out coordination tickets and cancelled tickets — they're infrastructure or noise, not active agents.
  const agentTickets = tickets.filter(
    (t) =>
      t.kind !== "coordination" &&
      !t.tags?.includes("digest") &&
      t.status !== "cancelled"
  );

  // Build parent → children index.
  const childrenOf = new Map<string, TaskData[]>();
  const roots: TaskData[] = [];

  for (const t of agentTickets) {
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

  function buildNode(ticket: TaskData): AgentTreeNode {
    const children = (childrenOf.get(ticket.id) ?? [])
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map(buildNode);
    return { ticket, children };
  }

  return roots
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map(buildNode);
}

/** Get the direct child agents of a given ticket ID. */
function deriveChildAgents(tickets: TaskData[], parentId: string): TaskData[] {
  return tickets.filter(
    (t) =>
      // Fallback for legacy creator_ticket_id
      (t.parent_task_id || t.creator_ticket_id) === parentId &&
      t.kind !== "coordination" &&
      !t.tags?.includes("digest")
  );
}

/** Determine which perspectives are present for a given ticket. */
function derivePerspectives(
  ticket: TaskData,
  allTickets: TaskData[]
): AgentPerspectives {
  const hasChat = ticket.tags?.includes("chat") ?? false;
  const hasBundle = ticket.tags?.includes("bundle") ?? false;
  const hasSubagents = allTickets.some(
    (t) =>
      // Fallback for legacy creator_ticket_id
      (t.parent_task_id || t.creator_ticket_id) === ticket.id &&
      t.kind !== "coordination" &&
      !t.tags?.includes("digest")
  );

  return { hasSubagents, hasChat, hasBundle };
}

/**
 * Derive the ancestor path from root to the given agent.
 *
 * Returns an ordered array of ticket IDs: `[root, ..., parent, agentId]`.
 * Walks the `parent_task_id` (or `creator_ticket_id`) chain upward, then reverses.
 * Returns an empty array if the agent is not found.
 *
 * Guards against cycles with a visited set.
 */
function deriveAncestorPath(tickets: TaskData[], agentId: string): string[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = agentId;

  while (current) {
    if (visited.has(current)) break; // Cycle guard.
    visited.add(current);
    path.push(current);
    const ticket = byId.get(current);
    // Fallback for legacy creator_ticket_id
    const parentId = ticket?.parent_task_id || ticket?.creator_ticket_id;
    if (!parentId) break;
    current = parentId;
  }

  return path.reverse();
}
