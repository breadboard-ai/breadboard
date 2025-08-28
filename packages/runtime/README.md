# Breadboard Runtime

The Breadboard Runtime package provides the core execution engine for running Breadboard graphs. It implements a sophisticated static execution model that handles graph planning, orchestration, and state management.

## Architecture Overview

The runtime is built around a **static execution model** that separates concerns into distinct phases:

1. **Planning** - Analyzing the graph structure and creating an execution plan
2. **Orchestration** - Managing the execution state and coordinating node invocations  
3. **Invocation** - Actually running the nodes with proper lifecycle management

## Static Directory

The `src/static/` directory contains the core components of the static execution system:

### Core Components

- **[Orchestrator](#orchestrator)** (`orchestrator.ts`) - The main state machine for graph execution
- **[Planning System](#planning-system)** (`create-plan.ts`) - Creates execution plans using topological sorting
- **[Graph Condensation](#graph-condensation)** (`condense.ts`) - Handles strongly connected components
- **[Node Grouping](#node-grouping)** (`nodes-to-subgraph.ts`) - Utilities for creating subgraphs
- **[Type Definitions](#type-definitions)** (`types.ts`) - Orchestration-related types

---

## Orchestrator

The `Orchestrator` class is the heart of the runtime system. It acts as a state machine that manages the execution of a graph from start to finish.

### Key Responsibilities

1. **Lifecycle Management** - Starting, resetting, and managing overall progress
2. **Task Coordination** - Determining which nodes are ready for execution
3. **State Persistence** - Tracking and persisting execution state
4. **Inspection and Debugging** - Providing observability into execution progress

### Node Lifecycle States

Each node in the graph progresses through a well-defined set of states:

- `inactive` - Node dependencies have not been met
- `ready` - Dependencies met, queued for invocation
- `working` - Node is actively executing
- `waiting` - Node is awaiting additional input (multi-turn interactions)
- `succeeded` - Node completed successfully, outputs available
- `failed` - Node execution failed
- `skipped` - Node was bypassed (conditional routing)
- `interrupted` - Node execution was interrupted

### Basic Usage

```typescript
import { Orchestrator } from '@breadboard-ai/runtime/static/orchestrator.js';
import { createPlan } from '@breadboard-ai/runtime/static/create-plan.js';

// Create an execution plan from your graph
const plan = createPlan(graphDescriptor);

// Create orchestrator with callbacks
const orchestrator = new Orchestrator(plan, {
  stateChangedbyOrchestrator: (nodeId, state) => {
    console.log(`Node ${nodeId} changed to ${state}`);
  }
});

// Get current tasks to execute
const tasks = orchestrator.currentTasks();
if (tasks.length > 0) {
  // Mark node as working
  orchestrator.setWorking(tasks[0].node.id);
  
  // Simulate node execution and provide outputs
  const outputs = { result: "some result" };
  const progress = orchestrator.provideOutputs(tasks[0].node.id, outputs);
  
  console.log(`Orchestration progress: ${progress}`);
}
```

### State Management Methods

```typescript
// Lifecycle control
orchestrator.reset()                    // Reset to initial state
orchestrator.restartAtStage(2)         // Restart from specific stage
orchestrator.restartAtNode('node-id')  // Restart from specific node

// Node state changes
orchestrator.setWorking('node-id')     // Mark node as working
orchestrator.setWaiting('node-id')     // Mark node as waiting for input
orchestrator.setInterrupted('node-id') // Mark node as interrupted

// State inspection
orchestrator.state()                   // Get current node states
orchestrator.fullState()               // Get detailed orchestrator state
orchestrator.currentTasks()            // Get nodes ready for execution
```

---

## Planning System

The planning system (`create-plan.ts`) converts a graph descriptor into an executable plan using topological sorting.

### How It Works

1. **Dependency Analysis** - Analyzes node dependencies based on edges
2. **Topological Sorting** - Orders nodes to ensure dependencies are met
3. **Stage Creation** - Groups nodes that can execute in parallel into stages

### Execution Plan Structure

```typescript
type OrchestrationPlan = {
  stages: PlanNodeInfo[][];  // Array of stages, each containing parallel nodes
};

type PlanNodeInfo = {
  node: NodeDescriptor;      // The actual node
  downstream: Edge[];        // Edges going out from this node  
  upstream: Edge[];          // Edges coming into this node
};
```

### Usage Example

```typescript
import { createPlan } from '@breadboard-ai/runtime/static/create-plan.js';

const plan = createPlan({
  nodes: [
    { id: 'input', type: 'input' },
    { id: 'process', type: 'worker' },
    { id: 'output', type: 'output' }
  ],
  edges: [
    { from: 'input', to: 'process', out: 'text', in: 'input' },
    { from: 'process', to: 'output', out: 'result', in: 'text' }
  ]
});

// Plan will have 3 stages:
// Stage 0: [input]
// Stage 1: [process]  
// Stage 2: [output]
```

---

## Graph Condensation

The condensation system (`condense.ts`) handles graphs with cycles by identifying strongly connected components (SCCs) and converting them into subgraphs.

### Strongly Connected Components

A strongly connected component is a set of nodes where every node is reachable from every other node following directed edges. Cycles in graphs create SCCs.

### How Condensation Works

1. **SCC Detection** - Uses Tarjan's algorithm to find all SCCs
2. **Subgraph Creation** - Converts each SCC into a separate subgraph
3. **Graph Restructuring** - Replaces SCCs with single nodes that reference subgraphs

### Usage Example

```typescript
import { condense } from '@breadboard-ai/runtime/static/condense.js';

// Graph with a cycle between nodes A and B
const cyclicGraph = {
  nodes: [
    { id: 'A', type: 'worker' },
    { id: 'B', type: 'worker' },
    { id: 'C', type: 'output' }
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },  // Creates cycle
    { from: 'B', to: 'C' }
  ]
};

const condensedGraph = condense(cyclicGraph);
// Results in a DAG with SCC subgraph for the A-B cycle
```

---

## Node Grouping

The node grouping utilities (`nodes-to-subgraph.ts`) provide functionality to move groups of nodes into subgraphs, enabling graph modularization.

### Key Features

- **Node Extraction** - Moves specified nodes into a new subgraph
- **Edge Rewiring** - Properly handles edges crossing subgraph boundaries
- **Input/Output Nodes** - Creates input/output nodes to manage subgraph interfaces

### Usage Example

```typescript
import { nodesToSubgraph } from '@breadboard-ai/runtime/static/nodes-to-subgraph.js';

// Move nodes 'A' and 'B' into a subgraph
nodesToSubgraph(
  graph,
  ['A', 'B'],           // Node IDs to include
  'my-subgraph',        // Subgraph ID
  'My Subgraph',        // Title
  'A grouped subgraph'  // Description
);

// The original graph now has a folded node referencing the subgraph
```

---

## Type Definitions

The `types.ts` file contains TypeScript definitions for orchestration controllers and breakpoint management (currently work-in-progress).

### Core Types

```typescript
type OrchestrationController = {
  run(): Promise<Outcome<void>>;
  continue(): Promise<Outcome<void>>;
  stepThroughNode(): Promise<Outcome<void>>;
  stepThroughStage(): Promise<Outcome<void>>;
  breakpoints: BreakpointsController;
};
```

---

## Error Handling

The runtime uses a consistent `Outcome<T>` pattern for error handling:

```typescript
// Success case
const result = orchestrator.setWorking('node-id');
if (ok(result)) {
  // Operation succeeded
} else {
  // Handle error: result.$error contains error message
  console.error(result.$error);
}
```

---

## Signals Integration

The orchestrator integrates with the [signal-polyfill](https://www.npmjs.com/package/signal-polyfill) for reactive state management:

```typescript
// The orchestrator state changes trigger signal updates
const orchestrator = new Orchestrator(plan, callbacks);

// State changes will automatically trigger signal updates
// allowing reactive UIs to respond to orchestration changes
```

---

## Best Practices

1. **Always check execution results** using the `ok()` utility function
2. **Handle errors gracefully** by checking `Outcome` types
3. **Use appropriate lifecycle methods** for state transitions
4. **Monitor orchestration progress** through callbacks and state inspection
5. **Plan graphs properly** to avoid dependency issues

---

## Related Packages

- `@breadboard-ai/types` - Core type definitions
- `@breadboard-ai/utils` - Utility functions
- `@breadboard-ai/loader` - Graph loading utilities