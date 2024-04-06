---
layout: docs.njk
title: Editor API
tags:
  - api
  - wip
---

The Editor API provides a way to edit a graph. It is designed to work in conjunction with the [Inspector API](../inspector) and helps ensure that the graph edits retain their structural integrity.

> [!NOTE]
> The full list of types of Editor API can be found in [/packages/breadboard/src/editor/types.ts](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/src/editor/types.ts)

## Creating an editor

Calling the `edit` method creates an instance of an `EditableGraph`. This method expects a `GraphDescriptor` as its first argument:

```ts
import { edit } from "google-labs/breadboard";

// Returns an instance of `EditableGraph`.
const graph = edit(bgl);
```

The editor contains a few methods that are paired together: there's one method that performs an edit and the second method that tells us whether we can perform this edit. Both methods return the same value: an `EditResult` promise.

The first method usually has a name like `doStuff` and the second one looks like `canDoStuff`.

This pairing enables checking whether an edit would be valid without actually making an edit. The method that performs an edit calls the method to check whether an edit is valid first, so it is not necessary to call them in succession.

For example we can add nodes to the graph using the `addNode` method:

```ts
// Returns `Promise<EditResult>`.
const result = await graph.addNode({ id "foo", type: "bar" });
if (!result.success) {
  console.warn("Adding node failed with this error", result.error);
}
```

And we can use its sidekick `canAddNode` to simply check if adding this node is possible:

```ts
// Returns `Promise<EditResult>`.
const result = await graph.canAddNode({ id: "foo", type: "bar" });
if (result.success) {
  console.log("Yay, we can add this node, proceed forth");
} else {
  console.warn("Can't add this node", result.error);
}
```

## Kits

To ensure that `canDoStuff` methods tell us useful things, we need to supply the editor a list of kits. Kits are collections of functions that are invoked during running the graph. We can provide kits as `kits` property on the second, optional `EditableGraphOptions` argument of the `edit` method:

```ts
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

const graph = edit(bgl, { kits: [asRuntime(Core), asRunTime(JSONKit)] });
```

## Editing a graph

There are five edit operations that we can perform on the graph:

- `addNode` -- adds a new node to the graph (or check if we can do so with `canAddNode`)

- `removeNode` -- remove a node from the graph (with `canRemoveNode` companion)

- `addEdge` -- add an edge to the graph (`canAddEdge` to check if that's possible)

- `removeEdge` -- remove an edge from the graph (`canRemoveEdge` to check only)

- `changeConfiguration` -- change configuration of a node (`canChangeConfiguration` to check only).

- `changeMetadata` -- change metadata (title and description) of a node (`canChangeMetadata` to check only).

## Starting a new graph

If we want to start a brand-new graph, we can use the handy `blank` method, provided by the Editor API:

```ts
import { blank } from "google-labs/breadboard";

// Returns a new `GraphDescriptor` instance
// of a pre-built blank graph.
const myNewGraph = blank();
```

The newly-created graph will have a pre-filled title and description, a version of `0.0.1` and two connected nodes: the `input` node connected to the `output` node with one wire. The wire will go from `text` port to `text` port of the respective nodes.

![Blank graph diagram](/breadboard/static/images/editor-blank.png)

## Editing subgraphs

Since every graph may have **embedded subgraphs** in it, we can use the Editor API to access and edit these subgraphs as well. Every subgraph has an identifier that is unique among all subgraphs within their graph. The API uses this id to add, remove, replace subgraphs and manages the `EditableGraph` instances for subgraphs.

```ts
// Returns an `EditableGraph` instance or `null` if not found.
const subgraph = graph.getGraph("foo");
if (subgraph) {
  // Edit the subgraph
  // ...
}

// Attempts to add a new subgraph and returns `EditResult`.
// Returns null if a subgraph with this id already exists,
// and an `EditableGraph` instance otherwise.
const newSubgraph = graph.addGraph("bar", blank());
if (!newSubgraph) {
  console.log("A graph with id 'bar' already exists.");
}

// Attempts to remove the subgraph and returns `EditResult`.
// Will fail if a subgraph with this id does not exist.
const result = graph.removeGraph("bar");
if (result.success) {
  console.log("Yay, removed subgraph 'bar'.");
} else {
  console.log("The subgraph 'bar' does not exist".)
}

// Attempts to replace a subgraph and returns `EditResult`.
// Returns null if a subgraph with this id does not exist,
// and an `EditableGraph` instance of the new subgraph otherwise.
const replaced = graph.replaceGraph("foo", blank());
if (!replaced) {
  console.log("A graph with id 'foo' does not exist.")
}
```

## Accessing the graph

To access the resulting graph, use the `raw()` method on the `EditableGraph` instance.

```ts
const graph = edit(bgl, { kits });
await graph.addNode({ id: "foo", type: "bar" });
const newBgl = graph.raw();
```

The `raw()` method will correctly serialize all of graph's subgraph and reflect their edits.

## Inspecting the graph

Because the graph constantly changes, it can be tedious to keep track of the latest changes and keep creating new instances of `InspectableGraph`. To help with that, there's an `inspect` method on the `EditableGraph`:

```ts
// Guaranteed to be inspecting the latest graph.
// Returns `InspectableGraph`.
const inspectableGraph = graph.inspect();
```

In term of lifecycle, the `InspectableGraph` changes more frequently than the `EditableGraph`. So, hang on to the `EditableGraph` instance and use it to create `InspectableGraph` instances. It will cache them for you, only creating a new inspector when the graph changes.
