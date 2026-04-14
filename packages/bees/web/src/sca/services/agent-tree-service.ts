/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import type { TaskData } from "../../../../common/types.js";
import {
  deriveAgentTree,
  deriveChildAgents,
  derivePerspectives,
  deriveAncestorPath,
  type AgentTreeNode,
  type AgentPerspectives,
} from "../utils/agent-tree.js";

export { AgentTreeService };
export type { AgentTreeNode, AgentPerspectives };

/**
 * Owns the agent tree: receives ticket events from the SSE event bus,
 * maintains an internal ticket store, and derives a cached tree.
 *
 * UI components query the tree through this service rather than calling
 * derivation functions directly. This creates the seam for the future
 * Agent Projection: when the server sends typed tree data, this service
 * simply stores it — same interface, different source.
 */
class AgentTreeService {
  #tickets: TaskData[] = [];
  #tree: AgentTreeNode[] = [];

  /**
   * Bumped on every ticket change. UI components read this inside
   * `SignalWatcher` renders to trigger reactive re-renders.
   */
  readonly version = new Signal.State(0);

  constructor(bus: EventTarget) {
    bus.addEventListener("init_tickets", (e) => this.#handleInit(e));
    bus.addEventListener("agent_added", (e) => this.#handleUpsert(e));
    bus.addEventListener("agent_updated", (e) => this.#handleUpsert(e));
  }

  // ── Query Interface ──────────────────────────────────────────

  /** The full derived tree (filtered, sorted). */
  get tree(): AgentTreeNode[] {
    return this.#tree;
  }

  /** Perspectives for a given agent. */
  perspectives(agentId: string): AgentPerspectives {
    const ticket = this.ticket(agentId);
    if (!ticket) return { hasSubagents: false, hasChat: false, hasBundle: false };
    return derivePerspectives(ticket, this.#tickets);
  }

  /** Ancestor path from root to agent. */
  ancestorPath(agentId: string): string[] {
    return deriveAncestorPath(this.#tickets, agentId);
  }

  /** Direct children of a given agent (filtered, sorted). */
  children(parentId: string): TaskData[] {
    return deriveChildAgents(this.#tickets, parentId);
  }

  /** Look up a single ticket by ID. */
  ticket(id: string): TaskData | undefined {
    return this.#tickets.find((t) => t.id === id);
  }

  // ── Event Handlers ───────────────────────────────────────────

  #handleInit(e: Event) {
    const tickets = (e as CustomEvent<TaskData[]>).detail;
    this.#tickets = tickets;
    this.#rederive();
  }

  #handleUpsert(e: Event) {
    const ticket = (e as CustomEvent<TaskData>).detail;
    if (!ticket) return;

    const idx = this.#tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      const updated = [...this.#tickets];
      updated[idx] = ticket;
      this.#tickets = updated;
    } else {
      this.#tickets = [ticket, ...this.#tickets];
    }

    this.#rederive();
  }

  #rederive() {
    this.#tree = deriveAgentTree(this.#tickets);
    this.version.set(this.version.get() + 1);
  }
}
