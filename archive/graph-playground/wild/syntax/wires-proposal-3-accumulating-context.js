const board = {};
// import/add kit
const kit = {};

const Constant = (value) => () => value;

// Store input node so that we can refer back to it to create a conversation
// loop.
// Arguments are configuration objects
// but I guess we could also wire inputs?
const input = board.input({
  $id: "userRequest",
});

// Use the `append` node to accumulate the conversation history.
// Populate it with initial context.
const conversationMemory = kit.append({
  accumulator: "\n== Conversation History",
  $id: "conversationMemory",
});

// Store prompt node for the same reason.
const prompt = kit.promptTemplate({
  $id: "assistant",
  template:
    "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
  // Note: specifying two wires in one line.
  context: ["", conversationMemory.accumulator],
  question: input.text,
});

conversationMemory({
  // loop conversationMemory.accumulator back into itself
  accumulator: conversationMemory.accumulator,
  assistant: kit.generateText({
    $id: "generator",
    text: prompt.prompt,
    PALM_KEY: Constant(kit.secrets({ keys: ["PALM_KEY"] })),
  }).completion,
});

const output = board.output({
  $id: "assistantResponse",
  text: conversationMemory.accumulator,
});

input({
  // Note: specifying two wires in one line.
  $control: [board.passthrough({ $id: "start" }), output],
});
