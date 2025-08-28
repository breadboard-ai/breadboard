# Planning System Documentation

The planning system converts a graph descriptor into an executable plan using topological sorting. This ensures that node dependencies are properly resolved and nodes can be executed in the correct order.

## Overview

The `createPlan` function takes a `GraphDescriptor` and produces an `OrchestrationPlan` that organizes nodes into stages based on their dependencies.

## Function Signature

```typescript
function createPlan(graph: GraphDescriptor): OrchestrationPlan
```

## Input: GraphDescriptor

```typescript
type GraphDescriptor = {
  nodes?: NodeDescriptor[];
  edges?: Edge[];
  // ... other properties
};

type NodeDescriptor = {
  id: string;
  type: string;
  configuration?: NodeConfiguration;
  metadata?: NodeMetadata;
};

type Edge = {
  from: string;
  to: string;
  out?: string;
  in?: string;
};
```

## Output: OrchestrationPlan

```typescript
type OrchestrationPlan = {
  stages: PlanNodeInfo[][];
};

type PlanNodeInfo = {
  node: NodeDescriptor;
  downstream: Edge[];    // Edges going OUT from this node
  upstream: Edge[];      // Edges coming INTO this node
};
```

## Algorithm Details

### 1. Dependency Analysis

The planner builds dependency maps by analyzing edges:

```typescript
// For each node, track:
const inDegree = new Map<string, number>();     // Number of incoming edges
const outEdges = new Map<string, Edge[]>();     // Outgoing edges
const inEdges = new Map<string, Edge[]>();      // Incoming edges
```

### 2. Topological Sorting

Uses Kahn's algorithm for topological sorting:

1. Start with nodes that have no dependencies (in-degree = 0)
2. Process each node and reduce in-degree of its dependents
3. Add newly available nodes (in-degree becomes 0) to next stage
4. Repeat until all nodes are processed

### 3. Stage Creation

Nodes with no remaining dependencies are grouped into stages that can execute in parallel.

## Usage Examples

### Basic Linear Graph

```typescript
const linearGraph = {
  nodes: [
    { id: 'input', type: 'input' },
    { id: 'process', type: 'worker' },
    { id: 'output', type: 'output' }
  ],
  edges: [
    { from: 'input', to: 'process' },
    { from: 'process', to: 'output' }
  ]
};

const plan = createPlan(linearGraph);
// Result:
// Stage 0: [input]
// Stage 1: [process]
// Stage 2: [output]
```

### Parallel Processing

```typescript
const parallelGraph = {
  nodes: [
    { id: 'input', type: 'input' },
    { id: 'worker1', type: 'worker' },
    { id: 'worker2', type: 'worker' },
    { id: 'combiner', type: 'combiner' }
  ],
  edges: [
    { from: 'input', to: 'worker1' },
    { from: 'input', to: 'worker2' },
    { from: 'worker1', to: 'combiner' },
    { from: 'worker2', to: 'combiner' }
  ]
};

const plan = createPlan(parallelGraph);
// Result:
// Stage 0: [input]
// Stage 1: [worker1, worker2]  // Execute in parallel
// Stage 2: [combiner]
```

### Diamond Pattern

```typescript
const diamondGraph = {
  nodes: [
    { id: 'start', type: 'input' },
    { id: 'left', type: 'worker' },
    { id: 'right', type: 'worker' },
    { id: 'end', type: 'output' }
  ],
  edges: [
    { from: 'start', to: 'left' },
    { from: 'start', to: 'right' },
    { from: 'left', to: 'end' },
    { from: 'right', to: 'end' }
  ]
};

const plan = createPlan(diamondGraph);
// Result:
// Stage 0: [start]
// Stage 1: [left, right]  // Parallel execution
// Stage 2: [end]
```

## Edge Information in PlanNodeInfo

Each `PlanNodeInfo` contains detailed edge information:

### Upstream Edges
Edges coming into the node, used for collecting inputs:

```typescript
const nodeInfo = plan.stages[1][0]; // Some node in stage 1
nodeInfo.upstream.forEach(edge => {
  console.log(`Input ${edge.in} comes from ${edge.from}.${edge.out}`);
});
```

### Downstream Edges
Edges going out from the node, used for output routing:

```typescript
nodeInfo.downstream.forEach(edge => {
  console.log(`Output ${edge.out} goes to ${edge.to}.${edge.in}`);
});
```

## Empty Graph Handling

```typescript
const emptyGraph = { nodes: [] };
const plan = createPlan(emptyGraph);
// Result: { stages: [] }

const noNodes = {};
const plan2 = createPlan(noNodes);
// Result: { stages: [] }
```

## Edge Handling Details

### Default Port Names

When edges don't specify port names, the algorithm handles them gracefully:

```typescript
// Edge without port specification
{ from: 'nodeA', to: 'nodeB' }

// Is treated as:
{ from: 'nodeA', to: 'nodeB', out: '', in: '' }
```

### Multiple Edges

Multiple edges between the same nodes are preserved:

```typescript
const multiEdgeGraph = {
  nodes: [
    { id: 'A', type: 'multi-output' },
    { id: 'B', type: 'multi-input' }
  ],
  edges: [
    { from: 'A', to: 'B', out: 'result1', in: 'input1' },
    { from: 'A', to: 'B', out: 'result2', in: 'input2' }
  ]
};

const plan = createPlan(multiEdgeGraph);
// Both edges preserved in PlanNodeInfo
```

## Common Planning Patterns

### Sequential Processing Chain

```typescript
// A -> B -> C -> D
const chain = {
  nodes: [
    { id: 'A', type: 'start' },
    { id: 'B', type: 'step1' },
    { id: 'C', type: 'step2' },
    { id: 'D', type: 'end' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'D' }
  ]
};
// Results in 4 stages: [A], [B], [C], [D]
```

### Fan-out/Fan-in

```typescript
// One input, multiple processors, one output
const fanPattern = {
  nodes: [
    { id: 'input', type: 'data-source' },
    { id: 'proc1', type: 'processor' },
    { id: 'proc2', type: 'processor' },
    { id: 'proc3', type: 'processor' },
    { id: 'output', type: 'aggregator' }
  ],
  edges: [
    // Fan-out
    { from: 'input', to: 'proc1' },
    { from: 'input', to: 'proc2' },
    { from: 'input', to: 'proc3' },
    // Fan-in
    { from: 'proc1', to: 'output' },
    { from: 'proc2', to: 'output' },
    { from: 'proc3', to: 'output' }
  ]
};
// Results in 3 stages: [input], [proc1, proc2, proc3], [output]
```

### Complex Dependencies

```typescript
// More complex dependency graph
const complexGraph = {
  nodes: [
    { id: 'A', type: 'start' },
    { id: 'B', type: 'early' },
    { id: 'C', type: 'middle' },
    { id: 'D', type: 'depends-on-A-and-B' },
    { id: 'E', type: 'depends-on-C-and-D' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'D' },
    { from: 'B', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'E' },
    { from: 'D', to: 'E' }
  ]
};
// Results in stages: [A], [B], [C, D], [E]
```

## Planning Validation

The planner assumes the input graph is:

1. **Acyclic** - No cycles in the dependency graph
2. **Well-formed** - All edge references point to existing nodes
3. **Connected** - Nodes are reachable through dependencies

For graphs with cycles, use the [condensation system](./condensation.md) first to convert cycles into subgraphs.

## Performance Characteristics

- **Time Complexity**: O(V + E) where V is nodes and E is edges
- **Space Complexity**: O(V + E) for storing the dependency maps
- **Parallelism**: Maximizes parallel execution opportunities

## Integration with Orchestrator

The orchestrator uses the plan to:

1. **Determine execution order** - Process stages sequentially
2. **Identify parallel nodes** - Execute nodes within stages concurrently
3. **Manage dependencies** - Use upstream/downstream edge information
4. **Route data** - Connect outputs to inputs based on edge specifications

```typescript
const plan = createPlan(graph);
const orchestrator = new Orchestrator(plan, callbacks);

// Orchestrator uses plan.stages to determine execution order
// and PlanNodeInfo.upstream/downstream for data routing
```

## Error Handling

The `createPlan` function is designed to be robust:

- **Empty graphs** return empty plans
- **Missing nodes/edges** are handled gracefully
- **Invalid edge references** are ignored
- **Duplicate edges** are preserved

For production use, consider validating your graph structure before planning:

```typescript
function validateGraph(graph: GraphDescriptor): boolean {
  // Check that all edge references point to existing nodes
  const nodeIds = new Set(graph.nodes?.map(n => n.id) || []);
  return graph.edges?.every(edge => 
    nodeIds.has(edge.from) && nodeIds.has(edge.to)
  ) ?? true;
}

if (validateGraph(myGraph)) {
  const plan = createPlan(myGraph);
} else {
  throw new Error('Invalid graph structure');
}
```