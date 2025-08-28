# Static Execution System

The static directory contains the core components for Breadboard's static execution model. This system provides deterministic, plannable execution of graph workflows with sophisticated state management and debugging capabilities.

## Architecture Overview

The static execution system separates concerns into three main phases:

1. **Planning** - Analyze graph structure and create execution plan
2. **Orchestration** - Manage execution state and coordinate node invocations
3. **Invocation** - Execute individual nodes within the orchestrated flow

## Core Components

### 📋 [Planning System](./docs/planning.md)
- **File**: `create-plan.ts`
- **Purpose**: Convert graph descriptors into executable plans using topological sorting
- **Key Features**: Dependency analysis, parallel execution optimization, stage creation

### 🎭 [Orchestrator](./docs/orchestrator.md)
- **File**: `orchestrator.ts`
- **Purpose**: State machine for managing graph execution lifecycle
- **Key Features**: Node lifecycle management, task coordination, state persistence, debugging support

### 🌀 [Graph Condensation](./docs/condensation.md)
- **File**: `condense.ts`
- **Purpose**: Handle graphs with cycles by converting them to subgraphs
- **Key Features**: Strongly connected component detection, cycle elimination, DAG transformation

### 📦 [Node Grouping](./docs/node-grouping.md)
- **File**: `nodes-to-subgraph.ts`
- **Purpose**: Organize nodes into reusable subgraph components
- **Key Features**: Modular graph composition, edge rewiring, interface management

### 🔧 [Type Definitions](./docs/types.md)
- **File**: `types.ts`
- **Purpose**: Future API definitions for orchestration controllers
- **Key Features**: Breakpoint management, stepping controls, debugging interfaces

## Quick Start

### Basic Usage

```typescript
import { createPlan } from './create-plan.js';
import { Orchestrator } from './orchestrator.js';

// 1. Create execution plan
const plan = createPlan(yourGraph);

// 2. Create orchestrator
const orchestrator = new Orchestrator(plan, {
  stateChangedbyOrchestrator: (nodeId, state) => {
    console.log(`${nodeId}: ${state}`);
  }
});

// 3. Execute workflow
while (orchestrator.progress !== 'finished') {
  const tasks = orchestrator.currentTasks();
  if (!Array.isArray(tasks)) break;
  
  for (const task of tasks) {
    orchestrator.setWorking(task.node.id);
    const outputs = await executeNode(task.node, task.inputs);
    orchestrator.provideOutputs(task.node.id, outputs);
  }
}
```

### Handling Cycles

```typescript
import { condense } from './condense.js';
import { createPlan } from './create-plan.js';

// Handle cyclic graphs
const acyclicGraph = condense(cyclicGraph);
const plan = createPlan(acyclicGraph);
// ... continue with orchestration
```

### Creating Subgraphs

```typescript
import { nodesToSubgraph } from './nodes-to-subgraph.js';

// Group related nodes
nodesToSubgraph(
  graph,
  ['validator', 'transformer', 'enricher'],
  'processing-pipeline',
  'Data Processing Pipeline'
);
```

## Documentation

### API Reference
- [Orchestrator API](./docs/orchestrator.md) - Complete API reference for the orchestrator
- [Planning API](./docs/planning.md) - Graph planning and execution plan creation
- [Condensation API](./docs/condensation.md) - Cycle handling and graph condensation
- [Node Grouping API](./docs/node-grouping.md) - Subgraph creation utilities
- [Type Definitions](./docs/types.md) - Future API type definitions

### Examples
- [Examples Directory](./examples/) - Practical usage examples
- Basic orchestration patterns
- Complex workflow management
- Error handling strategies
- Reactive UI integration

## Key Concepts

### Node Lifecycle States

Each node progresses through well-defined states:

- `inactive` → `ready` → `working` ⟷ `waiting` → `succeeded`/`failed`/`interrupted`
- `skipped` - Node bypassed due to conditional logic

### Execution Stages

Graphs are organized into stages where:
- Nodes within a stage can execute in parallel
- Stages execute sequentially
- Dependencies are satisfied before stage advancement

### State Management

The orchestrator maintains:
- **Node states**: Current lifecycle state of each node
- **Inputs/Outputs**: Cached data for each node execution
- **Progress tracking**: Overall orchestration progress
- **Signal integration**: Reactive state updates

## Best Practices

### Planning
1. **Validate graphs** before planning to catch cycles early
2. **Optimize dependencies** to maximize parallel execution
3. **Use condensation** for graphs that may contain cycles

### Orchestration
1. **Check outcomes** using `ok()` utility for all operations
2. **Handle errors gracefully** with proper error propagation
3. **Monitor state changes** through callbacks for debugging
4. **Use appropriate lifecycle methods** for state transitions

### Organization
1. **Group related nodes** into subgraphs for reusability
2. **Create meaningful interfaces** with proper input/output handling
3. **Document subgraph purposes** with clear titles and descriptions

## Integration Points

### With Other Runtime Components
- **Node Invokers**: Execute individual nodes within orchestrated flow
- **Graph Loaders**: Load and validate graphs before planning
- **Serialization**: Persist and restore orchestration state

### With UI Systems
- **Signal Integration**: Reactive state updates for UI components
- **Progress Tracking**: Real-time execution monitoring
- **Debugging Support**: Breakpoints and state inspection

## Performance Characteristics

### Planning
- **Time Complexity**: O(V + E) for topological sorting
- **Space Complexity**: O(V + E) for dependency maps
- **Optimization**: Maximizes parallel execution opportunities

### Orchestration
- **State Overhead**: O(V) for node state tracking
- **Signal Updates**: Efficient reactive state propagation
- **Memory Usage**: Caches inputs/outputs for restart capabilities

### Condensation
- **Cycle Detection**: O(V + E) using Tarjan's algorithm
- **Subgraph Creation**: Additional memory for cycle subgraphs
- **Performance**: One-time cost for cycle elimination

## Error Handling

The static system uses consistent error handling patterns:

```typescript
import { ok } from '@breadboard-ai/utils';

// All operations return Outcome<T> types
const result = orchestrator.setWorking(nodeId);
if (!ok(result)) {
  console.error('Operation failed:', result.$error);
  // Handle error appropriately
}
```

## Migration and Future

### Current Stability
- ✅ **Production Ready**: Core orchestrator and planning system
- ✅ **Well Tested**: Comprehensive test coverage
- ✅ **Documented**: Complete API documentation

### Future Development
- 🔄 **Enhanced Controllers**: Higher-level orchestration APIs
- 🔄 **Advanced Debugging**: Breakpoints and stepping controls
- 🔄 **Performance Optimizations**: Further execution improvements

See [Type Definitions](./docs/types.md) for planned future APIs.

## Related Packages

- [`@breadboard-ai/types`](../../../types/) - Core type definitions
- [`@breadboard-ai/utils`](../../../utils/) - Utility functions and error handling
- [`@breadboard-ai/loader`](../../../loader/) - Graph loading and validation

## Contributing

When contributing to the static execution system:

1. **Maintain determinism** - Execution should be predictable and repeatable
2. **Preserve state consistency** - All state changes should be valid transitions
3. **Add comprehensive tests** - Cover both happy path and error scenarios
4. **Update documentation** - Keep API docs and examples current
5. **Consider performance** - Minimize overhead in hot execution paths