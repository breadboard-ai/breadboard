/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphRepresentation,
  NodeDescriptor,
} from "@google-labs/graph-runner";
import {
  type BreadboardValidator,
  type BreadboardValidatorMetadata,
} from "@google-labs/breadboard";
import { SafetyLabel } from "./label.js";
import { trustedLabels } from "./trusted-labels.js";

export interface GraphIntegrityValidatorMetadata
  extends BreadboardValidatorMetadata {
  label: SafetyLabel;
}

/**
 * @class GraphIntegrityValidator
 *
 * A validator for the integrity of a graph in terms of safety.
 * Call @method {computeLabelsForFullGraph} to validate the full graph.
 */
export class GraphIntegrityValidator implements BreadboardValidator {
  protected nodeSafetyLabels: Map<NodeDescriptor["id"], SafetyLabel> =
    new Map();
  protected graph: GraphRepresentation | undefined = undefined;

  /**
   * Add graph to the validator, and validate it.
   *
   * @param graph Graph to validate.
   * @throws {Error} if the graph is not safe.
   */
  addGraph(graph: GraphDescriptor) {
    this.graph = new GraphRepresentation(graph);
    this.computeLabelsForFullGraph();
  }

  /**
   * Get the safety label of a node. This is only valid after calling @method
   * {computeLabelsForFullGraph}.
   *
   * @param nodeId The id of the node to get the label for.
   * @returns The safety label of the node, or undefined if it wasn't computed.
   *          Note that the safety label's value can be undefined, meaning that
   *          there were no constraints on it.
   */
  getValidatorMetadata(node: NodeDescriptor): GraphIntegrityValidatorMetadata {
    const label = this.nodeSafetyLabels.get(node.id);
    if (!label) throw Error(`Safety label for node ${node.id} not computed.`);
    return {
      description: label.toString() ?? "Unknown label",
      label,
    };
  }

  /**
   * Compute labels and hence validate the safety of the graph as whole.
   * @throws {Error} if the graph is not safe.
   * After this you can use @method {getNodeSafetyLabel} to get the label of
   * any node. For input nodes, this means the minimum expected trust, and it's
   * up to the callee to ensure that. A safety label of undefined means that
   * there were no constraints on it either way.
   *
   * Validating the full graph before running it is ideal, but can also be
   * overly strict. Once we have enough of the tools to create safe graphs, this
   * is the only method that should be used.
   *
   * Until then it might be desirable to instead validate the graph
   * incrementally. TODO: Implement that.
   */
  computeLabelsForFullGraph(): void {
    if (this.graph === undefined) throw Error("No graph to validate.");

    // This method recomputes all labels from scratch.
    // Initialize with the initial constraints.
    this.nodeSafetyLabels = new Map();

    // Find all nodes with a constraint label via node types
    const constraintSafetyLabels: Map<NodeDescriptor["id"], SafetyLabel> =
      new Map();
    for (const [nodeId, nodeDescription] of this.graph.nodes) {
      if (trustedLabels.has(nodeDescription.type)) {
        constraintSafetyLabels.set(
          nodeId,
          trustedLabels.get(nodeDescription.type) as SafetyLabel
        );
      }
    }

    // Compute all labels with an embarrassingly simple and slow fixed-point
    // algorithm. This should be replaced by a more efficient constraint solver,
    // but that's a lot of work and fiddly. This should be good enough for now
    // and should even cover some of the next steps.
    //
    // Picture raising the trust levels where necessary to enable flow until it
    // stops changing. That is, this will propagate labels through the graph
    // until it reaches a fixed point. If it encounters a contradiction with a
    // constraint, it will throw an error, as the graph is not safe.
    let change: boolean;
    do {
      change = false;
      for (const [nodeId] of this.graph.nodes) {
        const constraintSafetyLabel = constraintSafetyLabels.get(nodeId);

        const incomingNodes =
          this.graph.heads.get(nodeId)?.map((edge) => edge.from) ?? [];
        const outgoingNodes =
          this.graph.tails.get(nodeId)?.map((edge) => edge.to) ?? [];

        // Compute the meet (lowest label) of all incoming edges. Add the
        // constraint label for this node. This can lower the label, but not
        // raise it.
        const incomingSafetyLabels = incomingNodes.map((nodeId) =>
          this.nodeSafetyLabels.get(nodeId)
        );
        const incomingSafetyLabel = SafetyLabel.computeMeetOfLabels([
          ...incomingSafetyLabels,
          constraintSafetyLabel,
        ]);

        // Compute the join (highest label) of all outgoing edges.
        // Add the constraint label for this node. This can raise the label.
        const outgoingSafetyLabels = outgoingNodes.map((nodeId) =>
          this.nodeSafetyLabels.get(nodeId)
        );
        const outgoingSafetyLabel = SafetyLabel.computeJoinOfLabels([
          ...outgoingSafetyLabels,
          constraintSafetyLabel,
        ]);

        // Graph is not safe if a constraint has to be violated, i.e. here a
        // node has to be upgraded.
        if (
          constraintSafetyLabel &&
          !outgoingSafetyLabel.equalsTo(constraintSafetyLabel)
        ) {
          throw Error(
            `Graph is not safe. E.g. node ${nodeId} requires to write to ${outgoingSafetyLabel} but can only be ${constraintSafetyLabel}`
          );
        }

        // Compute the new safety label as the join (highest of) of (lowest)
        // incoming and (highest) outgoing edges. Note that if this increases
        // the trust of this node, the next iteration will backpropagate that.
        const newSafetyLabel = SafetyLabel.computeJoinOfLabels([
          incomingSafetyLabel,
          outgoingSafetyLabel,
        ]);
        const currentSafetyLabel = this.nodeSafetyLabels.get(nodeId);

        // If the new safety label is different from the current one, update it.
        if (
          !currentSafetyLabel ||
          !newSafetyLabel.equalsTo(currentSafetyLabel)
        ) {
          this.nodeSafetyLabels.set(nodeId, newSafetyLabel);
          change = true;
        }
      }
    } while (change);
  }
}
