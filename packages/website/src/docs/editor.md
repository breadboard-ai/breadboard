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

The editor API provides one method for applying edits to the graph: `edit`. This method takes three members (two required):

- an array of objects, also called "Editor Specs";

- a string label for the edit;

- an optional `dryRun` boolean.

```ts
// Adds a node with id = "foo" and type = "type".
// Returns `Promise<EditResult>`.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "foo", type: "type" } }],
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
  [{ type: "addnode", node: { id: "foo", type: "type" } }],
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
  { type: "addnode", node: { id: "foo", type: "type" } },
  { type: "addnode", node: { id: "bar", type: "type" } },
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

There are the six edit operations that we can perform on the graph:

- `addnode` -- add a new node to the graph

- `remove` -- remove a node from the graph

- `addedge` -- add an edge to the graph

- `removeedge` -- remove an edge from the graph

- `changeconfiguration` -- change configuration of a node

- `changemetadata` -- change metadata (title, description, etc.) of a node

- `changegraphmetadata` - change graph metadata.

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
  [{ type: "addnode", node: { id: "foo", type: "type" } }],
  `Create Node "foo"`
);
// Different label, creates another history entry.
const result = await graph.edit(
  [{ type: "changemetadata", id: "foo", metadata: { title: "F" } }],
  `Editing metadata for node "foo"`
);
// Label is the same as the previous call, no new entry created.
const result = await graph.edit(
  [{ type: "changemetadata", id: "foo", metadata: { title: "Fo" } }],
  `Editing metadata for node "foo"`
);
// Label is the same as the previous call, no new entry created.
const result = await graph.edit(
  [{ type: "changemetadata", id: "foo", metadata: { title: "Foo" } }],
  `Editing metadata for node "foo"`
);
// Different label, creates another history entry.
const result = await graph.edit(
  [{ type: "addnode", node: { id: "bar", type: "type" } }],
  `Create Node "bar"`
);
```

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

To find out if a particular `EditableGraph` instance is an embedded subgraph, use the `parent()` method:

```ts
// If subgraph, returns `EditableGraph` instance of the parent graph.
const parentGraph = subgraph.parent();
if (parentGraph) {
  console.log("A subgraph!");
} else {
  console.log("Not a subgraph");
}
```

Because they are part of a larger graph, subgraphs do not have their own versions and attempting to call the `version()` method on a subgraph will throw an error.

Subgraphs may not contain other subgraphs, so in the same fashion as `version()`, the `getGraph`, `addGraph`, `replaceGraph`, and `removeGraph` will throw
when called on a subgraph.

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

Because the graph constantly changes, it can be tedious to keep track of the latest changes and keep creating new instances of `InspectableGraph`. To help with that, there's an `inspect` method on the `EditableGraph`:

```ts
// Guaranteed to be inspecting the latest graph.
// Returns `InspectableGraph`.
const inspectableGraph = graph.inspect();
```

In term of lifecycle, the `InspectableGraph` changes more frequently than the `EditableGraph`. So, hang on to the `EditableGraph` instance and use it to create `InspectableGraph` instances. It will cache them for you, only creating a new inspector when the graph changes.

## Listening to changes

The `EditableGraph` instance also the `addEventListener` method, which works pretty much like any [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) -- we can subscribe to listen to events that are dispatched by this instance. Currently the following events are supported:

- `graphchange` -- dispatched on every change of a graph or any of the subgraphs. The event object provides these useful properties:

  - `graph`, which contains the updated `GraphDescriptor` instance

  - `version`, which has the version of the updated instance

  - `visualOnly`, which is set to `true` when the changes only affected the `visual` section of node metadata within the graph.

  - `changeType`, which is `edit` when the change occurred due to a call to the `edit` method or `history` when the event was triggered by one of the history-manipulating methods.

- `graphchangereject` -- dispatched when a proposed change is rejected. This may happen because the change is redundant or because the graph integrity would be jeopardized by the change. The event provides access to these properties: `graph`, which is the `GraphDescriptor` instance on which the change was attempted, and `reason`. The `reason` property itself has a `type` property, which can be either `"nochange"` or `"error`". The `"nochange"` indicates that the change was redundant, and `"error"` signals that the proposed changed would have resulted in an invalid graph. In the latter case, the `reason.error` property will contain the same error that would have been returned by the various `can*` methods from above.
