/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Graph, NodeRoles } from "./types.js";
import { Label } from "./label.js";

/**
 * Compute labels and hence validate the safety of the graph as whole.
 * Recomputes from scratch every time.
 *
 * Compute all labels with an embarrassingly simple and slow fixed-point
 * algorithm. This should be replaced by a more efficient constraint solver, but
 * that's a lot of work and fiddly. This should be good enough for now and
 * should even cover some of the next steps.
 *
 * Picture raising the trust levels where necessary to enable flow until it
 * stops changing. That is, this will propagate labels through the graph until
 * it reaches a fixed point. If it encounters a contradiction with a constraint,
 * it will throw an error, as the graph is not safe.
 *
 * Note: All Breadboard specific semantics has been factored out to the Graph
 * and Validator classes.
 *
 * @throws {Error} if the graph is not safe.
 */
export function computeLabelsForGraph(graph: Graph): void {
  // Clear prior labels.
  graph.nodes.forEach((node) => (node.label = new Label()));

  let change: boolean;
  do {
    change = false;
    graph.nodes.forEach((node) => {
      switch (node.role) {
        // Ignore placeholder nodes, as they'll get replaced by graphs that
        // might exhibit more trusted behavior than an untrusted node. Hence
        // when present, we just ignore them. This might mean disconnected
        // graphs until they are replaced.
        case NodeRoles.placeHolder: {
          return;
        }

        // Passthrough nodes are trusted to pass through data without
        // interference between the wires. Hence we can just copy the output's
        // labels to the inputs.
        //
        // TODO: Once we support confidentiality and track the existence of
        // data, required inputs will taint all others by leaking their
        // existence.
        //
        // TODO: Impllement once we support per-wire labels.
        //
        // case NodeRoles.passthrough:

        // Assume untrusted node, and hence that all inputs taint all outputs.
        default: {
          // Compute the meet (lowest label) of all incoming edge constraints.
          const incomingConstraint = Label.computeMeetOfLabels(
            node.incoming.map((edge) => edge.fromConstraint)
          );

          // Compute the meet (lowest label) of all incoming edges. Add the
          // constraint labels for this edge and node. This can lower the label,
          // but not raise it.
          const incomingLabel = Label.computeMeetOfLabels([
            ...node.incoming.map((edge) => edge.from.label),
            incomingConstraint,
            node.constraint,
          ]);

          // Compute the join (highest label) of all outgoing edges. Add the
          // constraint label for this edge and node. This can raise the label.
          const outgoingLabel = Label.computeJoinOfLabels([
            ...node.outgoing.map((edge) => edge.to.label),
            ...node.outgoing.map((edge) => edge.toConstraint),
            node.constraint,
          ]);

          // Graph is not safe if the incoming constraint is higher than the
          // node's constraint or the labels of the outgoing edges.
          if (!incomingConstraint.canFlowTo(node.constraint))
            throw Error(
              `Graph is not safe. Node ${node.node.id} is reading ` +
                `from ${incomingConstraint.toString()} but can only be ` +
                `${node.constraint?.toString()} due to constraint on node.`
            );

          if (!incomingConstraint.canFlowTo(outgoingLabel))
            throw Error(
              `Graph is not safe. Node ${node.node.id} is reading ` +
                `from ${incomingConstraint.toString()} but can only be ` +
                `${outgoingLabel.toString()}.`
            );

          // Graph is not safe if a constraint has to be violated, i.e. here a
          // node has to be upgraded.
          if (node.constraint && !node.constraint.equalsTo(outgoingLabel))
            throw Error(
              `Graph is not safe. E.g. node ${node.node.id} ` +
                `requires to write to ${outgoingLabel.toString()} ` +
                `but can only be ${node.constraint.toString()}.`
            );

          // Compute the new safety label as the join (highest of) of (lowest)
          // incoming and (highest) outgoing edges, but not higher than the
          // lowest constraint on incoming edges. Note that if this increases
          // the trust of this node, the next iteration will backpropagate that.
          const newLabel = Label.computeMeetOfLabels([
            incomingConstraint,
            Label.computeJoinOfLabels([incomingLabel, outgoingLabel]),
          ]);

          // If the new safety label is different from the current one, update it.
          if (!node.label || !newLabel.equalsTo(node.label)) {
            node.label = newLabel;
            change = true;
          }

          return;
        }
      }
    });
  } while (change);
}
