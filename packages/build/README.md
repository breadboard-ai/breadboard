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

- `description`: (Recommended) A brief description of the port, which will be
  displayed in the Breadboard visual editor and in other places where
  introspection/debugging is performed.

- `title`: (Optional) A concise title for this input. Defaults to the name of
  the port.

- `default`: (Optional) A default value for this input.

- `format`: (Optional) Additional information about the format of the value.
  Primarily used to determine how strings are displayed in the Breadboard Visual
  Editor. Valid values:

  - `multiline`: A string that is likely to contain multiple lines.
  - `javascript`: A string that is JavaScript code.

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
import { defineNodeType } from "@breadboard-ai/build";

export const templater = defineNodeType({
  name: "example",
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: "string",
      description: "Values to fill into template's {{placeholders}}.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with {{placeholders}} substituted.",
    },
  },
  describe: ({ template }) => ({
    inputs: extractPlaceholders(template ?? ""),
  }),
  invoke: ({ template }, placeholders) => ({
    result: substituteTemplatePlaceholders(template, placeholders),
  }),
});
```

### Dynamic (`*`) `inputs` and `outputs`

The special `*` port name is used to signify that this node can dynamically
create input ports at runtime, and what types those ports will have.

### polymorphic `invoke`

The `invoke` function for polymorphic nodes is very similar to [invoke for
monomorphic nodes](#invoke), except that an additional second parameter is
passed to the function which contains the input values for the dynamic values.

### `reflective`

Setting `reflective: true` on the `*` output configuration tells Breadboard that
all dynamically created input ports will have a corresponding output port.

### `describe`

The `describe` function allows you to tell Breadboard which input and output
ports are valid and open at runtime based on some particular set of input
values.

A `describe` function will be passed a set of values (in the same way as
`invoke`), and should return an object containing either or both of `inputs` and
`outputs`, which can either be an array of strings or an object. When an array
of strings, the strings are the names of the ports to open. When an object, the
keys are the names of the ports to open, and the values are an object matching
`{description: string}`.

For example, in `templater` above, the `describe` function parses the static
`template` input and opens a port for each of the template's placeholders.

In most situations a `describe` function is not required, because Breadboard can
use the port configuration and instantiation values to determine the ports
automatically. See the following table to check whether you should provide a
`describe` function, and if so whether it should return `inputs`, `outputs`, or
both. (Note that _Dynamic_ means there is a special `*` port configuration, and
_Static_ means there is not.)

| Inputs  | Outputs    | Describe Inputs | Describe Outputs |
| ------- | ---------- | --------------- | ---------------- |
| Static  | Static     | N/A             | N/A              |
| Dynamic | Static     | Optional        | N/A              |
| Static  | Dynamic    | N/A             | **Required**     |
| Dynamic | Dynamic    | Optional        | **Required**     |
| Dynamic | Reflective | Optional        | N/A              |

### `unsafeOutput`

When a node has dynamic outputs, but is not `reflective`, it is not possible at
compile time for Breadboard to know what the valid output ports of a node are.
In this case, use the `unsafeOutput` method to get an output port with a given
name. Note that there is no guarantee this port will exist at runtime, so a
runtime error could occur.

(Note that the following example is highly contrived. It is better to find a
way to use fully static or reflective nodes whenever possible to avoid the use
of `unsafeOutput`).

```ts
import { defineNodeType, array } from "@breadboard-ai/build";

const weirdStringLength = defineNodeType({
  name: "weirdStringLength",
  inputs: {
    strings: { type: array("string") },
  },
  outputs: {
    "*": { type: "number" },
  },
  describe: ({ strings }) => ({
    outputs: strings,
  }),
  invoke: ({ strings }) =>
    Object.fromEntries(strings.map((name) => [name, name.length])),
});

const lengths = weirdStringLength({ strings: ["foo", "bar"] });

// All 3 of these variables will have type OutputPort<number> and can be wired
// up to other nodes and boards as normal, but only `foo` and `bar` will
// *actually* be valid at runtime.
const foo = lengths.unsafeOutput("foo");
const bar = lengths.unsafeOutput("bar");
const baz = lengths.unsafeOutput("baz"); // Oops!
```

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

### Cycles & Loopbacks

Occasionally it is desirable to create a board with _cycles_. However,
instantiating a node normally requires immediately providing a value for all
inputs. This is a problem because when building a cycle, there will always be an
input which needs to be connected to an output which has not yet been
initialized, and so cannot be referenced.

For such situations involving cycles, the `loopback` function is used to create
an object whose value will be provided at some later time, namely with the
missing link in the cycle.

<!-- TODO(aomarks) Provide a more realistic example here. -->

```ts
import { loopback } from "@breadboard-ai/build";

const bPlaceholder = loopback({ type: "number" });
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
- `"null"`
- `"unknown"`

### Utility types

- `array(<type>)`: A function which generates a JSON Schema `array` and its
  corresponding TypeScript `Array<...>` type.

- `object({ prop1: <type1>, prop2: <type2>, ... }, [<additional>])`: A function
  which generates a JSON Schema `object` and its corresponding TypeScript
  `{...}` type. If the optional second argument is set, then the object will
  also allow additional properties of the given type.

- `anyOf(<type1>, <type2>, ...)`: A function which generates a JSON Schema
  `anyOf` and its corresponding TypeScript union (`type1 | type2`).

- `enumeration(<type1>, <type2>, ...)`: A function which generates a JSON Schema
  `enum` and its corresponding TypeScript union (`type1 | type2`).

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

1. The `context` object is not yet passed to `invoke`, so certain low-level
   operations are not yet possible.

2. There is no way to specify a description for a board's output (probably an
   `output` function, similar to `input`, is the solution there).

3. You cannot yet embed boards into other boards (this will work by
   instantiating a board object just like a regular node, but during
   serialization an `invoke` node will be created in its place.)
