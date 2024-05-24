import TemplateKit from "@google-labs/template-kit";
import { Core, core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";
import { addKit, board, base } from "@google-labs/breadboard";

const templateKit = addKit(TemplateKit);
const coreKit = addKit(Core);
const palmKit = addKit(PaLMKit);

const accumulatingContextBoard = board(() => {
  // Store input node so that we can refer back to it to create a conversation
  // loop.
  const input = base.input({
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

  // Store prompt node for the same reason.
  const prompt = templateKit.promptTemplate({
    $id: "assistant",
    template:
      "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
    context: "",
  });

  // Use the `append` node to accumulate the conversation history.
  // Populate it with initial context.
  const conversationMemory = core.append({
    accumulator: "\n== Conversation History",
    $id: "conversationMemory",
  });

  // Wire memory to accumulate: loop it to itself.
  conversationMemory.accumulator.to(conversationMemory);

  const passthrough = coreKit.passthrough();
  passthrough.text
    .as("question")
    .to(palmKit.generateText({ $id: "generator" }));

  const generateText = passthrough.to(
    input.text.as("question").to(
      prompt.prompt.as("text").to(
        palmKit
          .generateText({ $id: "generator" })
          .in(coreKit.secrets({ keys: ["PALM_KEY"] }).PALM_KEY)
          .completion.as("assistant")
          .to(
            conversationMemory.accumulator.as("context").to(
              prompt.completion.as("text").to(
                base
                  .output({
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
                  })
                  .to(input)
              )
            )
          )
      )
    )
  );
}).serialize({
  title: "Accumulating Context",
  description:
    'An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you\'re asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.',
  version: "0.0.1",
});

export default accumulatingContextBoard;
