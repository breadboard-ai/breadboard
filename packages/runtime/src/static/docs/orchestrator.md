# Orchestrator API Reference

The `Orchestrator` class is the central component of the Breadboard static execution system. It manages the execution lifecycle of graph nodes through a sophisticated state machine.

## Class Overview

```typescript
class Orchestrator {
  constructor(
    public readonly plan: OrchestrationPlan,
    public readonly callbacks: OrchestratorCallbacks
  )
}
```

## Constructor Parameters

### `plan: OrchestrationPlan`
The execution plan created by `createPlan()` that defines the stages and dependencies for graph execution.

### `callbacks: OrchestratorCallbacks`
Optional callbacks for monitoring orchestration events:

```typescript
type OrchestratorCallbacks = {
  stateChangedbyOrchestrator?: (
    nodeId: NodeIdentifier, 
    state: NodeLifecycleState
  ) => void;
}
```

## Properties

### `progress: OrchestratorProgress`
```typescript
get progress(): OrchestratorProgress
```
Returns the current orchestration progress:
- `"initial"` - Orchestrator is in initial state
- `"working"` - Nodes are being executed
- `"advanced"` - Moved to next stage
- `"finished"` - All stages completed

### `plan: OrchestrationPlan`
Read-only access to the execution plan used by this orchestrator.

## Core Methods

### Lifecycle Management

#### `reset(): Outcome<void>`
Resets the orchestrator to its initial state, clearing all node states and restarting from stage 0.

```typescript
const result = orchestrator.reset();
if (!ok(result)) {
  console.error('Reset failed:', result.$error);
}
```

#### `restartAtStage(stage: number): Outcome<void>`
Restarts execution from a specific stage, preserving inputs from earlier stages.

```typescript
// Restart from stage 2
const result = orchestrator.restartAtStage(2);
if (!ok(result)) {
  console.error('Restart failed:', result.$error);
}
```

#### `restartAtNode(id: NodeIdentifier): Outcome<void>`
Restarts execution from a specific node, maintaining the state of other nodes in the same stage.

```typescript
const result = orchestrator.restartAtNode('my-node-id');
if (!ok(result)) {
  console.error('Node restart failed:', result.$error);
}
```

### Node State Management

#### `setWorking(id: NodeIdentifier): Outcome<void>`
Marks a node as actively working. The node must be in a workable state.

**Workable states:** `ready`, `working`, `waiting`, `succeeded`, `failed`, `interrupted`

```typescript
const result = orchestrator.setWorking('node-id');
if (!ok(result)) {
  // Node might not be ready or might not exist
  console.error('Cannot set working:', result.$error);
}
```

#### `setWaiting(id: NodeIdentifier): Outcome<void>`
Marks a node as waiting for additional input. The node must currently be `working`.

```typescript
// Node is requesting user input or additional data
const result = orchestrator.setWaiting('node-id');
if (!ok(result)) {
  console.error('Cannot set waiting:', result.$error);
}
```

#### `setInterrupted(id: NodeIdentifier): Outcome<void>`
Marks a node as interrupted. The node must be `working` or `waiting`. This will propagate skip states to dependent nodes.

```typescript
const result = orchestrator.setInterrupted('node-id');
if (!ok(result)) {
  console.error('Cannot interrupt:', result.$error);
}
```

### Task Management

#### `currentTasks(): Outcome<Task[]>`
Returns the list of nodes that are ready to be executed in the current stage.

```typescript
const tasks = orchestrator.currentTasks();
if (ok(tasks)) {
  tasks.forEach(task => {
    console.log(`Ready to execute: ${task.node.id}`);
    console.log(`With inputs:`, task.inputs);
  });
} else {
  console.error('Error getting tasks:', tasks.$error);
}
```

#### `taskFromId(id: NodeIdentifier): Outcome<Task>`
Creates a task for a specific node ID, useful for targeted node execution.

```typescript
const task = orchestrator.taskFromId('specific-node');
if (ok(task)) {
  // Execute this specific task
  console.log(`Task for ${task.node.id}:`, task.inputs);
} else {
  console.error('Cannot create task:', task.$error);
}
```

### Output Handling

#### `provideOutputs(id: NodeIdentifier, outputs: OutputValues): Outcome<OrchestratorProgress>`
Submits the results of node execution and updates the orchestration state.

```typescript
const outputs = { 
  result: "processed data",
  metadata: { timestamp: Date.now() }
};

const progress = orchestrator.provideOutputs('node-id', outputs);
if (ok(progress)) {
  console.log('New progress:', progress);
  
  // Check what to do next based on progress
  switch (progress) {
    case 'working':
      // More nodes to execute in current stage
      break;
    case 'advanced':
      // Moved to next stage
      break;
    case 'finished':
      // All done!
      break;
  }
} else {
  console.error('Failed to provide outputs:', progress.$error);
}
```

#### Error Outputs
To signal node failure, include an `$error` property in outputs:

```typescript
const errorOutputs = {
  $error: "Node processing failed: invalid input"
};

const progress = orchestrator.provideOutputs('node-id', errorOutputs);
// This will mark the node as 'failed' and propagate skip to dependents
```

### State Inspection

#### `state(): ReadonlyMap<NodeIdentifier, OrchestrationNodeInfo>`
Returns a read-only view of the current node states for inspection and debugging.

```typescript
const nodeStates = orchestrator.state();
nodeStates.forEach((info, nodeId) => {
  console.log(`${nodeId}: ${info.state}`);
  console.log(`Node type: ${info.node.type}`);
});
```

#### `fullState(): OrchestratorState`
Returns the complete orchestrator state including inputs and outputs for each node.

```typescript
const fullState = orchestrator.fullState();
fullState.forEach((nodeState, nodeId) => {
  console.log(`${nodeId}:`, {
    state: nodeState.state,
    stage: nodeState.stage,
    inputs: nodeState.inputs,
    outputs: nodeState.outputs
  });
});
```

## State Constants

The orchestrator uses several predefined state sets:

```typescript
// States that indicate completion
const TERMINAL_STATES = new Set([
  "succeeded", "failed", "skipped", "interrupted"
]);

// States where nodes are actively processing  
const PROCESSING_STATES = new Set([
  "ready", "working", "waiting"
]);

// States from which a node can become "working"
const WORKABLE_STATES = new Set([
  "succeeded", "failed", "interrupted", 
  "ready", "working", "waiting"
]);
```

## Common Patterns

### Basic Execution Loop

```typescript
function executeGraph(orchestrator: Orchestrator) {
  while (orchestrator.progress !== 'finished') {
    const tasks = orchestrator.currentTasks();
    if (!ok(tasks) || tasks.length === 0) {
      break;
    }
    
    for (const task of tasks) {
      // Mark as working
      orchestrator.setWorking(task.node.id);
      
      // Execute node (your implementation)
      const outputs = await executeNode(task.node, task.inputs);
      
      // Provide results
      const progress = orchestrator.provideOutputs(task.node.id, outputs);
      if (!ok(progress)) {
        console.error('Execution failed:', progress.$error);
        return;
      }
    }
  }
}
```

### Handling Multi-turn Interactions

```typescript
// Node requests additional input
orchestrator.setWaiting('interactive-node');

// Later, when input is available
const additionalInputs = await getUserInput();
orchestrator.setWorking('interactive-node');

// Continue execution with new inputs
const outputs = await continueNodeExecution(additionalInputs);
orchestrator.provideOutputs('interactive-node', outputs);
```

### Error Recovery

```typescript
const result = orchestrator.setWorking('problematic-node');
if (!ok(result)) {
  // Maybe restart the node's stage
  const nodeState = orchestrator.state().get('problematic-node');
  if (nodeState) {
    orchestrator.restartAtStage(nodeState.stage);
  }
}
```

## Signals Integration

The orchestrator uses signals for reactive state management:

```typescript
import { Signal } from 'signal-polyfill';

// The orchestrator automatically triggers signal updates
// when state changes occur, enabling reactive UIs

const orchestrator = new Orchestrator(plan, {
  stateChangedbyOrchestrator: (nodeId, state) => {
    // This callback is triggered by the orchestrator
    // when it changes node states internally
    updateUI(nodeId, state);
  }
});
```

## Error Handling Best Practices

1. **Always check `Outcome` types** using `ok()` function
2. **Handle specific error cases** based on error messages
3. **Use state inspection** to understand why operations fail
4. **Implement graceful degradation** for non-critical failures
5. **Consider restart strategies** for recoverable errors

## Performance Considerations

- State inspection methods create new objects on each call
- Use `currentTasks()` efficiently to avoid unnecessary re-computation
- Consider batching state changes when possible
- Monitor callback performance as they're called frequently during execution