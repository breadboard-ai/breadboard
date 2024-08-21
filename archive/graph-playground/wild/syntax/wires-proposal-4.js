const board = {};
const promptTemplate = () => ({});
const generateText = () => ({});
const runJavascript = () => ({});
const secrets = () => ({});
const passthrough = () => ({});
const append = () => ({});

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

  // Wire memory to accumulate: loop it to itself
  // Also feed it to the promptTemplate as context.
  conversationMemory.accumulator.to([
    prompt.context,
    conversationMemory.accumulator,
  ]);

  // Store the promptTemplate for the same reason.
  const prompt = promptTemplate(
    "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
    { context: "", $id: "assistant" }
  );

  const output = board.output({
    $id: "assistantResponse",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Assistant",
          description: "Assistant's response in the conversation with the user",
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
      prompt.question.to(
        generator.completion.to([
          conversationMemory.assistant,
          output.to(input),
        ])
      ),
      conversationMemory.user,
    ])
  );
}
