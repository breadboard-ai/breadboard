# Harness

Work-in-progress docs on how to use the Breadboard harness. Also a sort of a design doc and a TODO list for the API.

## Overview

The harness is a public API for integrating Breadboard into your application. Breadboard is very flexible and and configuring it can be a bit tricky, so the harness is designed to make it easier to get started -- and keep going.

Conceptually, the harness is a wrapper around a Breadboard runtime and the related remoting machinery, designed to read configuration, then instantiate, and
run this machinery.

The harness does two things:

- it reads a configuration object and creates a Breadboard runtime with all
  the necessary bits (including things like a client for a remote server or a proxy client/server pair)
- it provides a coherent API to interact with the runtime without having to know (or know as little as possible about) the details of the underlying configuration.

## Configuration

## The API

Once the harness is created, you can use its `load` and `run` methods to load and run a board.

The `load` method returns a promise of an object that contains various metadata
about the board which this harness was configured to run.

The `run` method is an [asynchronous generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) that yields the results of running the board. It can be used in a `for await` loop, or you can call `next` on it manually.

### Non-diagnostic results

If the `diagnostics` configuration property is set to `false`, the generator will yield only five types of results:

- `input` -- when the board is asking for input.
- `secret` -- when the board is asking for a secret.
- `output` -- when the board is producing output.
- `error` -- when the running the board produced an error.
- `done` -- when the board is done running.

### Diagnostic results

If the `diagnostics` configuration property is set to `true`, the generator will yield additional these results:

- `graphstart` -- when a new graph is starting to run. This will run at the beginning of the board itself and for each graph that is invoked by the board.
- `nodestart` -- when a node within a graph is about to be invoked as part of the run.
- `nodeend` -- when a node within a graph is done running.
- `graphend` -- when a graph is done running. This will run at the end of the board itself and for each graph that is invoked by the board.

These results are guaranteed to run in order. That is, all `nodestart` and `nodeend` results for a given graph will be enclosed by the `graphstart` and `graphend` results for that graph.

Listening to these events enables you to build a tree of the execution of the board. This can be useful for debugging, logging, and other purposes.

### Invocation path

To help with associating results with each other, each result contains a `path` property that is an array of numbers. This array signifies a stack of invocations: each new entry in the array is the invocation identifier of a node within a graph run.

The board starts with an empty invocation path and then increments the value for each node invocation, and adds/removes the entry as it enters/leaves a sub-graph.

For example, a `nodestart` result with the value of `[0]` means that this is the first node to run within the board, while the value `[3, 1]` indicates that this is the second node to run within a graph that is invoked by the fourth node of the board.

In some cases, the invocation path will contain an entry that is added on top of of the invocation path of a graph. This may be necessary to distinguish multiple graph invocations that are peers of each other.

As a concrete example, when a [map node](https://github.com/breadboard-ai/breadboard/blob/main/packages/core-kit/src/nodes/map.ts) invokes a subgraph for each item in a given list, it needs to distinguish between the invocations of each subgraph. In this case, the invocation path will contain an entry that is the index of the subgraph within the map node's list of subgraph invocations.

Thus, the invocaton path provides a way to uniquely identify each node invocation within the harness' run.

### Stepping through run

Using asynchornous generators enables a fairly straightforward way to step through the run of the board. For example, here is a simple harness that runs a board and prints out the results:

```typescript
for await (const result of harness.run()) {
  console.log(result);
  await delay(ms); // wait between each result.
}
```

We can also use the `next` method to step through the run manually:

```typescript
const iterator = harness.run();
let result = await iterator.next();
while (!result.done) {
  console.log(result.value);
  await delay(ms); // wait between each result.
  result = await iterator.next();
}
```

### Replay

Each result provides a `state` property that contains the state of the board at the time of the result. This state can be used to replay the board from that point on.

For example, here is a simple harness that runs a board and prints out the results, then replays the board from the point of the first `output` result:

```typescript
const iterator = harness.run();
let result = await iterator.next();
while (!result.done) {
  console.log(result.value);
  if (result.value.type === "output") {
    // TODO: This is not yet implement, and not sure if this is the right API.
    const replay = harness.replay(await result.value.state);
    for await (const replayResult of replay) {
      console.log(replayResult);
      await delay(ms); // wait between each result.
    }
  }
  result = await iterator.next();
}
```
