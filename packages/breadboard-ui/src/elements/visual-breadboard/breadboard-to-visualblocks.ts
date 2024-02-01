
import {OutputIdentifier} from '@google-labs/breadboard';
import {NodeDescriptor, GraphDescriptor, InputIdentifier} from '@google-labs/breadboard'


function breadboardNodeToVisualBlocks(
    node: NodeDescriptor,
) {
  return {
    id: node.id,
    displayLabel: node.id,
    nodeSpecId: 'default', // TODO: More node specs for different node types
    uiData: { // This gets overwritten by auto-layout
      hovered: false,
      posX: 194.49770545401046,
      posY: 138.6742722180565,
      selected: false,
      width: 150,
    },
    inputValues: node.configuration,
  };
}

export function breadboardToVisualBlocks(
  graph: GraphDescriptor,
) {
  const serializedGraphMap: any = {}; // TODO: VB Types

  for (const node of graph.nodes) {
    serializedGraphMap[node.id] = breadboardNodeToVisualBlocks(node);
  }

  // Collect the current set of inputs and outputs for each node.
  // This is used to initialize the dynamic io field for the visual blocks
  // node so that it doesn't immediately delete the connections.
  const nodeIO = new Map(
    graph.nodes.map((node: {id: string}) => [ // TODO: VB types
      node.id,
      {
        inputs: new Set<InputIdentifier>(),
        outputs: new Set<OutputIdentifier>(),
      },
    ]),
  );

  for (const edge of graph.edges) {
    const source = serializedGraphMap[edge.from];
    const destination = serializedGraphMap[edge.to];
    if (destination == null) {
      throw new Error(
        'Graph is missing destination node for edge from' +
          ` ${edge.from} to ${edge.to}`,
      );
    }
    destination.incomingEdges = destination.incomingEdges ?? {};

    // Handle special edges like control flow and '*' edges.
    let edgeIn = edge.in;
    let edgeOut = edge.out;
    if (edgeIn == null) {
      if (edgeOut == null) {
        edgeIn = '-';
        edgeOut = '-';
      } else if (edgeOut === '*') {
        edgeIn = '*';
        edgeOut = '*';
        // TODO(msoulanille): Handle '*' edges.
        //throw new Error('"*" edges are not supported yet');
      } else {
        throw new Error(
          `Wire output '${edgeOut}' from '${edge.from}' to ` +
            `'${edge.to}' does not specify an input that it's wired to.`,
        );
      }
    }

    if (edgeOut == null) {
      throw new Error(
        `Wire does not specify an output from '${edge.from}'` +
          ` but does specify the input '${edgeIn}' on '${edge.to}'.`,
      );
    }

    nodeIO.get(edge.from)?.outputs.add(edgeOut);
    nodeIO.get(edge.to)?.inputs.add(edgeIn);

    // TODO(msoulanille): Refactor the input node and remove `BB Prop`.
    if (source.nodeSpecId === 'input') {
      source.propValues = {
        'BB Prop': edgeOut,
      };
    }

    destination.incomingEdges[edgeIn] =
      destination.incomingEdges[edgeIn] ?? [];
    destination.incomingEdges[edgeIn].push({
      outputId: edgeOut,
      sourceNodeId: edge.from,
    });
  }

  // Set the dynamic input / output specs to the current configuration
  // so VB doesn't immediately break connections that don't appear in the
  // static I/O config for the given nodes.
  for (const node of graph.nodes) {
    const vbNode = serializedGraphMap[node.id];
    const {inputs, outputs} = nodeIO.get(node.id)!;

    vbNode.nodeDynamicSpec = {
      inputSpecs: [...inputs].map((name) => ({
        name,
        // TODO(msoulanille): Some kind of any type, as a placeholder
        // until the user first runs the graph (and we get real
        // vals to pass to the reflection function).
        type: 'string',
      })),
      outputSpecs: [...outputs].map((name) => ({
        name,
        type: 'string',
      })),
    };
  }

  return {
    nodes: Object.values(serializedGraphMap),
  };
}
