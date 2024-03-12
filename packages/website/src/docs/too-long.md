---
layout: docs.njk
title: Long-winded writing out of all Breadboard
tags:
  - general
  - wip
---

There are three pillars that guide the overall technical architecture of Breadboard:

1. **Graph-based composition system** -- Breadboard relies on a graph-based composition system to unlock full flexibility and power of expression within a board.

2. **Hourglass architecture** -- Breadboard employs the shared format for expressing the semantics of board, connecting producers and consumers of this format.

3. **Portability through late binding** -- Breadboard separates AI pattern composition from behaviors of individual pieces that comprise it.

Let's go over these one at a time and see how they fit together.

## Graph-based composition system

For any framework (or for that matter, any technology), a composition system dictates how the smaller parts fit to produce larger parts. [Legos](https://www.lego.com/) are the most obvious example of a composition system. The studs fit into the anti-studs, and consistency of their spacing and size enable infinite possibilities of combining them into both simple models and frankly astonishing displays.

HTML and Document Object Model (DOM) are another example of a composition system: we combine HTML tags to create Web pages. Any spoken language has a composition system, too! Combining letters into words and words into sentences is what gives us the power to express ourselves, and teach large language models to do the most wonderful things.

Composition systems also define the flexibility and the power of the framework. Most frameworks adopt composition systems that use trees or directed acyclic graphs (DAGs). Trees and DAGs are great, but their inability to display feedback loops seemed like an important gap in capabilities.

This is why Breadboard embraces directed graphs with cycles (DGC) as the basis of its composition. Unlike DOM, there is no notion of a parent in Breadboard: a node can have multiple edges directed toward it and have multiple edges coming out of it.

This adds quite a bit of power and complexity. Cycles make traversal non-deterministic, and throw many DAG topology tools out of the window. We believe that this trade-off is worth it, since it unlocks more powerful experiences. In this way, Breadboard is closer to a compiler of a programming language than a graph-traversal machine.

## Hourglass architecture

Breadboard is designed with the hourglass architecture in mind: lots of producers at the top layers, single protocol in the middle (the waist), and lots of consumers at the bottom layers.

![Breadboard Hourglass](../../static/images/hourglass.png)

The items in top layers are called the "frontends", to borrow from [compiler lingo](https://en.wikipedia.org/wiki/Compiler#Front_end). The waist is represented by the common format that connects top and bottom layers. Items in the bottom layers are called the "backends".

### The frontends

Because they all output to the same common format, there can be a great variety of frontends. For example, developers currently can write AI patterns in [TypeScript/JavaScript](../happy-path/) and [Python](../python/). There's work underway on a designer tool that allows creating boards visually.

Nothing stops someone from building a Go or Kotlin or any other kind of frontend. As long as it generates the common format as its output, it can be part of the Breadboard hourglass stack.

### The common format

At the waist of the hourglass, there's a common format used to represent any AI pattern. It's called BGL (which stands for Breadboard Graph Language) and is a JSON object whose structure is defined by the [GraphDescriptor](https://github.com/breadboard-ai/breadboard/blob/30b4429ab18ad6bbc7f174326b60b61decd396bb/packages/schema/src/graph.ts#L201) type.

Very loosely, a BGL file contains the metadata for the board (title, description, etc.), a list of nodes that make up the board, and a list of edges that connect the nodes together.

### The backends

The backends are typically runtimes: they take the board, expressed in the common format and run it. At this moment, there’s a Javascript runtime that runs in both Node and Web environments.

Runtimes aren’t the only kinds of backends. For instance, there is currently an [inspector](../inspector/) backend, designed to help with introspecting a board for editing or linting.

Other future backends may include runtime analysis and intergity backends to help make judgments about a board's integrity, runtime characteristics, or other kinds of properties.

### Mixing and matching

Because the backends and frontends are separated from each other by the common protocol, they can be mixed and matched in Breadboard. For example, one can write a board in Python and debug it in the browser with JavaScript runtime. Or write a board in JavaScript and run it in a C++ runtime. The possibilities are only limited by the number of combinations of frontends and backends.

### The hourglass principle

Sometimes, it can be difficult to separate out the frontend and the backend. For example, imagine a visual designer that allows you to edit, debug, and run the graph. Where do frontends begin and end there?

Or as another example, we could easily just stitch nodes together and run them in JavaScript, without ever having to serialize the logic into the common format. In this case, the backend and the frontend become impossible to separate.

Sometimes this is the right solution, but to ensure that the hourglass model retains its power of flexibility, we should apply the "**hourglass principle**":

> _Prefer and encourage separation of the backend and the frontend in both UX and developer experience. Ideally, frontends only produce the common format, and backends only consume it_.

## Portability through late binding

To make it possible to build and run Breadboard in as many environments as possible, the actual behavior of the nodes, connected into a graph, is not included in the BGL file. Instead, the file only contains type information for each node.

The actual binding of the type to a behavior is the responsibility of a Breadboard backend (or a frontend).

### Node Handlers

When a backend or a frontend consumes a BGL file, it also needs a set of _handlers_: functions that are called for each node type. If a handler is not available within the runtime, the BGL traversal will fail.

For the backend, the handlers correspond to the actual behavior of the node. For instance, a handler for `validateJson` node is a function that performs JSON validation.

For the frontends, the handlers could be design-time helpers, helping render the node in a visual editor and/or provide infomration on how to validate or lint a graph that contains the node of the respective type.

### Kits

The node handlers are organized in kits. Breadboard Kits are collections of node handlers, designed for easy consumption by a backend of a frontend.

Kits are the unit of behavior composition: whether building a board or running it, we need to supply kits that are used to determine what types of nodes we can place on the board and/or run as part of it.

Currently, there are several kits that are bundled with Breadboard:

- [Core Kit](../kits/core/) -- provides the most fundamental building blocks for Breadboard that enable composition and low-level functionality.

- [JSON Kit](../kits/json/) -- provides node handlers for working with JSON.

- [Template Kit](../kits/template/) -- provides a couple of simple templating systems.

- [Agent Kit](../kits/agents/) -- contains handlers to quickly organize LLM-based workers (or just "workers") to perform semi-autonomous asynchronous tasks.

The exact architecture of kits is still in active development, but the current kits are designed to packages handlers for both backend and frontends, and some minimal facilities for namespacing.

### Light and heavy kits

The current thinking on Kits is that they can be light or heavy.

- **Heavy kits** contain node handlers that are made with the typical imperative code of the environment, like TypeScript or Python. A heavy kit is a good choice when there are external dependencies that need to be brought in as part of the kit. In the example of the `validateJson` handler above, a proper JSON validator might be such an external dependencies.

- **Light kits** contain node handlers that are thin wrappers around boards. In other words, each node handler is just a board that is invoked (or inspected) wheneve the backend (or frontend) interacts with it. As the name implies, light kits are much more lightweight to build and eventually would even be buildable with a Breadboard visual editor.

The Core, JSON, and Template Kits are examples of the heavy kits, and the Agent Kit is a light kit.

Our intuition is that there will be a lot more light kits than heavy kits in the Breadboard ecosystem as it grows. The heavy kits will bring in the necessary building blocks of external dependencies, and light kits will act as a way for people to organize their boards and share them with others.

### Kit interoperability

Late binding means that the same node type may have multiple implementations for different backend/frontend enviornment.

While this approach provides portability, it also incurs a cost of interoperability. We are cognizant of this cost and, as new backends/frontends appear, want to develop automated ways (interop tests, etc.) to keep it low.

Light kits are typically more portable than heavy kits, since they are just boards. Of course, the actual portability depends on the transitive set of all node handlers these boards rely on to provide the light kit functionality.

At this moment, there are only kits implemented for the TypeScript (Node + Web) environment.

### Distributed computing

The late binding also enables [actor model](https://en.wikipedia.org/wiki/Actor_model)-inspired setups, where the runtimes can choose where to run individual nodes and distribute graphs across multiple environments.

Currently, the TypeScript runtime supports node proxy servers, where a runtime can be configured to run sets of nodes from a remote server.
