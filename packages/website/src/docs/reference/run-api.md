---
layout: docs.liquid
title: Run API
tags:
  - reference
  - api
  - wip
---

The Run API provides a way to run and observe the running of a graph. It is designed to work in conjunction with the [Run Inspector API](/breadboard/docs/inspector/run/) to provide a comprehensive way to run and inspect graphs.

> [!NOTE]
> The full list of types for the Runner API can be found in [/packages/breadboard/src/runner/types.ts](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/src/run/types.ts)

## Creating a runner

To create a runner, you typically use a factory function provided by the specific implementation. The runner implements the `HarnessRunner` interface:

```typescript
import { createRunner, type RunConfig } from "@google-labs/breadboard/harness";

const config: RunConfig = {
  // ... Specify configuration
};

// Returns an instance of `HarnessRunner`.
const runner = createRunner(config);
```

## Runner events

The runner is an `EventTarget` that dispatches various events during the execution of a graph. You can listen to these events using the `addEventListener` method:

```typescript
runner.addEventListener("nodestart", (event) => {
  console.log("Node started:", event.data);
});
```

The following events are available:

- `start`: Dispatched when the runner starts.
- `pause`: Dispatched when the runner pauses, waiting for inputs or secrets.
- `resume`: Dispatched when the runner resumes after pausing.
- `input`: Dispatched when the runner encounters an `input` component.
- `output`: Dispatched when the runner encounters an `output` component.
- `secret`: Dispatched when the runner encounters a `secrets` component.
- `error`: Dispatched when an error occurs during the run.
- `skip`: Dispatched when a node is skipped.
- `graphstart`: Dispatched when a subgraph starts.
- `graphend`: Dispatched when a subgraph ends.
- `nodestart`: Dispatched when a node starts.
- `nodeend`: Dispatched when a node ends.
- `end`: Dispatched when the runner finishes running.

Each event provides specific data relevant to that event type. For example, the `nodestart` event provides data of type `NodeStartResponse`.

> [!NOTE]
> See [/packages/breadboard/src/types.ts](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/src/types.ts) for a comprehensive list of the returned data types.

## Running a graph

To start or resume running a graph, use the `run` method:

```typescript
// Returns a Promise<boolean>.
const isDone = await runner.run({ someInput: "value" });
if (isDone) {
  console.log("Graph execution completed");
} else {
  console.log("Graph is waiting for more input or secrets");
}
```

The `run` method accepts an optional `InputValues` object to provide input values. This argument is used to provide inputs to the graph. When the graph pauses waiting for inputs, the argument will be used as the inputs. When the graph pauses waiting for secrets, the argument will be used as values for secrets.

The `run` method returns a Promise that resolves to a boolean indicating whether the execution is complete (`true`) or waiting for more input (`false`).

## Run lifecycle

There are four events that signal various stages of run lifecycle: `start`, `pause`, `resume`, `end`.

The `start` event is only dispatched once at the start of running the graph, before any other event.

The `pause` event is dispatched whenever the the runner pauses, waiting for inputs or secrets. This event is useful to detect whenever the runner stops and needs attention.

The `resume` event is dispatched whenever the graph run is resumed (which happens when the `run` method is called) after pausing.

The `end` event is dispatched at the ene of graph run, after all other events have been dispatched.

## Graph lifecycle

The are four events that signal various stages of lifecycle: `graphstart`, `graphend`, `nodestart`, `nodeend`.

The `graphstart` event is dispatched just before a new graph is being run. A run may include many graphs, invoked with the [`invoke`](/breadboard/docs/kits/core/#the-invoke-component), [`map`](/breadboard/docs/kits/core/#the-map-component), [`reduce`](/breadboard/docs/kits/core/#the-reduce-component) components (or any other components that invoke graphs).

The `nodestart` event is dispatched just before a component is being invoked.

The `nodeend` event is dispatched just after the component was invoked.

The `graphend` event is dispatched right after the graph run completed.

## Error handling

Errors during execution are emitted as `error` events. You can listen for these events to handle errors:

```typescript
runner.addEventListener("error", (event) => {
  console.error("An error occurred:", event.data);
});
```

The `data` property of the error event contains detailed information about the error that occurred.

## Checking runner state

You can check the current state of the runner using these methods:

```typescript
// Returns a boolean.
const isRunning = runner.running();

// Returns string[] | null.
const requiredSecrets = runner.secretKeys();

// Returns Schema | null.
const inputRequirements = runner.inputSchema();
```

- `running()`: Returns `true` if the runner is currently executing, `false` otherwise.
- `secretKeys()`: Returns an array of secret keys the runner is waiting for, or `null` if no secrets are required.
- `inputSchema()`: Returns the schema for required inputs, or `null` if no input is currently required.

## Adding observers

In addition to events, you can add instances of `InspectableRunObserver` to the runner. When added, these observers will notified of all changes to the graph:

```typescript
import type { InspectableRunObserver } from "google-labs/breadboard";

const myObserver: InspectableRunObserver = {
  // Implement observer methods
};

runner.addObserver(myObserver);
```

## An example

Let's walk through a more comprehensive example of using the Run API to run a graph that processes text, requires user input, and handles secrets.

```typescript
import { createRunner } from "@google-labs/breadboard/harness";
import type { Schema } from "@google-labs/breadboard";

// Assume we have a graph that takes text input, processes it,
// and returns a summary.
const config: RunConfig = {
  url: "https://example.com/boards/text-summarizer.bgl.json",
  kits: [
    /* specify kits */
  ],
  // ... more config
};

// Create the runner
const runner = createRunner(config);

// Function to handle user input
async function getUserInput(schema: Schema): Promise<void> {
  // In a real application, this might involve prompting the user through a UI
  console.log("Input required:", schema);
  const input = {
    text: "This is a long piece of text that needs summarizing.",
  };
  await runner.run(input);
}

// Function to handle secret requests
async function getSecret(key: string): Promise<void> {
  // In a real application, this might involve secure storage or user prompts
  console.log("Secret required:", key);
  const secret = "your-api-key-here";
  await runner.run({ [key]: secret });
}

// Set up event listeners
runner.addEventListener("start", (event) => {
  console.log("Runner started:", event.data.timestamp);
});

runner.addEventListener("input", async (event) => {
  if (event.data.inputArguments.schema) {
    await getUserInput(event.data.inputArguments.schema);
  }
});

runner.addEventListener("secret", async (event) => {
  // In real application, there may be more than one secret requested at a
  // time.
  await getSecret(event.data.keys[0]);
});

runner.addEventListener("output", (event) => {
  console.log("Output received:", event.data);
});

runner.addEventListener("nodestart", (event) => {
  console.log("Node started:", event.data.node.id);
});

runner.addEventListener("nodeend", (event) => {
  console.log("Node ended:", event.data.node.id);
});

runner.addEventListener("error", (event) => {
  console.error("An error occurred:", event.data);
});

runner.addEventListener("end", (event) => {
  console.log("Runner finished:", event.data);
});

// Start the runner
runner.run();
```
