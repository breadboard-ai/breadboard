import type { GraphDescriptor, Edge, NodeDescriptor } from "./types.js";

export class Board {
  private edges: Edge[] = [];
  private nodes: NodeDescriptor[] = [];

  serialize(): GraphDescriptor {
    return {
      edges: this.edges.map((edge) => {
        const serialized: Edge = {
          from: edge.from,
          to: edge.to,
        };
        if (edge.out !== undefined) serialized.out = edge.out;
        if (edge.in !== undefined) serialized.in = edge.in;
        if (edge.required !== undefined) serialized.required = edge.required;
        return serialized;
      }),
      nodes: this.nodes,
    };
  }

  static deserialize(descriptor: GraphDescriptor): Board {
    const board = new Board();
    board.nodes = descriptor.nodes || [];
    
    for (const edge of descriptor.edges || []) {
      const newEdge: Edge = {
        from: edge.from,
        to: edge.to,
      };
      if (edge.out !== undefined) newEdge.out = edge.out;
      if (edge.in !== undefined) newEdge.in = edge.in;
      if (edge.required !== undefined) newEdge.required = edge.required;
      board.edges.push(newEdge);
    }
    
    return board;
  }
}