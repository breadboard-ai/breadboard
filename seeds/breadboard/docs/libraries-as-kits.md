# Wrapping a library as a Kit

If you aren't familiar with the concept of Breadboard Kits, please read the [Kits](kits.md) guide first.

## Why wrap a library as a Kit?

Breadboard Kits are a great way to share functionality with other Breadboard users. The `KitBuilder` class is a great tool for encapsulating your own logic in to something that can be imported in to your Breadboards.

Sometimes though you might want to import a library directly from `npm` and not have to worry about creating custom `InputValues` and `OutputValues` and then handling the mapping of those values to the library's API.

`KitBuilder.wrap` solves this for you. It allows you to use any functions from any library in your project as a Breadboard Kit and returns a strongly typed `Kit` that you can add in to your Breadboard.

## How to wrap a library

We are going to create a little example that validates a JSON object against a JSON schema. We will use the [jsonschema](https://www.npmjs.com/package/jsonschema) library from `npm`.

### Step 1: Create a board

```TypeScript
const board = new Board({
  title: "Test Echo",
  description: "Test Breadboard Kit",
  version: "0.0.1",
});
```

### Step 2: Import the library

```TypeScript
const js = await import("jsonschema");
```

### Step 3: Wrap the library and add it to the board

```TypeScript 
const MyKit = KitBuilder.wrap({ url: "test" }, { ...js.default });
// The validate method is the only method that will be exposed from the library (it's the only function, the other properties are just Classes)

const myKit = board.addKit(MyKit);
```

### Step 4: Use the library in a board

We are going to use the `validate` function. The `validate` function takes 3 arguments: 'instance', 'schema', and 'options'. We will use 3 `input` nodes to supply these arguments.

```TypeScript

const inputA = board.input();
const inputB = board.input();
const inputC = board.input();

const validateNode = myKit.validate();

inputA.wire("a->instance", validateNode);
inputB.wire("b->schema", validateNode);
inputC.wire("c->options", validateNode);
```

Now that we have the inputs wired up, we can wire the wire the `validateNode` to the output of the board.

In this case, we need to look to see if there are any values on the `errors` value.



```TypeScript
// result because it's just a string from a dynamic function
validateNode.wire("errors->", board.output());
```

Finally, we run the board with the parameters for the inputs, and wait until there is one output.

```TypeScript
const output = await board.runOnce({
  "a": { "hello": "world" },
  "b": { "type": "object" },
  "c": { allowUnknownAttributes: true }
});

console.log(output); // { errors: [] } ! YAY.
```

Yay. We have successfully wrapped a library as a Breadboard Kit.
