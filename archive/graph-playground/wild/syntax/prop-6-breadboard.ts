import { NodeValue, Schema } from "@google-labs/breadboard";

/**
 * The Board only has two nodes: input and output.
 */
export type Board = {
  input(options?: Options<InputInputs>): PlacedNode<InputInputs, InputOutputs>;
  output(
    options?: Options<OutputInputs>
  ): PlacedNode<OutputInputs, OutputOutputs>;

  /**
   * Takes an unplaced node and places it on the board.
   * This provides maximum flexibility of managing nodes while being very
   * clear about what is happening.
   *
   * In this setup, kits are no longer nodes, bundled into a class. Instead,
   * they are just libraries that import free-standing `NodeHandlers`.
   *
   * Also, one can just write JS function and create a node this way:
   *
   * ```js
   * const node = board.place(async(inputs) => { ... })
   * ```
   *
   * Placing a node provides a way to wire nodes in a function call-ey way:
   *
   * ```js
   * board.place(generateText, {
   *    PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out.PALM_KEY,
   * })
   * ```
   * When using this way, the key of the argument is used as the name of the
   * input port, and it accepts an output port of a node.
   *
   * @param node The node to place on the board
   * @param options node configuration
   */
  place<NodeType extends UnplacedNode>(
    node: NodeType,
    options?: Options<Parameters<NodeType>[0]>
  ): PlacedNode<Parameters<NodeType>[0], Awaited<ReturnType<NodeType>>>;

  /**
   * The `wire` method is the only way to draw wires explicitly in a queue-ey
   * way.
   *
   * ```js
   * board.wire(input.out.text, prompt.in.question);
   * ```
   *
   * You can also wire nodes in bunches:
   *
   * ```js
   * board.wire(input.out.text, [prompt.in.question, conversationMemory.in.user]);
   * ```
   *
   * The `wire` method chains, so:
   *
   * ```js
   * board.
   *  .wire(mathFunction.out.prompt, mathFunctionGenerator.in.text)
   *  .wire(mathFunctionGenerator.out.completion, compute.in.code)
   * ```
   * @param outPort a node's output port (tail) of a wire
   * @param inPort a node's input port (head) of a wire
   */
  wire(outPort: OutputPort, inPort: InputPort): Board;
};

/**
 * Represents the node placed on a board.
 */
type PlacedNode<InputsType, OutputsType = object> = {
  /**
   * The set of input ports of a node.
   */
  in: InputPorts<InputsType>;

  /**
   * The set of output ports of a node.
   */
  out: OutputPorts<OutputsType>;

  /**
   * A method to wire nodes in a "queue-ey" way. Using this way, we can
   * imagine piping output ports of one node to another.
   *
   * There are two variants: "implicit" and "explicit".
   *
   * In the "implicit" variant, we just pour all ports over. This works really
   * well in cases where the names of the ports match and no additional
   * twiddling is necessary. To use this variant, just put the destination
   * node as the argument:
   *
   * ``js
   * input.to(mathFunction.to(mathFunctionGenerator.to(...)));
   *
   * ```
   *
   * In the "explicit" variant, we specify input/output pairs in the same way
   * as in Options -- except in reverse: outputs are keys and inputs are
   * values of the argument object.
   *
   * ```js
   * mathFunctionGenerator.to({
   *   completion: compute.to(output).in.code,
   * })
   * ```
   * @param destination either a bag of input ports or a placed node.
   * @returns
   */
  to: <In, Out>(
    destination: Record<string, InputPort> | PlacedNode<In, Out>
  ) => PlacedNode<InputsType, OutputsType>;
};

// various type goop.

type InputInputs = {
  schema: Schema;
};

type InputOutputs = Record<string, NodeValue>;

type OutputInputs =
  | {
      schema: Schema;
    }
  | Record<string, NodeValue>;

type OutputOutputs = object;

type Options<In = object> =
  | {
      [P in keyof In]?: In[P] | OutputPort;
    }
  | {
      $id?: string;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnplacedNode = (values: any) => Promise<any>;

// Both of these are just stubs for now.
type InputPort = { input: boolean };
type OutputPort = { output: boolean };

type InputPorts<InputsType> = {
  [P in keyof InputsType]: InputPort;
};
type OutputPorts<OutputsType> = {
  [P in keyof OutputsType]: OutputPort;
};

export const board = {} as Board;
