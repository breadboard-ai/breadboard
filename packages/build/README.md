# @breadboard-ai/build

[![Published on npm](https://img.shields.io/npm/v/@breadboard-ai/build.svg?logo=npm)](https://www.npmjs.com/package/@breadboard-ai/build)

A JavaScript library for defining new node types for the Breadboard AI
prototyping library.

## Install

```sh
npm i @breadboard-ai/build
```

## Defining new node types

Use the `defineNodeType` function to define a new Breadboard node type.

### Example

```ts
import { defineNodeType } from "@breadboard-ai/build";

export const reverseString = defineNodeType({
  name: "example",
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

### `inputs` and `outputs`

The `inputs` and `outputs` properties specify the input and output ports of the
node, as a map from port name to a port configuration. Port configurations have
the following fields:

- `type`: (Required) A [Breadboard Type
  Expression](#breadboard-type-expressions) (see below). All values sent or
  received on this port must conform to this type.

- `description`: (Recommended) A brief description of the port, which will be displayed in the
  Breadboard visual editor and in other places where introspection/debugging is
  performed.

- `primary`: (Optional) Enables a syntactic sugar feature for an output port to
  make wiring nodes more concise. When a node has a `primary` output port, then
  it becomes possible to use the node itself in API positions where an output
  port is expected, with the node's `primary` port being automatically selected
  as the default. There can only be one `primary `output port for a node type.

### `invoke`

The `invoke` function specifies the computation that the node will perform at
runtime. It is passed an object which contains values for all of its input
ports, and is expected to return an object with values for all of its output
ports, or a promise thereof if async work is required.

## Polymorphic node types

Usually, a Breadboard node type has a fixed set of input and output ports, as was
the case for the `reverseString` example above. We call these node types
_monomorphic_, because they have one shape.

However, sometimes it is necessary for a node's input and output ports to change
during the course of execution. We call these nodes _polymorphic_, because they
have multiple shapes.

### Polymorphic example

The following is an example of a polymorphic node type. It performs configurable
substitution of values into a string containing placeholders. It has one fixed
input (`template`), multiple _dynamic_ inputs, and one fixed output.

```ts
import { defineNodeType, anyOf } from "@breadboard-ai/build";

export const templater = defineNodeType({
  name: "example",
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: anyOf("string", "number"),
      description: "Values to fill into template's {{placeholders}}.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with {{placeholders}} substituted.",
    },
  },
  describe: ({ template }) => {
    return {
      inputs: Object.fromEntries(
        extractPlaceholders(template ?? "").map((name) => [
          name,
          {
            type: anyOf("string", "number"),
            description: `A value for the ${name} placeholder`,
          },
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

### Dynamic (`*`) `inputs` and `outputs`

The special `*` port name is used to signify that this node can dynamically
create input ports at runtime, and what types those ports will have.

### `describe`

The `describe` function determines which dynamic input and output ports should
be opened for a polymorphic node at runtime.

This function should return an object with either or both of `inputs` and
`outputs`, containing all _additional_ dynamic ports that should be opened,
given some set of input values.

Note that the fixed inputs and outputs (e.g. `template` and `result` in the
example above) need _not_ be returned by the `describe` function, since those
are automatically generated from the static port configuration.

Also note that monomorphic node definitions need not implement a `describe`
function _at all_, since its input and output ports are completely determined
from the static configuration.

### polymorphic `invoke`

The `invoke` function for polymorphic nodes is very similar to [invoke for
monomorphic nodes](#invoke), except that an additional second parameter is
passed to the function which contains the input values for the dynamic values.

## Adding nodes to Kits

Nodes created with `@breadboard-ai/build` can be directly integrated into Kits
created with `@google-labs/breadboard`. In addition, the
`NodeFactoryFromDefinition` type utility automatically provides a type that can
be used to generate the kit's signature.

```ts
import { reverseString } from "./reverse-string.js";
import { templater } from "./templater.js";

import { KitBuilder } from "@google-labs/breadboard/kits";
import { addKit } from "@google-labs/breadboard";
import type { NodeFactoryFromDefinition } from "@breadboard-ai/build";

const ExampleKit = new KitBuilder({
  title: "Example Kit",
  description: "An example kit",
  version: "0.1.0",
  url: "npm:@breadboard-ai/example-kit",
}).build({ reverseString, templater });
export default ExampleKit;

export const exampleKit = addKit(ExampleKit) as {
  reverseString: NodeFactoryFromDefinition<typeof reverseString>;
  templater: NodeFactoryFromDefinition<typeof templater>;
};
```

## Building boards

In Breadboard, nodes defined by `defineNodeType`, (and coming soon, other nested
boards) can be composed into an executable program called a _board_. Boards are
created using the `board` function.

### Example

```ts
import { board, input } from "@breadboard-ai/build";
import { reverseString, prompt } from "../build-example-kit.js";

const word = input({ description: "The word to reverse" });
const reversed = reverseString({ forwards: word });
const result = prompt`The word "${word}" is "${reversed}" in reverse`;

export default board({
  title: "Example of @breadboard-ai/build",
  description: "A simple example of using the @breadboard-ai/build API",
  version: "1.0.0",
  inputs: { word },
  outputs: { result },
});
```

### Inputs

The special `input` function is how you declare a value that the user of your
board will provide. You can use an `input` anywhere a value of that type is
accepted.

Inputs are typed as `string` by default. To set a different type, use the `type`
property. See [Breadboard type expressions](#breadboard-type-expressions) for
information about what kinds of types can be configured here.

```ts
import { input, array } from "@breadboard-ai/build";

const operands = input({
  description: "The numbers to sum",
  type: array("number"),
});
```

Note that when you use an `input` anywhere in your board, you need to also
provide that `input` to the `board` function. If you use an `input` without
providing it to `board`, an error will be raised during serialization. (This is
required so that TypeScript understands the input/output signature of the board,
which allows it to qprovide compile-time type-safety for when boards are nested
into other boards (coming soon).)

### Outputs

Board outputs are configured by directly passing the output ports that you wish
to expose (or nodes that have a [primary](#inputs-and-outputs) output port) to
the `outputs` property.

### Metadata

The optional `title`, `description`, and `version` fields are currently only
used by systems such as the Breadboard Visual Editor, for the purposes of
finding and indexing boards.

### Placeholders & Cycles

Occasionally it is desirable to create a board with _cycles_. However,
instantiating a node normally requires immediately providing a value for all
inputs. This is a problem because when building a cycle, there will always be an
input which needs to be connected to an output which has not yet been
initialized, and so cannot be referenced.

For such situations involving cycles, a `placeholder` is used to defer providing
a value until it can be named.

<!-- TODO(aomarks) Provide a more realistic example here. -->

```ts
import { placeholder } from "@breadboard-ai/build";

const bPlaceholder = placeholder({ type: "number" });
const a = someNode({ value: bPlaceholder });
const b = someNode({ value: a.outputs.result });
bPlaceholder.resolve(b.outputs.result);
```

### Serialization

Use the `serialize` function to convert a `board` result to BGL (Breadboard
Graph Language, a portable JSON format), which allows it to be executed by the
Breadboard runner:

```ts
import { board, serialize } from "@breadboard-ai/build";

const myBoard = board(...);
const bgl = serialize(myBoard);
console.log(JSON.stringify(bgl, null, 2));
```

## Breadboard type expressions

Breadboard type expressions are effectively a common subset of JSON schema and
the TypeScript type system. By using a Breadboard type expression when declaring
your ports, those types will be natively understood by both the Breadboard
runtime (which uses JSON Schema), and when using this node type in the
TypeScript API.

### Basic types

- `"string"`
- `"number"`
- `"boolean"`

### Utility types

- `anyOf(<type1>, <type2>, ...)`: A function which generates a JSON Schema
  `anyOf` and its corresponding TypeScript union (`type1 | type2`).

- `object({ prop1: <type1>, prop2: <type2> })`: A function which generates a
  JSON Schema `object` and its corresponding TypeScript `{...}` type.

### Unsafe type escape hatch

The `unsafeType` function can be used as a last resort escape hatch when the
above provided types are not sufficient. It allows you to directly specify JSON
schema and a TypeScript type:

```ts
import { unsafeType } from "@breadboard-ai/build";

const myCrazyType = unsafeType<{ foo: string }>({
  type: "object",
  properties: {
    foo: {
      type: "string",
    },
  },
  required: ["foo"],
});
```

## Known issues

1. Polymorphic nodes with dynamic _outputs_ are not yet supported.

2. The `context` object is not yet passed to `invoke`, so certain low-level
   operations are not yet possible.

3. `describe` is only passed values for fixed ports, not dynamic ones.

4. There is not currently a type check for excess properties on the return type
   of monomorphic invoke. That is, while TypeScript will enforce that all
   configured output ports have a value, it will not yet complain if an output
   is returned that does not match a configured output port.

5. There is no way to specify a description for a board's output (probably an
   `output` function, similar to `input`, is the solution there).

6. You cannot yet embed boards into other boards (this will work by
   instantiating a board object just like a regular node, but during
   serialization an `invoke` node will be created in its place.)
