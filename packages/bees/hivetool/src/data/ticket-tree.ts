/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Derives a parent–child tree from a flat ticket list using
 * `creator_ticket_id`. Hivetool-specific copy — no filtering beyond
 * what the caller provides (devtools should show everything).
 */

import type { TicketData } from "../../../common/types.js";

export { deriveTicketTree };
export type { TicketTreeNode };

/** A node in the ticket tree. */
interface TicketTreeNode {
  ticket: TicketData;
  children: TicketTreeNode[];
}

/**
 * Build a forest of ticket trees from a flat list.
 *
 * Root nodes are tickets with no `creator_ticket_id`.
 * Children are sorted by `created_at` ascending (oldest first) so the
 * tree reads in chronological order.
 */
function deriveTicketTree(tickets: TicketData[]): TicketTreeNode[] {
  const childrenOf = new Map<string, TicketData[]>();
  const roots: TicketData[] = [];

  for (const t of tickets) {
    if (t.creator_ticket_id) {
      const siblings = childrenOf.get(t.creator_ticket_id) ?? [];
      siblings.push(t);
      childrenOf.set(t.creator_ticket_id, siblings);
    } else {
      roots.push(t);
    }
  }

  function buildNode(ticket: TicketData): TicketTreeNode {
    const children = (childrenOf.get(ticket.id) ?? [])
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map(buildNode);
    return { ticket, children };
  }

  // Roots sorted newest-first to match the flat list convention.
  return roots
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map(buildNode);
}
