/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeIdentifier, NodeRunState } from "@breadboard-ai/types";
import type { EdgeRunState } from "../../../types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller for graph visualization state during a run.
 *
 * Owns the node and edge visual states displayed by the graph renderer.
 * Updated by Actions in response to runner events (`nodestatechange`,
 * `edgestatechange`, `nodestart`, `nodeend`, `graphstart`).
 *
 * Consumers: graph renderer (`bb-renderer` via `canvas-controller.ts`).
 */
export class RendererController extends RootController {
  /**
   * Visual state for each node in the graph during a run.
   * Maps node ID → run state (status + optional error message).
   */
  @field({ deep: true })
  private accessor _nodes: Map<NodeIdentifier, NodeRunState> = new Map();

  /**
   * Visual state for each edge in the graph during a run.
   * Maps edge string ID → run state (status: initial/consumed/stored).
   */
  @field({ deep: true })
  private accessor _edges: Map<string, EdgeRunState> = new Map();

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the node run states map.
   */
  get nodes(): Map<NodeIdentifier, NodeRunState> {
    return this._nodes;
  }

  /**
   * Sets the visual run state for a node.
   *
   * @param id The node identifier
   * @param state The visual run state
   */
  setNodeState(id: NodeIdentifier, state: NodeRunState): void {
    this._nodes.set(id, state);
  }

  /**
   * Clears all node visual states.
   * Called on graphstart to reset for a new run.
   */
  clearNodes(): void {
    this._nodes.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the edge run states map.
   */
  get edges(): Map<string, EdgeRunState> {
    return this._edges;
  }

  /**
   * Sets the visual run state for an edge.
   *
   * @param id The edge string identifier
   * @param state The visual run state
   */
  setEdgeState(id: string, state: EdgeRunState): void {
    this._edges.set(id, state);
  }

  /**
   * Clears all edge visual states.
   */
  clearEdges(): void {
    this._edges.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resets all renderer state for a new run.
   */
  reset(): void {
    this._nodes.clear();
    this._edges.clear();
  }
}
