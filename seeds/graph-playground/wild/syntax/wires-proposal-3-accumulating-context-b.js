const board = {};
// import/add kit
const kit = {};

const input = board.input({ $id: "userRequest" });
const output = board.output({ $id: "assistantResponse" });

const prompt = kit.promptTemplate({
  $id: "assistant",
  template:
    "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
  context: "", // initial context
});

const generator = kit.generateText({
  $id: "generator",
  PALM_KEY: kit.secrets({ keys: ["PALM_KEY"] }), // In constructor -> Assumed constant
});

// Use the `append` node to accumulate the conversation history.
// Populate it with initial context.
const conversationMemory = kit.append({
  accumulator: "\n== Conversation History",
  $id: "conversationMemory",
});
// loop conversationMemory.accumulator back into itself
// (everything passed via in() is assumed queue-y.)
// (Shortform of in({ accumulator: conversationMemory.accumulator }).)
conversationMemory.in(conversationMemory.accumulator);

// Alternative way:
const conversationMemory2 = kit.append({ $id: "conversationMemory" });
// loop conversationMemory.accumulator back into itself
// While in() assumes queue-y, constants are automatically constant
conversationMemory2.in({
  accumulator: ["\n== Conversation History", conversationMemory],
});

// Flow:
//   input -> prompt     ->     generator -> output -> input
//             ^-- converationMemory <-'
board.passthrough({ $id: "start" }).to(
  input.to({
    text: prompt.in.question.to({
      prompt: generator.in.text.to({
        completion: [
          output.in.text.to(input),
          conversationMemory.in.accumulator.to({
            accumulator: prompt.in.context,
          }),
        ],
      }),
    }),
  })
);

// The `.in` could possibly be left off, as the .to() context implies it:
board.passthrough({ $id: "start" }).to(
  input.to({
    text: prompt.question.to({
      prompt: generator.text.to({
        completion: [
          output.text.to(input),
          conversationMemory.accumulator.to({
            accumulator: prompt.context,
          }),
        ],
      }),
    }),
  })
);

// To compare with the previous style:
board
  .passthrough({ $id: "start" })
  .wire(
    "->",
    input.wire(
      "text->prompt",
      generator
        .wire("completion->text", output.wire("->", input))
        .wire(
          "completion->accumulator",
          conversationMemory.wire("accumulator->context", prompt)
        )
    )
  );
