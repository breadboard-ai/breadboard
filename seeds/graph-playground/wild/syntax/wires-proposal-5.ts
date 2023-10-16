{
  /**
   * The Board only has two nodes: input and output.
   * @see BoardNode
   */
  type Board = {
    addInput(options?: unknown): PlacedNode;
    addOutput(options?: unknown): PlacedNode;
    add(node: UnplacedNode): PlacedNode;
    wire(inPort: InputPort, outPort: OutputPort): Board;
  };

  type InputPort = object;
  type OutputPort = object;

  type InputPorts = Record<string, InputPort>;
  type OutputPorts = Record<string, OutputPort>;

  type PlacedNode = {
    in: InputPorts;
    out: OutputPorts;
  };

  type UnplacedNode = (options: unknown) => UnplacedNode;

  const board = {} as Board;
  const promptTemplate = {} as UnplacedNode;
  const generateText = {} as UnplacedNode;
  const runJavascript = {} as UnplacedNode;
  const secrets = {} as UnplacedNode;
  const passthrough = {} as UnplacedNode;
  const append = {} as UnplacedNode;

  {
    // math.ts
    const mathFunction = board.add(
      promptTemplate({
        $id: "math-function",
        template:
          "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
      })
    );
    const mathFunctionGenerator = board.add(
      generateText({
        $id: "math-function-generator",
        PALM_KEY: board.add(secrets(["PALM_KEY"])).out.PALM_KEY,
      })
    );
    const compute = board.add(runJavascript({ $id: "compute" }));

    board
      .wire(
        board.addInput({
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
        board.addOutput({
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
    // Store the input node so that we can refer back
    // to it to create a conversation loop.
    const input = board.addInput({
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
    const conversationMemory = board.add(
      append({
        accumulator: "\n== Conversation History",
        $id: "conversationMemory",
      })
    );

    // Store the promptTemplate for the same reason.
    const prompt = board.add(
      promptTemplate({
        $id: "assistant",
        context: "",
        template:
          "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
      })
    );

    const output = board.addOutput({
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

    const generator = board.add(
      generateText({
        $id: "generator",
        PALM_KEY: board.add(secrets(["PALM_KEY"])).out.PALM_KEY,
      })
    );

    board
      .wire(conversationMemory.out.accumulator, [
        conversationMemory.in.accumulator,
        prompt.in.context,
      ])
      .wire(board.add(passthrough({ $id: "start" })).out, input.in)
      .wire(input.out.text, [prompt.in.question, conversationMemory.in.user])
      .wire(generator.out.completion, [
        output.in.text,
        conversationMemory.in.assistant,
      ]);
  }
}
