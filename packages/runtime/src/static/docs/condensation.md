# Graph Condensation Documentation

The condensation system handles graphs with cycles by identifying strongly connected components (SCCs) and converting them into subgraphs. This transforms cyclic graphs into directed acyclic graphs (DAGs) that can be executed by the planning system.

## Overview

Strongly connected components represent cycles in directed graphs. The `condense` function finds these cycles and replaces them with subgraphs, making the overall graph acyclic while preserving the original logic.

## Function Signature

```typescript
function condense(graph: GraphDescriptor): GraphDescriptor
```

## What are Strongly Connected Components?

A **strongly connected component (SCC)** is a maximal set of vertices in a directed graph where every vertex is reachable from every other vertex within the set. In simpler terms, SCCs represent cycles in the graph.

### Examples of SCCs

#### Simple Cycle
```
A → B → C → A
```
This forms one SCC containing nodes A, B, and C.

#### Complex SCC
```
A → B → C
↑   ↓   ↓
D ← E ← F
```
All nodes A, B, C, D, E, F form one SCC since every node can reach every other node.

#### Self-Loop
```
A → A
```
Node A forms an SCC by itself due to the self-loop.

## Algorithm: Tarjan's Algorithm

The condensation system uses Tarjan's strongly connected components algorithm, which:

1. Performs depth-first search (DFS) on the graph
2. Maintains a stack of visited nodes
3. Tracks discovery time and low-link values for each node
4. Identifies SCCs when the low-link value equals the discovery time

### Time Complexity
- **Time**: O(V + E) where V is vertices and E is edges
- **Space**: O(V) for the recursion stack and node state

## Condensation Process

### 1. SCC Detection

```typescript
// Input: Graph with cycles
const cyclicGraph = {
  nodes: [
    { id: 'A', type: 'worker' },
    { id: 'B', type: 'worker' },
    { id: 'C', type: 'output' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },  // Creates A-B cycle
    { from: 'B', to: 'C' }
  ]
};

// SCCs found: [['A', 'B']]  (C is not part of any non-trivial SCC)
```

### 2. Subgraph Creation

For each SCC, a subgraph is created with:

- **Input node**: Captures incoming edges from outside the SCC
- **Original nodes**: The nodes that formed the SCC
- **Output node**: Captures outgoing edges to outside the SCC
- **Internal edges**: Edges between nodes within the SCC
- **Bridge edges**: Connect input/output nodes to internal nodes

### 3. Graph Restructuring

The original graph is modified:

- SCC nodes are removed from the main graph
- A single "folded" node replaces the entire SCC
- The folded node references the subgraph
- External edges are rewired to the folded node

## Detailed Example

### Original Cyclic Graph

```typescript
const cyclicGraph = {
  nodes: [
    { id: 'input', type: 'input' },
    { id: 'A', type: 'worker' },
    { id: 'B', type: 'worker' },
    { id: 'output', type: 'output' }
  ],
  edges: [
    { from: 'input', to: 'A', out: 'data', in: 'input' },
    { from: 'A', to: 'B', out: 'result', in: 'data' },
    { from: 'B', to: 'A', out: 'feedback', in: 'control' }, // Creates cycle
    { from: 'B', to: 'output', out: 'final', in: 'result' }
  ]
};
```

### After Condensation

```typescript
const condensedGraph = {
  nodes: [
    { id: 'input', type: 'input' },
    { 
      id: 'scc_0', 
      type: '#scc_0',  // References subgraph
      metadata: { tags: ['folded'] }
    },
    { id: 'output', type: 'output' }
  ],
  edges: [
    { from: 'input', to: 'scc_0', out: 'data', in: 'input' },
    { from: 'scc_0', to: 'output', out: 'final', in: 'result' }
  ],
  graphs: {
    'scc_0': {
      title: 'SCC Subgraph scc_0',
      description: 'Subgraph containing strongly connected component',
      nodes: [
        { 
          id: 'input_scc_0', 
          type: 'input',
          metadata: { title: 'Subgraph Input' }
        },
        { id: 'A', type: 'worker' },  // Original node
        { id: 'B', type: 'worker' },  // Original node
        { 
          id: 'output_scc_0', 
          type: 'output',
          metadata: { title: 'Subgraph Output' }
        }
      ],
      edges: [
        // Internal cycle preserved
        { from: 'A', to: 'B', out: 'result', in: 'data' },
        { from: 'B', to: 'A', out: 'feedback', in: 'control' },
        
        // Input bridge
        { from: 'input_scc_0', to: 'A', out: 'input', in: 'input' },
        
        // Output bridge  
        { from: 'B', to: 'output_scc_0', in: 'final', out: 'final' }
      ]
    }
  }
};
```

## Usage Examples

### Basic Cycle Handling

```typescript
import { condense } from '@breadboard-ai/runtime/static/condense.js';

const graphWithCycle = {
  nodes: [
    { id: 'A', type: 'processor' },
    { id: 'B', type: 'processor' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' }  // Creates cycle
  ]
};

const acyclicGraph = condense(graphWithCycle);
// Now acyclicGraph can be used with createPlan()
```

### Complex Multi-Component Graph

```typescript
const complexGraph = {
  nodes: [
    { id: 'start', type: 'input' },
    { id: 'A', type: 'worker' },
    { id: 'B', type: 'worker' },
    { id: 'C', type: 'worker' },
    { id: 'D', type: 'worker' },
    { id: 'end', type: 'output' }
  ],
  edges: [
    { from: 'start', to: 'A' },
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },     // Cycle 1: A-B
    { from: 'B', to: 'C' },
    { from: 'C', to: 'D' },
    { from: 'D', to: 'C' },     // Cycle 2: C-D
    { from: 'D', to: 'end' }
  ]
};

const condensed = condense(complexGraph);
// Results in two subgraphs: one for A-B cycle, one for C-D cycle
```

## Subgraph Structure

### Input/Output Nodes

Each subgraph gets special input and output nodes:

```typescript
// Input node captures external inputs
const inputNode = {
  id: `input_${subgraphId}`,
  type: 'input',
  metadata: {
    title: 'Subgraph Input',
    description: 'Captures incoming edges to the subgraph'
  }
};

// Output node captures external outputs
const outputNode = {
  id: `output_${subgraphId}`,
  type: 'output', 
  metadata: {
    title: 'Subgraph Output',
    description: 'Captures outgoing edges from the subgraph'
  }
};
```

### Edge Rewiring

The condensation process carefully rewires edges:

#### Incoming Edges
```typescript
// Original: external_node → scc_node
// Becomes: external_node → folded_node (in main graph)
//     AND: input_node → scc_node (in subgraph)
```

#### Outgoing Edges
```typescript
// Original: scc_node → external_node  
// Becomes: folded_node → external_node (in main graph)
//     AND: scc_node → output_node (in subgraph)
```

#### Internal Edges
```typescript
// Original: scc_node1 → scc_node2
// Remains: scc_node1 → scc_node2 (preserved in subgraph)
```

## Integration with Planning

After condensation, the resulting DAG can be used with the planning system:

```typescript
import { condense } from '@breadboard-ai/runtime/static/condense.js';
import { createPlan } from '@breadboard-ai/runtime/static/create-plan.js';

// Handle cyclic graph
const cyclicGraph = loadGraphWithCycles();
const acyclicGraph = condense(cyclicGraph);
const plan = createPlan(acyclicGraph);

// Now the plan can be executed
const orchestrator = new Orchestrator(plan, callbacks);
```

## Handling Different Cycle Types

### Self-Loops

```typescript
const selfLoopGraph = {
  nodes: [{ id: 'A', type: 'recursive' }],
  edges: [{ from: 'A', to: 'A' }]  // Self-loop
};

const condensed = condense(selfLoopGraph);
// Creates subgraph containing just node A with preserved self-loop
```

### Nested Cycles

```typescript
const nestedGraph = {
  nodes: [
    { id: 'A', type: 'worker' },
    { id: 'B', type: 'worker' },
    { id: 'C', type: 'worker' },
    { id: 'D', type: 'worker' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'A' },  // Outer cycle A-B-C
    { from: 'B', to: 'D' },
    { from: 'D', to: 'B' }   // Inner cycle B-D
  ]
};

// All nodes A, B, C, D form one large SCC
// since B is reachable from the A-B-C cycle and vice versa
```

## Performance Considerations

### When to Use Condensation

- **Always** when your graph might contain cycles
- **Before planning** since planners expect DAGs
- **During graph loading** as a preprocessing step

### Performance Characteristics

- **Detection**: O(V + E) using Tarjan's algorithm
- **Subgraph creation**: O(E) for edge processing
- **Memory overhead**: Additional subgraphs stored in `graphs` property

### Optimization Tips

```typescript
// Check if condensation is needed first
function needsCondensation(graph: GraphDescriptor): boolean {
  // Quick heuristic: if any node has in-degree > 0 and out-degree > 0
  // and there are multiple nodes, cycles might exist
  return graph.nodes?.length > 1 && 
         graph.edges?.some(edge => /* complex cycle detection */);
}

if (needsCondensation(graph)) {
  graph = condense(graph);
}
```

## Common Patterns

### Feedback Loops

```typescript
// Machine learning training loop
const trainingLoop = {
  nodes: [
    { id: 'data', type: 'input' },
    { id: 'model', type: 'ml-model' },
    { id: 'evaluate', type: 'evaluator' },
    { id: 'update', type: 'optimizer' },
    { id: 'output', type: 'output' }
  ],
  edges: [
    { from: 'data', to: 'model' },
    { from: 'model', to: 'evaluate' },
    { from: 'evaluate', to: 'update' },
    { from: 'update', to: 'model' },      // Feedback cycle
    { from: 'evaluate', to: 'output' }
  ]
};
```

### Control Flow Cycles

```typescript
// While loop structure
const whileLoop = {
  nodes: [
    { id: 'init', type: 'initializer' },
    { id: 'condition', type: 'conditional' },
    { id: 'body', type: 'processor' },
    { id: 'exit', type: 'output' }
  ],
  edges: [
    { from: 'init', to: 'condition' },
    { from: 'condition', to: 'body', out: 'true' },
    { from: 'body', to: 'condition' },        // Loop back
    { from: 'condition', to: 'exit', out: 'false' }
  ]
};
```

## Debugging Condensed Graphs

### Inspecting Subgraphs

```typescript
const condensed = condense(originalGraph);

// List all subgraphs created
Object.keys(condensed.graphs || {}).forEach(subgraphId => {
  console.log(`Subgraph ${subgraphId}:`);
  const subgraph = condensed.graphs[subgraphId];
  console.log(`  Nodes: ${subgraph.nodes.length}`);
  console.log(`  Edges: ${subgraph.edges.length}`);
});
```

### Visualizing SCC Structure

```typescript
// Custom function to trace SCC boundaries
function analyzeSCCs(graph: GraphDescriptor) {
  const sccs = findStronglyConnectedComponents(graph);
  sccs.forEach((scc, index) => {
    console.log(`SCC ${index}: ${scc.join(', ')}`);
  });
}
```

## Error Handling

The condensation system is robust and handles edge cases:

- **Empty graphs**: Returns unchanged
- **Acyclic graphs**: Returns unchanged (no SCCs found)
- **Disconnected components**: Processes each component independently
- **Invalid edge references**: Ignores malformed edges

```typescript
// Safe usage pattern
try {
  const condensed = condense(potentiallyInvalidGraph);
  const plan = createPlan(condensed);
} catch (error) {
  console.error('Graph processing failed:', error);
  // Handle error appropriately
}
```