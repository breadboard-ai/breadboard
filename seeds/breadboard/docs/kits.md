# How to make a Breadboard kit

Breadboard Kits are a way import functionality into your application for use on a board. Typically, they are used to create logical units of nodes that are frequently used in conjunction with each other. For example, a kit could be used to group nodes that are related to a certain API provider. One example of such kit is the [Pinecone Kit](https://github.com/google/labs-prototypes/tree/main/seeds/pinecone-kit), which contains node that implement various parts of the [Pinecone API](https://www.pinecone.io/).

This guide assumes some familiarity with making npm packages. If you are not familiar with this process, please refer to the [npm documentation](https://docs.npmjs.com/).

It is also highly recommended to write kits in TypeScript. This guide will assume that you are familiar with TypeScript. While TypeScript is not required, the strong typing provides a much better developer experience for the users of the kit.

## Setting up the kit package

To create new kit, start with initializaing a new npm package. For the moment, let's assume that each Breadboard Kit is an npm package.

In a new directory where you would like to create a package, run the following command:

```bash
npm init -y
```

This will create a new `package.json` file. Don't forget to add `type: module` to the `package.json` file. This will allow you to use ES6 modules in our code.

```json
{
  "type": "module"
}
```

Next, set up TypeScript for this package. If you're not sure how to do this, please refer to the various guides on the Internet, like [this one](https://code.visualstudio.com/docs/typescript/typescript-tutorial).

As the last step, install the `@google-labs/breadboard` package:

```bash
npm install @google-labs/breadboard
```

At this point, we're ready to start writing some code.

To create our own kits, we will use `KitBuilder`. We will use this class to `build` the kit with a given set of `NodeHandlers` (the functionality of your nodes) and import it into our Breadboard app.

## Creating a `KitBuilder` instance

In a new file called `index.ts`, import `KitBuilder` from `@google-labs/breadboard/kits`:

```ts
import { KitBuilder } from "@google-labs/breadboard/kits";
```

Next, create a new instance of `KitBuilder`:

```ts
const builder = new KitBuilder({
  url: "npm:my-kit",
  name: "My Kit",
  description: "A description of my kit",
  version: "0.0.1",
});
```

In the snippet above, the `url` property is the only required bit. Make sure it matches the name of the package you are creating, prefixed by the characters `npm:`. This is the only kind of URL that is supported at the moment.

All other properties are optional, but encouraged to properly describe the kit.

Now that we have a `KitBuilder` instance, we can use it to create the kit. This builder is exceedingly simple. It only has one method: `build()`:

```ts
const MyKit = builder.build({
  // node handlers go here
});
```

The `build()` method takes an object with node handlers. These handlers are functions that will be called when a node is visited by Breadboard runtime.

It is highly encouraged that these functions are stateless, and the Breadboard runtime assumes that they are. If you need to store state, think of it as inputs and outputs that are being received and passed along.

## Creating a node handler

Each node handler function has the following signature (in TypeScript):

```ts
type NodeHandlerFunction = (
  /**
   * The inputs that are supplied to the node.
   */
  inputs: InputValues,
  /**
   * The context of the node's invocation.
   */
  context: NodeHandlerContext
) => Promise<OutputValues | void>;
```

The `inputs` parameter is an object that contains the values of the inputs that are supplied to the node. The `context` parameter is an object that contains the context of the node's invocation. You should not need it for most cases. The return value is an object that contains the values of the outputs that are supplied by the node.

The simplest node handler function is one that returns the inputs as outputs:

```ts
const echo = async (inputs) => inputs;
```

To add this node to the kit, add the following to the `build()` method:

```ts
const MyKit = builder.build({
  echo,
});
```

## Handling inputs and outputs

The `inputs` and `outputs` parameters are objects that contain the values of the inputs and outputs that are supplied to and by the node. These objects are typed as follows:

```ts
export type InputValues = Record<string, NodeValue>;
```

In this object, the keys are the names of the inputs, and the values are the values of the inputs. The easiest way to think of `NodeValue` is as a JSON object:

```ts
/**
 * A type representing a valid JSON value.
 */
export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | { [key: string]: NodeValue };
```

The return value is typed similarly, except all values are optional:

```ts
export type OutputValues = Partial<Record<string, NodeValue>>;
```

The `InputValues` and `OutputValues` is how the Breadboard runtime communicates with the node handlers. The runtime will supply the inputs to the node handler, and the node handler will return the outputs to the runtime.

For example, if I want to write a node handler that adds two numbers, I can write it as follows:

```ts
const add = async (inputs) => {
  // Get the values of the inputs
  const { a, b } = inputs;
  // Make sure that the inputs are numbers
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error("Must provide two numbers to add");
  }
  // Return the sum of the two numbers as "value" output
  return { value: a + b };
};
```

When using this node in a board, I would write something like this:

```ts
const board = new Board();
const kit = board.addKit(MyKit);
const addNode = kit
  .add()
  .wire("a<-text", board.input())
  .wire("b<-text", board.input())
  .wire("->text", board.output());
```

## Exporting Kit

Once you have added all the nodes to the kit, you need export it as follows:

```ts
// Necessary for Breadboard to import it as a Kit when loading boards
export default MyKit;
// Necessary for TypeScript to recognize the type of the Kit
export type MyKit = InstanceType<typeof MyKit>;
// Optionally, export it as a named export
export { MyKit };
```

At this point, you should have a functional Kit. You can publish it to npm, and use it in your boards.

## Using the kit in a board

To use the kit in a board, you need to install it as a dependency:

```bash
npm install my-kit
```

Next, import the kit in your board:

```ts
import MyKit from "my-kit";
```

Finally, add the kit to the board:

```ts
const board = new Board();
const kit = board.addKit(MyKit);
```

You can now use the nodes in the kit in your board. See the `add` node example above.
