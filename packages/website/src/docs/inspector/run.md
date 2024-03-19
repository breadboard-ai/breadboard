---
layout: docs.njk
title: Run Inspector API
tags:
  - api
  - wip
---

A close cousin of the [Graph Inspector API](../graph/), the Run Inspector allows us to examine and make sense of the outputs of running a board.

> [!NOTE]
> The full list of types of Editor API can be found in [/packages/breadboard/src/inspector/types.ts](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/src/inspector/types.ts)

Conceptually, the Run Inspector API observes a board run: we have to let it look at all results that a board returns. In return, the Run Inspector creates data structure that we can then inspect.

## Observing the runs

To start using the Run Inspector API, we need to import the `createRunObserver` and call it:

```ts
import { createRunObserver } from "@google-labs/breadboard";

// Returns an instance of `InspectableRunObserver`.
const observer = createRunObserver();
```

The resulting instance has two methods: `observe()` and `runs()`.

The `observe()` is the one that enables the Run Inspector API to observe the run of a board, while the `runs()` method returns the state of the current runs:

```ts
import { run } from "@google-labs/breadboard/harness";

const config = {
  url: "board url goes here",
  kits: [
    /* list of kits goes here */
  ],
  diagnostics: true, // Must be set to "true" for observer to function.
};

// Returns [].
console.log(observer.runs());

for await (const result of run(config)) {
  // Observe the run
  observer.observe(result);
  // ... handle results
}

// Returns array of `InspectableRun` instances.
console.log(observer.runs());
```

For convenience, the `observe()` method also returns the same value as the `runs()`, which can be useful when using [Lit](https://lit.dev/) or any other reactive UI framework. The return value is live.

> [!NOTE]
> All values that are returned by the `InspectableRunObserver` are _"live"_, in that they continue to change their identity as the board run is observed. From here on, when we call a value "live", we mean that its identity changes when it is mutated.

```ts
for await (const result of run(config)) {
  // Observe the run, and also update the state of the UI element.
  this.runs = observer.observe(result);
  // ... handle results
}
```

The list of runs will update for every new `run(config)` loop. For example:

```ts
// Returns [].
console.log(observer.runs());

for await (const result of run(config)) {
  // Observe the run
  observer.observe(result);
  // ... handle results
}

// Returns array consisting of one `InspectableRun` instance.
// [ InspectableRun ]
console.log(observer.runs());

for await (const result of run(config)) {
  // Observe the run
  observer.observe(result);
  // ... handle results
}

// Returns array consisting of two `InspectableRun` instances.
// [ InspectableRun, InspectableRun ]
console.log(observer.runs());
```

## Inspecting a run

Each `InspectableRun` instance represents a potentially entire tree of board runs, depending on the complexity of the board run we are observing.

An `InspectableRun` instance offers three useful properties: `start`, `end`, and `events`.

The `start` is the timestamp that marks the start of the run, while the `end` is the timestamp that marks the end of the run. When the run is not yet complete, its value will be `null`.

> [!TIP]
> Checking `end` for null is a good way to see whether or not the board run is still ongoing.

```ts
const run = observer.runs()[0];

// Returns a number (timestamp).
console.log("Run started at", run.start);

// Returns a number (timestamp) or null.
if (run.end === null) {
  console.log("Run is ongoing");
} else {
  console.log("Run finished at", run.end);
}
```

The `events` property returns the list of events that have occurred (and/or are still occurring) within this board during a run.

```ts
// Returns a live `InspectableRunEvent[]` list.
const events = run.events;
for (const event of events) {
  console.log("Event", event);
}
```

## Inspecting run events

An `InspectableRunEvent` instance is polymorphic: it can be one of three different types, representing:

- **a node invocation event**, which signifies a node being invoked within the board. This is the event we'll see most commonly. It is represented by the `InspectableRunNodeEvent` type.

- **a secret request event**, which pops up when the board is asking for a secret. This event is represented by the `InspectableRunSecretEvent` type.

- **an error event**, which indicates that an irrecoverable error has occurred during a board run and the board run came to a halt. The type `InspectableRunErrorEvent` represents this event.

To determine the type of the `InspectableRunEvent`, use its `type` property:

```ts
// Can be "node", "secret", or "error".
switch (event.type) {
  case "node": {
    console.log("It's a node!", event);
    break;
  }
  case "secret": {
    console.log("It's a secret!", event);
    break;
  }
  case "error": {
    console.error("It's an error", event);
    break;
  }
}
```

### Inspecting a node invocation event

When the event is an `InspectableRunNodeEvent` instance, we can inspect the various details of the node invocation:

```ts
// Returns a `NodeDescriptor` of the node.
console.log("Node", event.node);

// Returns the timestamp of the node invocation start time.
console.log("Invoked on", event.start);

// Returns an `InputValues` instance containing
// the inputs that were provided to the node.
console.log("With inputs", event.inputs);
```

Just like with `InspectableRun`, an `InspectableRunNodeEvent` will have an `end` timestamp that is only populated when the invocation of the node has concluded. The `outputs` property will have the same behavior: the outputs of a node become available after it is invoked.

```ts
// Returns a number (timestamp) or null
if (event.end === null) {
  console.log("Node is still being invoked");
} else {
  console.log("Node finished at", event.end);
  // Returns an `OutputValues` instance
  // containing the outputs that the node produced.
  // Is `null` until after the node invocation is finished.
  console.log("Node produced outputs", event.outputs);
}
```

#### Sub-graphs, their runs and events

Some nodes (such as [`core.invoke`](../../kits/core/#invoke)) will run more graphs when they are invoked. To facilitate more thorough inspection of such nodes, an `InspectableRunNodeEvent` has a `runs` property. This property returns a list of runs for that were caused by invoking the node.

```ts
// Returns a "live" array of `InspectableRun`.
const subgraphRuns = event.runs;
for (const subgraphRun of subgraphRuns) {
  console.log("Node ran subgraph", subgraphRun);
}
```

The returned instances of `InspectableRun` are live and have the same shape as the ones described above. This enables us to inspect the tree of all subgraphs and events behind each node.

> [!TIP]
> The [`core.invoke`](../../kits/core/#invoke) node runs only one graph, so the `runs` property for this node will only ever contain one item. However, some nodes may run multiple graphs, and even in parallel (like [`core.map`](../../kits/core/#map)). The `runs` property will accurately reflect that.

#### Bubbling inputs and outputs

The last trick up the sleeve of the `InspectableRunNodeEvent` is the `bubbled` property. The `bubbled` property indicates that the node we are seeing in the list of events actually comes from a subgraph (see [input bubbling](../../io/#input-bubbling) for a discussion on why and how that happens).

This property is only populated for the input and output nodes and only for the top-level graph -- that is, the graph that the `InspectableRunObserver` [directly observing](#observing-the-runs). Otherwise, it will be false.

```ts
// Returns `true` if this node is:
// a) input or output
// b) we are at a top-level graph
// c) the input or output were bubbled up from a subgraph.
console.log("Bubbled", event.bubbled);
```

We can use this value to give the inputs and outputs appropriate UI treatment, if we'd like.

### Inspecting a secret request event

When an `InspectableRunEvent` is an `InspectableRunSecretEvent`, it will have three useful properties: the `start` and `end` timestamps that work the same way as the ones in the node invocation event, and the `keys` property that contains the list of keys that are being requested.

```ts
// Returns an array of `string`.
console.log("Secrets requested", event.keys);

console.log("Secrets requested on", event.start);

if (event.end === null) {
  console.log("Waiting for secrets ...");
} else {
  console.log("Secrets provided on", event.end);
}
```

### Inspecting an error event

The final member of the polymorphic trio is the `InspectableRunErrorEvent`. This event indicates that running the board resulted in an unrecoverable error.

This event is always going to be the last event in the run and contain the error information, alongside the `start` timestamp. There is no `end` timestamp for this event.

```ts
console.log("Error", event.error);
console.log("Occurred on", event.start);
```
