---
layout: docs.liquid
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

The editor API provides one method for applying edits to the graph: `edit`. This method takes three members (two required):

- an array of objects, also called "Editor Specs";

- a string label for the edit;

- an optional `dryRun` boolean.

```ts
// Adds a node with id = "foo" and type = "type".
// Returns `Promise<EditResult>`.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "foo", type: "type" }, graphId: "" }],
  `Create Node "foo"`
);
if (!result.success) {
  console.warn("Adding node failed with this error", result.error);
}
```

The string label plays an important role. It groups the edit operations for the purpose of collecting history. See more about how to use it in the [Graph history management (undo/redo)](#graph-history-management-undoredo) section.

When `dryRun` is set to `true`, the method will not perform the actual edit, but report the result as if the edit as applied. This is useful if we want to check whether an edit would be valid without actually making an edit.

```ts
// Does not actually add node with id = "foo" and type = "type",
// just checks to see if such a node could be added.
// Returns `Promise<EditResult>`.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "foo", type: "type" }, graphId: "" }],
  "Adding Node (dry run)",
  true
);
if (!result.success) {
  console.warn("Adding node will fail with this error", result.error);
} else {
  console.log("Yay, we can add this node, proceed forth");
}
```

Multiple changes to the graph are performed as one atomic unit when specified in the same method:

```ts
// Adds a node with id = "foo" and type = "type" ...
// .. and a node with id = "bar" and type = "type" as one atomic operation.
// Returns `Promise<EditResult>`.
const result = await graph.edit([
  { type: "addnode", node: { id: "foo", type: "type" }, graphId: "" },
  { type: "addnode", node: { id: "bar", type: "type" }, graphId: "" },
]);
if (!result.success) {
  console.warn("Adding node failed with this error", result.error);
}
```

## Kits

To ensure that `edit` method does not jeopardize the integrity of the graph, we need to supply the editor a list of kits. Kits are collections of functions that are invoked during running the graph. We can provide kits as `kits` property on the second, optional `EditableGraphOptions` argument of the `edit` method:

```ts
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

const graph = edit(bgl, { kits: [asRuntime(Core), asRunTime(JSONKit)] });
```

## Editing a graph

Here are all the edit operations that we can perform on the graph:

- `addnode` -- add a new node to the graph

- `remove` -- remove a node from the graph

- `addedge` -- add an edge to the graph

- `removeedge` -- remove an edge from the graph

- `changeedge` -- mutate an existing edge in place, without changing its identity.

- `changeconfiguration` -- change configuration of a node

- `changemetadata` -- change metadata (title, description, etc.) of a node

- `changegraphmetadata` -- change graph metadata.

- `addmodule` -- add a new module to the graph.

- `removemodule` -- remove existing module from the graph.

- `changemodule` -- update an existing modeul within the graph.

- `addgraph` - add a new sub-graph to the graph.

- `removegraph` - remove a sub-graph from this graph.

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

## Graph versioning

To help us keep track of the edits, the `EditableGraph` has a `version()` method, which returns the current version of the graph:

```ts
// Returns a number.
const current = graph.version();
```

By default, a new `EditableGraph` instance starts with version `0` and increments it for each change.

To supply a different starting version, use the `version` option when creating a new `EditableGraph` instance:

```ts
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

// Let's start with version 1000.
const version = 1000;
const graph = edit(bgl, {
  kits: [asRuntime(Core), asRunTime(JSONKit)],
  version,
});
```

## Graph history management (undo/redo)

In addition to simple versioning, the Editor API tracks history of the graph to enable undo/redo capability. The `history()` method on an `EditableGraph` instance provides a few handy helpers for that:

- the `undo()` method undoes the last change. If there's nothing to undo, calling it does nothing.

- the `redo()` method redoes the change that was previously undone, or does nothing if there are no more changes to redo.

- the `canUndo()` method reports whether an undo operation is possible at a given moment. It returns `false` when we're at the beginning of graph edit history, and `true` otherwise.

- the `canRedo()` method returns whether a redo operation is possible, returning `false` when we're at the end of graph edit history and `true` otherwise.

- the `entries()` method returns the list of all entries in the graph edit history.

- the `index()` method returns the index of the current entry in the graph edit history.

```ts
// Returns an `EditHistory` instance.
const history = graph.history();
if (history.canUndo()) {
  history.undo();
}
history.redo();

// Prints out a list of history entries with a ">" marker next
// to the current history entry.
const labels = history.entries().map((entry) => entry.label);
console.group("History:");
labels.forEach((label, index) => {
  const current = index === history.index() ? ">" : " ";
  console.log(`${index}:${current} ${label}`);
});
console.groupEnd();
```

The string label that was supplied for an `edit` operation allows the user of the API to group multiple edit operations into a single history entry.

Each `edit` call that has the same label as the previous `edit` call will be grouped with that previous call: no new history entry will be created for it.

When the `edit` call has a label that's different from the previous call, a new history entry will be created.

```ts
// Creates a new history entry.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "foo", type: "type" }, graphId: "" }],
  `Create Node "foo"`
);
// Different label, creates another history entry.
const result = await graph.edit(
  [
    {
      type: "changemetadata",
      id: "foo",
      metadata: { title: "F" },
      graphId: "",
    },
  ],
  `Editing metadata for node "foo"`
);
// Label is the same as the previous call, no new entry created.
const result = await graph.edit(
  [
    {
      type: "changemetadata",
      id: "foo",
      metadata: { title: "Fo" },
      graphId: "",
    },
  ],
  `Editing metadata for node "foo"`
);
// Label is the same as the previous call, no new entry created.
const result = await graph.edit(
  [
    {
      type: "changemetadata",
      id: "foo",
      metadata: { title: "Foo" },
      graphId: "",
    },
  ],
  `Editing metadata for node "foo"`
);
// Different label, creates another history entry.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "bar", type: "type" }, graphId: "" }],
  `Create Node "bar"`
);
```

## Editing subgraphs

Since every graph may have **embedded subgraphs** in it, we can use the Editor API to access and edit these subgraphs as well. Every subgraph has an identifier that is unique among all subgraphs within their graph. The API uses this id to add, remove, replace subgraphs.

The `graphId` property in the edit operations provides a way to identify
the particular subgraph on which it operates.

The id of the main graph is an empty string: `""`.

## Accessing the graph

To access the underlying `GraphDescriptor` instance, use the `raw()` method on the `EditableGraph` instance.

```ts
const graph = edit(bgl, { kits });
await graph.addNode({ id: "foo", type: "bar" });
// Returns the `GraphDescriptor` instance.
const newBgl = graph.raw();
```

The `raw()` method will correctly serialize all of graph's subgraph and reflect their edits.

## Inspecting the graph

Because the graph constantly changes, it can be tedious to keep track of the latest changes and keep creating new instances of `InspectableGraph`. To help with that, there's an `inspect` method on the `EditableGraph`.

The `inspect` method takes a graph identifier, allow easy access to a
particular sub-graph's `InspectableGraph` instance.

```ts
// Guaranteed to be inspecting the latest graph.
// Returns `InspectableGraph`.
const inspectableGraph = graph.inspect("");
```

## Listening to changes

The `EditableGraph` instance also the `addEventListener` method, which works pretty much like any [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) -- we can subscribe to listen to events that are dispatched by this instance. Currently the following events are supported:

- `graphchange` -- dispatched on every change of a graph or any of the subgraphs. The event object provides these useful properties:

  - `graph`, which contains the updated `GraphDescriptor` instance

  - `version`, which has the version of the updated instance

  - `visualOnly`, which is set to `true` when the changes only affected the `visual` section of node metadata within the graph.

  - `changeType`, which is `edit` when the change occurred due to a call to the `edit` method or `history` when the event was triggered by one of the history-manipulating methods.

- `graphchangereject` -- dispatched when a proposed change is rejected. This may happen because the change is redundant or because the graph integrity would be jeopardized by the change. The event provides access to these properties: `graph`, which is the `GraphDescriptor` instance on which the change was attempted, and `reason`. The `reason` property itself has a `type` property, which can be either `"nochange"` or `"error`". The `"nochange"` indicates that the change was redundant, and `"error"` signals that the proposed changed would have resulted in an invalid graph. In the latter case, the `reason.error` property will contain the same error that would have been returned by the various `can*` methods from above.

## Transforms

Transforms are an abstraction that allows encapsulating a large atomic edit with many moving parts. For instance, if we want to create a new subgraph and move a few existing nodes from the main graph into it, we can structure it as a list of edits and check to make sure that each edit is valid. Or, we can use this transform:

```ts
const moving = await editor.apply(
  new MoveToNewGraphTransform(
    // Move nodes "node-1" and "node-2" along with all of their shared
    // edges...
    ["node-1", "node-2"],
    // .. From main graph ...
    "",
    // ... To a new subgraph with the id "foo" ...
    "foo",
    // .. the title "Title" ...
    "Title",
    // ... and a description "Description".
    "Description"
  )
);
```

Transforms are more flexible than the list of operations (even though
they produce lists of operations as a result), because they allow us
to run code between operations.

Currently, here are the built-in transforms available from `@google-labs/breadboard` package:

- `IsolateSelectionTransform` -- takes a list of nodes and removes any edges that aren't shared by these nodes.

```ts
const isolating = await graph.apply(new IsolateSelectionTransform(
  ["node0"], // list of nodes ids to isolate
  "" // graph id
));
(!result.success) {
  // handle error
}
```

- `MoveToGraphTransform` -- takes a list of nodes, a source and a destination graph ids, and moves the nodes from the source graph to the destination graph.

```ts
const moving = await editor.apply(
  new MoveToGraphTransform(
    ["node10"], // list of node ids to move
    "foo", // source graph id
    "" // destination graph id
  )
);
if (!moving.success) {
  // handle error
}
```

- `MoveToNewGraphTransform` -- same as above, except creating a new graph, with `title` and `description` arguments that set, respectively, the title and the description of the newly created graph (see example above).

- `MergeGraphTransform` -- merges a graph into another graph, moving all the nodes and edges from one graph into another, then deleting the remaining empty graph. Takes the id of the source of the graph and the destination graph id.

```ts
const merging = await editor.apply(
  new MergeGraphTransform(
    "foo", // source graph id
    "" // graph id to merge into
  )
);
if (!merging.success) {
  // handle error
}
```
