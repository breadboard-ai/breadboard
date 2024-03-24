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

## Known issues

1. Polymorphic nodes with dynamic _outputs_ are not yet supported.

2. The `context` object is not yet passed to `invoke`, so certain low-level
   operations are not yet possible.

3. `describe` is only passed values for fixed ports, not dynamic ones.

4. There is not yet an `object` type utility (though `unsafeType` can be used as
   an escape hatch), along with probably a number of other basic and utility
   types we'll need.

5. There is not currently a type check for excess properties on the return type
   of monomorphic invoke. That is, while TypeScript will enforce that all
   configured output ports have a value, it will not yet complain if an output
   is returned that does not match a configured output port.
