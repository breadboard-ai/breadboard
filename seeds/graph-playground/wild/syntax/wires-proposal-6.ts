import { NodeValue } from "@google-labs/breadboard";
import { Schema } from "@google-labs/breadboard";

{
  /**
   * The Board only has two nodes: input and output.
   */
  type Board = {
    input(options?: Options<InputInputs>): PlacedNode;
    output(options?: Options<OutputInputs>): PlacedNode;

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
    ): PlacedNode;

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
     * @param inPort a node's input port (tail) of a wire
     * @param outPort a node's output port (head) of a wire
     */
    wire(inPort: InputPort, outPort: OutputPort): Board;
  };

  /**
   * Represents the node placed on a board.
   */
  type PlacedNode = {
    /**
     * The set of input ports of a node.
     */
    in: InputPorts;

    /**
     * The set of output ports of a node.
     */
    out: OutputPorts;

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
    to: (destination: Record<string, InputPort> | PlacedNode) => PlacedNode;
  };

  const board = {} as Board;

  type PromptTemplateInputs = {
    template: string;
    [x: string]: string;
  };

  type PromptTemplateOutputs = {
    prompt: string;
  };

  const promptTemplate = async (
    _inputs: PromptTemplateInputs
  ): Promise<PromptTemplateOutputs> => {
    return { prompt: "foo" };
  };

  type GenerateTextInputs = {
    PALM_KEY: string;
    prompt: string;
  };

  const generateText = async (_inputs: GenerateTextInputs) => {
    return {};
  };

  type RunJavascriptInputs = {
    code: string;
    name: string;
    raw: boolean;
  };

  const runJavascript = async (_inputs: RunJavascriptInputs) => {
    return {};
  };

  type SecretsInputs = {
    keys: string[];
  };

  const secrets = async (_inputs: SecretsInputs) => {
    return {};
  };

  {
    // math.ts -- (1 of 3) all nested in one nice fluent interface style.
    board
      .input({
        $id: "math-question",
        schema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              title: "Math problem",
              description: "Ask a math question",
            },
          },
          required: ["question"],
        },
      })
      .to(
        board
          .place(promptTemplate, {
            $id: "math-function",
            template:
              "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
          })
          .to(
            board
              .place(generateText, {
                $id: "math-function-generator",
                PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out
                  .PALM_KEY,
              })
              .to({
                completion: board.place(runJavascript, { $id: "compute" }).to(
                  board.output({
                    $id: "print",
                    schema: {
                      type: "object",
                      properties: {
                        result: {
                          type: "string",
                          title: "Answer",
                          description: "The answer to the math problem",
                        },
                      },
                      required: ["result"],
                    },
                  })
                ).in.code,
              })
          )
      );
  }

  {
    // math.ts -- (2 of 3) every node is first placed, then wired together

    const input = board.input({
      $id: "math-question",
      schema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            title: "Math problem",
            description: "Ask a math question",
          },
        },
        required: ["question"],
      },
    });

    const mathFunction = board.place(promptTemplate, {
      $id: "math-function",
      template:
        "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
    });

    const palmKey = board.place(secrets, { keys: ["PALM_KEY"] });

    const mathFunctionGenerator = board.place(generateText, {
      $id: "math-function-generator",
      PALM_KEY: palmKey.out.PALM_KEY,
    });

    const compute = board.place(runJavascript, { $id: "compute" });

    const output = board.output({
      $id: "print",
      schema: {
        type: "object",
        properties: {
          result: {
            type: "string",
            title: "Answer",
            description: "The answer to the math problem",
          },
        },
        required: ["result"],
      },
    });

    input.to(
      mathFunction.to(
        mathFunctionGenerator.to({
          completion: compute.to(output).in.code,
        })
      )
    );
  }
  {
    // math.ts -- (3 of 3) wired in a function-call-ey way.

    board.output({
      $id: "print",
      schema: {
        type: "object",
        properties: {
          result: {
            type: "string",
            title: "Answer",
            description: "The answer to the math problem",
          },
        },
        required: ["result"],
      },
      result: board.place(runJavascript, {
        $id: "compute",
        code: board.place(generateText, {
          $id: "math-function-generator",
          PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out.PALM_KEY,
          prompt: board.place(promptTemplate, {
            $id: "math-function",
            template:
              "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
            question: board.input({
              $id: "math-question",
              schema: {
                type: "object",
                properties: {
                  question: {
                    type: "string",
                    title: "Math problem",
                    description: "Ask a math question",
                  },
                },
                required: ["question"],
              },
            }).out.question,
          }).out.prompt,
        }).out.completion,
      }).out.result,
    });
  }

  // various type goop.

  type InputInputs = {
    schema: Schema;
  };

  type OutputInputs =
    | {
        schema: Schema;
      }
    | Record<string, NodeValue>;

  type Options<In = object> =
    | {
        [P in keyof In]?: NodeValue | OutputPort;
      }
    | {
        $id?: string;
      };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type UnplacedNode = (values: any) => Promise<any>;

  // Both of these are just stubs for now.
  type InputPort = { input: boolean };
  type OutputPort = { output: boolean };

  type InputPorts = Record<string, InputPort>;
  type OutputPorts = Record<string, OutputPort>;
}
