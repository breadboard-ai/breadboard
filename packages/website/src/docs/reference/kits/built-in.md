---
layout: docs.njk
title: Built-in Kit
tags:
  - reference
  - kits
  - wip
---

While most nodes in Breadboard come from various Kits, there are two nodes that are built-in: **input** and **output**. A good way to think about them is as if they are part of the "Built-in Kit": something that you always get, no matter what other kits you choose to employ.

## Why do we need these nodes?

These two nodes serve a very important purpose: they communicate the API (or "shape") of the board. While it is definitely convenient in itself, it becomes super-important when we start composing graphs.

The **input** and **output** represent, respectively, the beginning and the end of work within a board. Every job begins with an intake of some source material and produces a deliverable. The "input" and "output" components signify those moments. The "input" component is the place where the job begins, and the "output" component (or components, depending on the job) is where it ends.

By adding "input" and "output" nodes in our graph, we not only make it easy for ourselves to spot the starting and ending points of the job -- we also make this graph _reusable_. In Breadboard, graphs can be invoked by other graphs, kind of like delegating work. If we already know that there's a team of workers that does a particular job well, we can just call that team and ask it to do the job for us. When we do that, the "input" and "output" nodes of that team will inform us what the team needs to do their job successfully.

> [!NOTE]
> To make this more concrete, here's an example. The **input** and **output** nodes of a board are used to construct the [signature of a function declarations](https://ai.google.dev/gemini-api/docs/function-calling#function_declarations) when we let the [Specialist](https://breadboard-ai.github.io/breadboard/docs/kits/agents/#specialist-tools) invoke boards as tools. From the perspective of the user, it looks entirely magical: they just add a board as a possible tool that the Specialist could call and it gets invoked. Behind the scenes, the Specialist inspects the board, determines the inputs/outputs and supplies it to the LLM as function declarations.

## The `input` node

{{ "/breadboard/static/boards/kits/built-in-input.bgl.json" | board }}

Use this node to specify the inputs for the board. The `input` node has a single fixed input port and a variable number of output port.

### Inputs

The single fixed input port is **Schema**, which allows us to specify the number, names, types, and even sample/default values of the inputs for our board.

> [!NOTE]
> The Visual Editor Schema editor produces [JSON Schema](https://json-schema.org/) for each input. This JSON schema is what is stored in the [BGL](http://localhost:8000/breadboard/docs/concepts/#breadboard-graph-language-bgl) representation of the board.

### Outputs

### Example
