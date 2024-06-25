{
  /**
   * The Board only has two nodes: input and output.
   * @see PlacedNode
   * You can wire nodes by calling the `wire` method on the board.
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
   * This is the only way to wire nodes in a queue-ey way.
   *
   * You can also connect nodes in a standard function-call-ey way:
   *
   * ```js
   * kit.promptTemplate({
   *  PALM_KEY: kit.secrets({ keys: ["PALM_KEY"] }).out.PALM_KEY,
   * });
   *
   */
  type Board = {
    input(options?: Options): PlacedNode;
    output(options?: Options): PlacedNode;
    /**
     * Takes an unplaced node and places it on the board.
     * This is useful for kit-less nodes.
     * @param node The node to place on the board
     */
    place(node: UnplacedNode): PlacedNode;
    addKit(kit: unknown): void;
    wire(inPort: InputPort, outPort: OutputPort): Board;
  };

  type Options = Record<string, unknown>;

  type InputPort = object;
  type OutputPort = object;

  type InputPorts = Record<string, InputPort>;
  type OutputPorts = Record<string, OutputPort>;

  /**
   * Each node, when placed on the board, has two sets of ports:
   * - `in` ports
   * - `out` ports
   */
  type PlacedNode = {
    in: InputPorts;
    out: OutputPorts;
  };

  type UnplacedNode = (options: Options) => PlacedNode;

  const board = {} as Board;
  const kit = {} as {
    promptTemplate: UnplacedNode;
    generateText: UnplacedNode;
    runJavascript: UnplacedNode;
    secrets: UnplacedNode;
    passthrough: UnplacedNode;
    append: UnplacedNode;
  };

  {
    // math.ts
    board.addKit(kit);
    const mathFunction = kit.promptTemplate({
      $id: "math-function",
      template:
        "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
    });
    const mathFunctionGenerator = kit.generateText({
      $id: "math-function-generator",
      PALM_KEY: kit.secrets({ keys: ["PALM_KEY"] }).out.PALM_KEY,
    });
    const compute = kit.runJavascript({ $id: "compute" });

    board
      .wire(
        board.input({
          $id: "math-question",
          schema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                title: "Math problem",
                description: "Ask a math question",
              },
            },
            required: ["text"],
          },
        }).out.text,
        mathFunction.in.question
      )
      .wire(mathFunction.out.prompt, mathFunctionGenerator.in.text)
      .wire(mathFunctionGenerator.out.completion, compute.in.code)
      .wire(
        compute.out.result,
        board.output({
          $id: "print",
          schema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                title: "Answer",
                description: "The answer to the math problem",
              },
            },
            required: ["text"],
          },
        }).in.text
      );
  }

  {
    // accumulating-context.ts
    board.addKit(kit);
    // Store the input node so that we can refer back
    // to it to create a conversation loop.
    const input = board.input({
      $id: "userRequest",
      schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            title: "User",
            description: "Type here to chat with the assistant",
          },
        },
        required: ["text"],
      },
    });

    // Use the `append` node to accumulate the conversation history.
    // Populate it with initial context.
    const conversationMemory = kit.append({
      accumulator: "\n== Conversation History",
      $id: "conversationMemory",
    });

    // Store the promptTemplate for the same reason.
    const prompt = kit.promptTemplate({
      $id: "assistant",
      context: "",
      template:
        "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
    });

    const output = board.output({
      $id: "assistantResponse",
      schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            title: "Assistant",
            description:
              "Assistant's response in the conversation with the user",
          },
        },
        required: ["text"],
      },
    });

    const generator = kit.generateText({
      $id: "generator",
      PALM_KEY: kit.secrets({ keys: ["PALM_KEY"] }).out.PALM_KEY,
    });

    board
      .wire(conversationMemory.out.accumulator, [
        conversationMemory.in.accumulator,
        prompt.in.context,
      ])
      .wire(kit.passthrough({ $id: "start" }).out, input.in)
      .wire(input.out.text, [prompt.in.question, conversationMemory.in.user])
      .wire(generator.out.completion, [
        output.in.text,
        conversationMemory.in.assistant,
      ]);
  }
}
