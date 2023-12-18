# Mental models for the recipe grammar

You can approach from two starting points:

1. Graph-first

   Your starting point: You want to create a graph representation of a genAI
   task and generate a `.json` file of it, that you can load in any compatible
   runtime, and that can be reused as a component in new tasks and new
   environments.

2. Code-first

   Your starting point: You want to write a genAI task in an easy to use
   framework that has a rich open ecosystem of re-usable components and that is
   taking advantage of TypeScript types along the way – both in the editor and
   to validate the code. You then want to make your task portable (i.e. it can
   run in other environments, including non-JS ones) and reusable (in other
   genAI tasks, or even as components in a graphical editor).

## Graph-first

### Basic concepts

The basic building blocks are _nodes_. Nodes have named _ports_ that define
their inputs and outputs. You can _wire_ nodes together by connecting output
ports from one node to input ports from other nodes.

A graph of nodes is called a `recipe`. Recipes define an interface with JSON
schema that describes how they can be called. They can either act as simple
functions, taking one set of inputs and producing one set, or they can go over
several rounds of inputs and outputs. Inside the graph, the interface is
represented by `input` and `output` nodes.

There are three kinds of nodes:

1. Recipes: Any recipe can be used as node. The interface defines the input and
   output ports.
2. Functions: Inline Javascript functions that take a bag of inputs as input and
   return a bag of outputs. Note that currently only self-contained functions
   can be serialized.
3. Nodes from _kits_: Collection of node types, which themselves are either
   recipes or functions. There are _light kits_ that are available as `.json`
   files and can be loaded on the fly, and _heavy kits_ that have to be loaded
   and provided by the runtime environment. Typically, the latter contains
   functions that can't be serialied.

Values that can be sent over the wires are standard JSON, `ReadableStream` and
node types (e.g. recipes) themselves.

### Simplest serializable graph

#### Creating and wiring nodes

In the API, node types (from kits or user-defined, see below) appear as factory
functions that create nodes. They take an optional bag of inputs as parameter.
E.g. `const pt = base.passthrough({ foo: "bar" })` creates a node of
`passthrough` from the `base` kit, with a default configuration of `{ foo: "bar"
}`.

The outputs are available as members of the created node, e.g. `pt.foo`, and can
be passed to other nodes: `const pt2 = base.passthrough({ bar: "baz", foo:
pt.foo })` is a second such node, this time in addition to the (static) default
configuration also wiring `foo` from `pt` to `pt2`.

There are three ways to wire nodes together:

1. as config: As seen above, generally `{ _incoming_port:
_source_node_._outgoing_port_, ... }`. `base.passthrough({ foo: "constant",
...pt })` creates a node with constant `foo` and connecting all output wires
   from `pt` to `pt2`.
2. `.to(<node>)`: Wires _to_ a different node. `pt.to(pt2)` wires all outputs
   ports from `pt` to `pt2`, `pt.foo.to(pt2)` just `foo`, and
   `pt.foo.as("baz").to(pt2)` connects `pt`'s `foo` port with `pt2`'s `baz`
   port. `.to()` returns its parameter, so that a pipeline can be written
   `node1.to(node2).to(node3)`.
3. `.in(<config>|<node>)`: Wires _from_ a different node. `pt2.in(pt)` wires all
   outputs of `pt` to `pt2`, `pt2.foo.in(pt)` wires just `foo` and `pt2.in({
baz: pt.foo })` connect `pt`'s `foo` port with `pt2`'s `baz` port. `.in()`
   returns the node it was called on; e.g. `between.in(before).to(after)`
   connects to other nodes via itself.

(Under the hood `pt` and `pt2` are proxy object that create objects representing
values on the fly, since the actual ports can vary per node type. E.g.
`passthrough` just passes any input port to as output port)

Destructing works well, e.g. you can write `const { foo } =
base.passthrough(...)` and work with `foo` like it is a value.
`base.passthrough({ foo })` and `foo.to(bar)` work.

Nodes execute when all their input wires contain data. By default wires act as
streams, so each value is used at most once. You can append `.memoize()` to a
wire, and then the last value is always available to downstream nodes:
`pt.foo.memoize().to(pt2)`.

#### Jod: TypeScript-mapping of JSON Schema

We want to take advantage of types both at graph definition time (e.g. so that
IntelliSense suggests the right things and that TypeScript catches many
potential errors in the graph) and runtime (e.g. to pass a recipe to an LLM as
tool, but also just to validate recipes that are loaded dynamically).

To support this, we use `jod`, which is heavily inspired by
[Zod](https://zod.dev/): It's a way to declare JSON schema in a way that also
generated TypeScript types. (Zod also validates schemas, which `jod` doesn't as
there are already many JSON schema validators)

There are two ways to use `jod`:

Defining a full schema:

```ts
import { j } from "...tbd";

const schema = j
  .schema({
    foo: j
      .string()
      .title("The Foo")
      .description("Foo-lish, not to be confused with Bar and Baz"),
  })
  .title("Foo Schema")
  .description("Contains a single foo");

const jsonSchema = schema.toJson();

const myFoo = { foo } satisfies typeof schema;
```

Annotating wires:

- `pt.foo.isString().to(pt2)`
- `pt.is(schema)` and `pt.foo.is(j.string())`
- `pt.foo.title("A foo").description("...")`

WHen using nodes from kits, they should usually come with type information
already and so most of the time, types can be inferred. `jod` is helpful to add
type information where types are ambiguous (e.g. because these nodes have
dynamic output ports) or to add metadata like title and descriptions.

#### Defining recipes

To create a recipe use the `recipe` function. `recipe` returns a node factory
that can be used to create nodes (see above).

Calling `serialize()` on it returns a JSON representation of the graph.

It takes a single parameter: A function that creates a graph, that is
immediately evaluated. It has one parameter that represents a default `input`
node, and returns either a node or an object representing output wires, turning
those into an `output` node:

```ts
import { recipe } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ foo }) => {
  return { bar: foo };
}).serialize();
```

Alternatively, one can create `input` and `output` nodes directly:

```ts
import { recipe, base } from "@breadboard-ai/breadboard";

const serializedGraph = recipe() => {
  const input = base.input();
  const output = base.output({ bar: input.foo });
}).serialize();
```

[Implementation note: Right now you have to return `output`, will fix that]

They are both equivalent, except that TypeScript will understand the parameters
in the first one. This will be especially useful when defining nested recipes
that are used as nodes.

[Ed note: Not sure we should even introduce the second so early once we have
default derived schemas and jod annotations]

#### Adding types to recipes

To describe recipes better and make them more reusable, it's advisable to add
type information. By default the framework will infer types from the wires,
including copying descriptions from used nodes. But this shouldn't be the final
take.

```ts
import { recipe, base } from "@breadboard-ai/breadboard";

const metadata = {
  title: "A recipe",
  description: "An example recipe",
  version: "0.0.1",
  url: "https://...",
};

const serializedGraph = recipe(({ foo }) => {
  const pt = base.passthrough({
    foo: foo.isString().title("A foo").description("Foo-lish"),
  });

  return { bar: pt.foo.isString().title("A bar").description("Bar-ish") };
})
  .metadata(metadata)
  .serialize();
```

Creates a recipe with complete metadata and input and output schema. The input
and output schema are still inferred, but see how the wires were all annotated.

Alternatively, you can describe full schemas like so:

```ts
import { recipe, base } from "@breadboard-ai/breadboard";

const metadata = {
  title: "A recipe",
  description: "An example recipe",
  version: "0.0.1",
  url: "https://...",
};

const serializedGraph = recipe((input) => {
  const { foo } = input.is(
    j.schema({ foo: j.string().title("A foo").description("Foo-lish") })
  );

  const pt = base.passthrough({ foo });

  return base
    .output({ bar: pt.foo })
    .is(j.schema({ bar: j.string().title("A bar").description("Bar-ish") }));
})
  .metadata(metadata)
  .serialize();
```

or

```ts
import { recipe, base } from "@breadboard-ai/breadboard";

const metadata = {
  title: "A recipe",
  description: "An example recipe",
  version: "0.0.1",
  url: "https://...",
};

const serializedGraph = recipe(() => {
  const input = base
    .input()
    .is(j.schema({ foo: j.string().title("A foo").description("Foo-lish") }));
  const output = base
    .output({ bar: input.foo })
    .is(j.schema({ bar: j.string().title("A bar").description("Bar-ish") }));
})
  .metadata(metadata)
  .serialize();
```

#### Code as nodes

To introduce functions as nodes, use `code`. It works exactly like `recipe`,
except that the passed function isn't immediately run but instead stored for use
when the graph itself in run. Since we're directly serializing the graph it
means that it'll never be run here but instead just serialized. That's why it
must be self-contained.

Let's look at an example:

```ts
import { recipe, code } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ foo }) => {
  const reverseText = code(({ text }) => {
    return { reversed: test.split("").reverse().join("") };
  });
  return { bar: reverseFoo({ foo.isString() }).reversed };
}).serialize();
```

Here, `reverseFoo` is a new node type that is created by the `code` function.
Note how we annotated `foo` as `foo.isString()` as otherwise TypeScript would
complain about `test.split`.

The `return` line instantiates a node, passing it the input `foo` and assigning
its output `reversed` to the recipe's output `bar`.

### Lambdas, closures and other more advanced topics

#### Passing lambdas

Node types are first class entities that can be passed as values:

```ts
import { recipe, code } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ foo, bar, baz }) => {
  const reverseText = code<{ text: string }>(({ text }) => {
    return { reversed: test.split("").reverse().join("") };
  });

  const reverseOp = recipe(({ param }) => {
    return { result: reverseText({ text: param }).reversed };
  });

  const applyOp = recipe(({ a, b, c, op }) => {
    return {
      a: op({ param: a }).result,
      b: op({ param: b }).result,
      c: op({ param: c }).result,
    };
  });

  return applyOp({ op: reverseOp, a: foo, b: bar, c: baz });
}).serialize();
```

This example defines the same code function as before, a recipe that primarily
renames inputs and outputs, and a recipe that takes a recipe as parameter and
applies to its other parameters.

Here we had to add a manual type annotation to `code` for TypeScript.

TODO: What's the `jod` way to do this? `.is` doesn't work to set the type of the
function itself. We probably need `code({ input: { foo: j.string() }},
<function>)`, but we ran into issues with this pattern before.

Note how `reverseOp` refers to `reverseText` that is defined in its parent
scope. This works, because the passed function is immediately evaluated, not
serialized. So `recipe` functions don't have to be self-contained (but must
produce a valid graph), unlike `code` functions. This is a strategy to turn
regular code into a serializable graphs: Refactor code pieces into
self-contained functins and use `recipe` graphs to connect them.

Side note: `reverseText` could have also been defined inside `reverseOp`, but
not outside `serializedGraph`: The `.serialize()` call will only serialize what
was defined within the function, not automatically pull in all dependencies. So
that will throw an error. The alternative to moving the function in is to put
`reverseText` into a kit and ship the kit independently.

[implementation note: the error isn't yet throwing, the behavior is currently
undefined. FWIW, we could also just allow defining functions outside. My worry
is just that it might be surprising in what it pulls in. So the above is a
proposal to be a bit stricter]

#### Closure-like lambdas

Let's change our example a little:

```ts
import { recipe, code } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ foo, bar, baz, suffix }) => {
  const suffixOp = recipe(({ param }) => {
    const appendSuffix = code(({ text, suffix }) => ({
      text: text + "-" + suffix,
    }));
    return {
      result: appendSuffix({
        text: param.isString(),
        suffix: suffix.isString(),
      }).text,
    };
  });

  const applyOp = recipe(({ a, b, c, op }) => {
    return {
      a: op({ param: a }).result,
      b: op({ param: b }).result,
      c: op({ param: c }).result,
    };
  });

  return applyOp({ op: reverseOp, a: foo, b: bar, c: baz });
}).serialize();
```

`appendSuffix` is a self-contained function that concats two strings. Here we
defined it inside `appendSuffix`, but we could have also defined it one level
higher.

Note how `suffixOp` calls `appendSuffix` by passing both `param` (which it
received) and `suffix`, which is defined at a higher level! This is like a
closure in regular Javascript, referring to variables defined in parent lexical
scopes. Note that this only works for `recipes` (evaluated immediately), not for
`code` (evalauted at runtime, not serialization time). The pattern above shows
how to build closures with regular code.

(Under the hood this creates a `lambda` node, which has `suffix` as input and
passes it as extra parameter to the `appendSuffix` graph. The `applyOp` call
gets the output of this `lambda` function, i.e. with the value of `suffix`
already bound to `reverseOp`.)

There are two important ways how these closure-like lambdas differ from regular
closures:

- Wires can only go from up-scope to down-scope, not the other way around. So we
  can't "write" into the outer scope.
- These wires from outer scopes are effectively memoized for the lifetime of the
  passed lambda. That is, if new data arrives _after_ the lambda is passed, but
  still while the lambda is used (e.g. in a slow `map`), the lambda still only
  sees the original values. If the lambda creation and passing happens in a
  loop, then, as expected, each round of the loop will use the latest values.

This mostly follows from the underlying machinery, but crucially it also means
that such lambdas can be returned by a recipe _without the original
instantiation of the recipe having to stick around_. We can serialize those
recipes and send them over the wire without keeping a handle to a runtime
somewhere.

This slightly modified example expects `suffix` as input and returns a lambda
that has the value of `suffix` baked in.

```ts
import { recipe, code } from "@breadboard-ai/breadboard";

const suffixOpGenerator = recipe(({ suffix }) => {
  const suffixOp = recipe(({ param }) => {
    const appendSuffix = code(({ text, suffix }) => ({
      text: text + "-" + suffix,
    }));
    return {
      result: appendSuffix({
        text: param.isString(),
        suffix: suffix.isString(),
      }).text,
    };
  });

  const applyOp = recipe(({ a, b, c, op }) => {
    return {
      a: op({ param: a }).result,
      b: op({ param: b }).result,
      c: op({ param: c }).result,
    };
  });

  return { op: applyOp };
}).serialize();
```

This could be used like this:

```ts
import { recipe, code, load } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ foo, bar, baz }) => {
  const suffixOpGenerator = load("suffixOpGenerator.json");

  const { op } = suffixOpGenerator({ suffix: "foo" });

  const applyOp = recipe(({ a, b, c, op }) => {
    return {
      a: op({ param: a }).result,
      b: op({ param: b }).result,
      c: op({ param: c }).result,
    };
  });

  return applyOp({ op, a: foo, b: bar, c: baz });
}).serialize();
```

[ed note: I don't think `code` and `load` are good names. Too general.]

#### Under the hood: Scopes

There is a bit of machinery under the hood that primarily keeps track of JS
scopes. It maps to nested `recipe` calls, and it keeps track of in which
`recipe` a node was _instantiated_. For serializing graphs, this is used in two
places:

- To detect when closure-like lambdas refer to nodes instantiated in the parent
  scope.
- So that recipe() functions that define their own `input` and `output` node
  don't have to return one of the `output` nodes [not yet implemented].

(At runtime, there is another class of scopes, "dynamic scopes", along which
information like which kits to use is passed)

### Kits

#### Simple kits

Kits are just collections of the primitives defined above. Here is a simple kit,
defined inline and then used and serialized:

```ts
const myKit = makeKit({
  name: "myKit",
  url: "...",
}, {
  fooPassthrough: recipe(({foo} = ({foo})),
  fooReverse: recipe(...)
};

const example = recipe(() => {
  const fpt = myKit.fooPassthrough();
});

const myKitJson = myKit.serialize();
```

Such a kit can be used in another context like this:

```ts
import { recipe, load, loadKit } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ db, query }) => {
  const fooKit = loadKit("fooKit.json");

  const foo = fooKit.fooReverse({ foo: "bar" });
  ...
}).serialize();
```

However this won't have any TS type annotations.

TODO: Tooling to create type annotations for `myKitJson` and to both allow

- ````ts
    import { fooKit } from "...";
    ```
  and
  ````
- ```ts
  import { FooKitI } from "..."
  ...
    const fooKit = loadKit("fooKit.json") as FooKitI
  ```

#### Unserializable kits

Some kits might contain functions that can't be serialized, e.g. because they
use information from the environment. That's ok, and in fact the primary way
such functionality can be imported.

Such kits have to be provided by the runtime environment. Crucially, the
environment gets to choose which version of the kit it provides. For example a
browser environment can provide the browser version, a node environment the node
implementation. Or maybe the browser just provides proxy nodes that call the
server-side variant under the hood.

They are defined just as above, except that they can't be serialized.

#### Kits made closure-like lambdas

If kits are classes with all static methods, then we can imagine how kits as
objects could look like: A recipe that outputs a kit, where the nodes are
pre-configured to some values. (Non-const members aren't supported yet)

This could be useful to represent a specific index. Consider a recipe taking the
URL of a database as input can output `query` and other node types that act on
that database.

This could be used on-the-fly in a recipe, e.g. when the URL is dynamic. Or that
kit could just be published as `.json` file as a way to query that specific
database.

```ts
import { recipe, load, makeKit } from "@breadboard-ai/breadboard";

const serializedGraph = recipe(({ db, query }) => {
  const acmeDb = load(".../acmeDB.json");
  const acmeKit = makeKit(acmeDb({ db }));

  const results = acmeKit.query({ query });
  ...
}).serialize();
```

This will serialize the graph, including referencing the original URL of the kit
as dependency. The `makeKit` call transfers all the metadata from the `load`
call and what is contained in the loaded `.json`.

```

```
