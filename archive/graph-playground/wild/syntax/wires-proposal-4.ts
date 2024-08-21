{
  /**
   * The Board only has two nodes: input and output.
   * @see Node
   */
  type Board = {
    input: Node;
    output: Node;
  };

  /**
   * A typical options property bag
   * @todo Flesh this out
   */
  type NodeOptions = unknown;

  /**
   * `NodeOutputPort` represents the output port of a node.
   * A good way to think of it as one of the results of running a node.
   *
   * ```js
   * const oneOfTheResults = someNode().portName;
   * ```
   * `NodeOutputPort` has a `to` method that can be used to wire this port to
   * another node.
   *
   * ```js
   * someNode().portName.to(anotherNode);
   * ```
   */
  interface NodeOutputPort {
    to(
      result: NodeResult | (NodeResult | NodeInputPort)[] | NodeInputPort
    ): NodeResult;
  }

  type NodeResult = NodeOutputPorts &
    NodeOutputPort & {
      inputs: NodeInputPorts;
    };

  /**
   * `NodeOutputPorts` represents the entire output of a node. This is what
   * a Node returns when it is called as a function.
   *
   * ```js
   * const allResults = someNode();
   * const oneOfTheResults = allResults.portName;
   * ```
   */
  type NodeOutputPorts = Record<string, NodeOutputPort>;

  /**
   * `CallableNode` represents the ability to be called as a function.
   */
  interface CallableNode {
    (options: NodeOptions): NodeResult;
  }

  /**
   * `NodeInputPort` represents the input port of a node.
   */
  interface NodeInputPort extends CallableNode {
    to(
      result: NodeResult | (NodeResult | NodeInputPort)[] | NodeInputPort
    ): NodeResult;
  }

  /**
   * `NodeInputPorts` represents the entire input of a node. This is what
   * a Node returns when it is used as an index.
   */
  type NodeInputPorts = Record<string, NodeInputPort>;

  /**
   * Node is a callable interface:
   * - it can be called as a function to place a node on the board
   * - it can be used as an index to access the node's input ports.
   *
   * For example, this places the node on the board:
   *
   * ```js
   * node({ $id: "node" });
   * ```
   *
   * This accesses the node's input port:
   *
   * ```js
   * const port = node.someInputPort;
   * ```
   
   */
  type Node = CallableNode & NodeInputPorts;

  const board: Board = {} as Board;
  const promptTemplate = {} as Node;
  const generateText = {} as Node;
  const runJavascript = {} as Node;
  const secrets = {} as Node;
  const passthrough = {} as Node;
  const append = {} as Node;

  {
    // math.ts
    board
      .input({
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
      })
      .text.to(
        promptTemplate
          .question({
            $id: "math-function",
            template:
              "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
          })
          .prompt.to(
            generateText
              .text({
                $id: "math-function-generator",
                PALM_KEY: secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
              })
              .completion.to(
                runJavascript.code({ $id: "compute" }).result.to(
                  board.output.text({
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
                  })
                )
              )
          )
      );
  }

  {
    // accumulating-context.ts
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
    const conversationMemory = append({
      accumulator: "\n== Conversation History",
      $id: "conversationMemory",
    });

    // Store the promptTemplate for the same reason.
    const prompt = promptTemplate({
      $id: "assistant",
      context: "",
      template:
        "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
    });

    // Wire memory to accumulate: loop it to itself
    // Also feed it to the promptTemplate as context.
    conversationMemory.accumulator.to([
      prompt.inputs.context,
      conversationMemory.inputs.accumulator,
    ]);

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

    const generator = generateText({
      $id: "generator",
      PALM_KEY: secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
    });

    passthrough({ $id: "start" }).to(
      input.text.to([
        prompt.inputs.question.to(
          generator.inputs.completion.to([
            conversationMemory.inputs.assistant,
            output.to(input),
          ])
        ),
        conversationMemory.inputs.user,
      ])
    );
  }
}
