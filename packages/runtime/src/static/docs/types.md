# Type Definitions Documentation

The `types.ts` file contains TypeScript type definitions for orchestration controllers and breakpoint management. These types represent the future direction of the runtime system's API design.

⚠️ **Note**: These types are currently work-in-progress and represent a draft of the next-generation runtime API.

## OrchestrationController

The `OrchestrationController` type defines a high-level interface for managing graph execution with advanced control features.

```typescript
export type OrchestrationController = {
  run(): Promise<Outcome<void>>;
  continue(): Promise<Outcome<void>>;
  stepThroughNode(): Promise<Outcome<void>>;
  stepThroughStage(): Promise<Outcome<void>>;
  breakpoints: BreakpointsController;
};
```

### Methods

#### `run(): Promise<Outcome<void>>`
Runs the graph from start to finish or until the next breakpoint. Always restarts, resetting current state.

**Usage Pattern:**
```typescript
const controller: OrchestrationController = createController(graph);
const result = await controller.run();
if (!ok(result)) {
  console.error('Execution failed:', result.$error);
}
```

#### `continue(): Promise<Outcome<void>>`
Continues execution from the current state until completion or the next breakpoint.

**Usage Pattern:**
```typescript
// After hitting a breakpoint or pausing
const result = await controller.continue();
```

#### `stepThroughNode(): Promise<Outcome<void>>`
Executes only the next "ready" node in the orchestration. Provides fine-grained control for debugging and inspection.

**Usage Pattern:**
```typescript
// Step through execution one node at a time
while (hasMoreWork) {
  const result = await controller.stepThroughNode();
  if (!ok(result)) break;
  
  // Inspect state after each node
  console.log('Node completed, current state:', getState());
}
```

#### `stepThroughStage(): Promise<Outcome<void>>`
Executes all nodes in the current stage before pausing. Useful for stage-by-stage debugging.

**Usage Pattern:**
```typescript
// Execute one stage at a time
while (hasMoreStages) {
  const result = await controller.stepThroughStage();
  if (!ok(result)) break;
  
  console.log('Stage completed');
}
```

## BreakpointsController

The `BreakpointsController` provides advanced debugging capabilities through breakpoint management.

```typescript
export type BreakpointsController = {
  readonly breakpoints: ReadonlyMap<NodeIdentifier, Breakpoint>;
  create(node: NodeIdentifier): void;
  delete(node: NodeIdentifier): void;
  clear(): void;
};
```

### Properties

#### `breakpoints: ReadonlyMap<NodeIdentifier, Breakpoint>`
Read-only access to all current breakpoints, indexed by node ID.

**Usage Pattern:**
```typescript
const controller: OrchestrationController = createController(graph);

// List all breakpoints
controller.breakpoints.breakpoints.forEach((breakpoint, nodeId) => {
  console.log(`Breakpoint at ${nodeId}: ${breakpoint.enabled ? 'enabled' : 'disabled'}`);
});
```

### Methods

#### `create(node: NodeIdentifier): void`
Creates a breakpoint at the specified node. Can be called multiple times on the same node.

**Usage Pattern:**
```typescript
// Set breakpoints for debugging
controller.breakpoints.create('data-processor');
controller.breakpoints.create('validation-step');
controller.breakpoints.create('output-formatter');
```

#### `delete(node: NodeIdentifier): void`
Removes a breakpoint from the specified node. Safe to call multiple times.

**Usage Pattern:**
```typescript
// Remove specific breakpoint
controller.breakpoints.delete('data-processor');
```

#### `clear(): void`
Removes all breakpoints from the controller.

**Usage Pattern:**
```typescript
// Clear all breakpoints for production run
controller.breakpoints.clear();
```

## Breakpoint

Individual breakpoint objects provide control over their enabled state.

```typescript
export type Breakpoint = {
  readonly id: NodeIdentifier;
  disable(): void;
  enable(): void;
};
```

### Properties

#### `id: NodeIdentifier`
The node identifier where this breakpoint is set.

### Methods

#### `disable(): void`
Temporarily disables the breakpoint without removing it.

#### `enable(): void`
Re-enables a previously disabled breakpoint.

**Usage Pattern:**
```typescript
const breakpoint = controller.breakpoints.breakpoints.get('my-node');
if (breakpoint) {
  // Temporarily disable
  breakpoint.disable();
  
  // Run some operations
  await controller.continue();
  
  // Re-enable for future runs
  breakpoint.enable();
}
```

## Future API Design

These types represent the planned evolution of the runtime system towards a more user-friendly API that builds on top of the current `Orchestrator` class.

### Design Goals

1. **Simplified Interface**: Hide complex state management behind intuitive methods
2. **Debugging Support**: Built-in breakpoint and stepping capabilities
3. **Async/Await**: Promise-based API for modern JavaScript patterns
4. **Error Handling**: Consistent `Outcome<T>` pattern throughout

### Implementation Strategy

The future implementation would likely wrap the current `Orchestrator` class:

```typescript
class OrchestrationControllerImpl implements OrchestrationController {
  private orchestrator: Orchestrator;
  private nodeInvoker: NodeInvoker;
  public readonly breakpoints: BreakpointsController;
  
  constructor(graph: GraphDescriptor) {
    const plan = createPlan(graph);
    this.orchestrator = new Orchestrator(plan, {
      stateChangedbyOrchestrator: this.onStateChange.bind(this)
    });
    this.breakpoints = new BreakpointsControllerImpl();
  }
  
  async run(): Promise<Outcome<void>> {
    this.orchestrator.reset();
    return this.executeUntilComplete();
  }
  
  async continue(): Promise<Outcome<void>> {
    return this.executeUntilComplete();
  }
  
  // ... other methods
}
```

## Migration Path

The current `Orchestrator` API will continue to be supported, with the new `OrchestrationController` API providing a higher-level interface:

```typescript
// Current API (still supported)
const plan = createPlan(graph);
const orchestrator = new Orchestrator(plan, callbacks);
const tasks = orchestrator.currentTasks();
// ... manual execution loop

// Future API
const controller = createOrchestrationController(graph);
await controller.run();
```

## Integration Points

### With Current Orchestrator

The types are designed to work seamlessly with the existing orchestrator:

```typescript
// The controller would internally use the orchestrator
class ControllerImpl {
  private orchestrator: Orchestrator;
  
  async stepThroughNode(): Promise<Outcome<void>> {
    const tasks = this.orchestrator.currentTasks();
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { $error: 'No tasks available' };
    }
    
    // Execute one task
    const task = tasks[0];
    const result = await this.executeTask(task);
    return result;
  }
}
```

### With Node Invokers

The controller would integrate with node execution systems:

```typescript
class ControllerImpl {
  constructor(
    graph: GraphDescriptor,
    private nodeInvoker: NodeInvoker
  ) {
    // ...
  }
  
  private async executeTask(task: Task): Promise<Outcome<void>> {
    try {
      this.orchestrator.setWorking(task.node.id);
      const outputs = await this.nodeInvoker.invoke(task.node, task.inputs);
      const progress = this.orchestrator.provideOutputs(task.node.id, outputs);
      return ok(undefined);
    } catch (error) {
      return err(error.message);
    }
  }
}
```

## Breakpoint Implementation

Breakpoints would be implemented as execution interceptors:

```typescript
class BreakpointsControllerImpl implements BreakpointsController {
  private _breakpoints = new Map<NodeIdentifier, BreakpointImpl>();
  
  get breakpoints(): ReadonlyMap<NodeIdentifier, Breakpoint> {
    return this._breakpoints;
  }
  
  create(node: NodeIdentifier): void {
    if (!this._breakpoints.has(node)) {
      this._breakpoints.set(node, new BreakpointImpl(node));
    }
  }
  
  shouldBreak(nodeId: NodeIdentifier): boolean {
    const breakpoint = this._breakpoints.get(nodeId);
    return breakpoint?.enabled ?? false;
  }
}

class BreakpointImpl implements Breakpoint {
  private _enabled = true;
  
  constructor(public readonly id: NodeIdentifier) {}
  
  disable(): void { this._enabled = false; }
  enable(): void { this._enabled = true; }
  get enabled(): boolean { return this._enabled; }
}
```

## Development Status

These types are currently:

- ✅ **Defined**: Type definitions are complete
- 🔄 **In Development**: Implementation is planned
- ❌ **Not Implemented**: No runtime implementation yet
- 📋 **Planned**: Part of the next-generation runtime roadmap

## Usage Recommendations

For current development:

1. **Use the existing `Orchestrator` class** for production code
2. **Reference these types** for API design inspiration
3. **Plan for migration** to the new API when available
4. **Provide feedback** on the proposed API design

For future development:

1. **Design against these interfaces** where possible
2. **Keep code modular** to ease future migration
3. **Use similar patterns** in current implementations