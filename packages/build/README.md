# @breadboard-ai/build

[![Published on npm](https://img.shields.io/npm/v/@breadboard-ai/build.svg?logo=npm)](https://www.npmjs.com/package/@breadboard-ai/build)

A JavaScript library for defining new node types for the Breadboard AI
prototyping library.

## Install

```sh
npm i @breadboard-ai/build
```

## Defining nodes

Use the `defineNodeType` function to define a new Breadboard node type.

## Example

```ts
import { defineNodeType } from "@breadboard-ai/build";

export const reverseString = defineNodeType({
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});
```

### `inputs` and `outputs`

The `inputs` and `outputs` properties specify the input and output ports of the
node, as a map from port name to a port configuration. Port configurations have
the following fields:

- `type`: (Required) A Breadboard type expression. All values sent or received on this port
  must conform to this type.

- `description`: (Recommended) A brief description of the port, which will be displayed in the
  Breadboard visual editor and in other places where introspection/debugging is
  performed.

- `primary`: (Optional) Enables a syntactic sugar feature for an output port to
  make wiring nodes more concise. When a node has a `primary` output port, then
  it becomes possible to use the node itself in API positions where an output
  port is expected, with the node's `primary` port being automatically selected
  as the default. There can only be one `primary `output port for a node type.

### Dynamic ports

### `outputs`

### `invoke`

A function

### `describe` (dynamic ports only)

```ts
import { defineNodeType } from "@breadboard-ai/build";

export const reverseString = defineNodeType({
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});
```

## Types

### anyOf

## Adding to Kits

## Boards (coming soon)

## Examples

### String reverser

The following example is of a monomorphic node, meaning its input and output
ports are fixed, are the same for all instances, and never change at runtime.

```ts
import { defineNodeType } from "@breadboard-ai/build";

export const reverseString = defineNodeType({
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
      // (Optional) Allow the node itself to act as a shortcut for
      // this output port when wiring up this node in a board.
      primary: true,
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});
```

### Templater

The following example is of a polymorphic node, meaning its input and/or
output ports are allowed to change at runtime. Note the use of the special
"\*" port to signifiy a type constraint that applies to all dynamic ports.

```ts
import { defineNodeType, anyOf } from "@breadboard-ai/build";

export const templater = defineNodeType({
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: anyOf("string", "number"),
      description: "Values to fill into template's placeholders.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with placeholders substituted.",
    },
  },
  describe: ({ template }) => {
    return {
      inputs: Object.fromEntries(
        extractPlaceholders(template ?? "").map((name) => [
          name,
          { type: anyOf("string", "number") },
        ])
      ),
    };
  },
  invoke: ({ template }, placeholders) => {
    return {
      result: substituteTemplatePlaceholders(template, placeholders),
    };
  },
});
```
