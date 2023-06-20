class Node {}

class NodeDescriptor {
  /**
   *
   * @param configuration "$id" is special. It is the unique identifier of the node.
   */
  constructor(public configuration?: Record<string, unknown>) {}

  to(routing: Record<string, string>, destination: Node): NodeDescriptor {
    return this;
  }
}

class UserInput extends Node {}

class TextCompletion extends Node {}

class ConsoleOutput extends Node {}

class PromptTemplate extends Node {}

class LocalMemory extends Node {}

class GraphRunner {
  run(node: NodeDescriptor) {
    // ...
  }
}

const node = (node: typeof Node, configuration: Record<string, unknown>) => {
  return new NodeDescriptor(configuration);
};

const consoleOutput = node(ConsoleOutput, { $id: "console-output-1" });
const rememberAlbert = node(LocalMemory, { $id: "remember-albert" });
const rememberFriedrich = node(LocalMemory, { $id: "remember-friedrich" });

const albert = node(PromptTemplate, {
  $id: "albert",
  template:
    'Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating."\n\n== Debate History\n{{context}}\n\n==Additional Single Argument\n\nAlbert:',
}).to(
  { prompt: "text" },
  node(TextCompletion, {
    $id: "albert-completion",
    "stop-sequences": ["\nFriedrich", "\n**Friedrich"],
  })
    .to(
      { completion: "context" },
      node(PromptTemplate, {
        $id: "albert-voice",
        template:
          "Restate the paragraph below in the voice of a brillant 20th century scientist. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(TextCompletion, {
          $id: "albert-voice-completion",
        }).to({ completion: "text" }, consoleOutput)
      )
    )
    .to({ completion: "Albert" }, rememberAlbert)
);

const friedrich = node(PromptTemplate, {
  $id: "friedrich",
  template:
    "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{context}}\n\n==Additional Single Argument\nFriedrich:",
}).to(
  { prompt: "text" },
  node(TextCompletion, {
    $id: "friedrich-completion",
    "stop-sequences": ["\nAlbert", "\n**Albert"],
  })
    .to(
      { completion: "context" },
      node(PromptTemplate, {
        $id: "friedrich-voice",
        template:
          "Restate the paragraph below in the voice of a 19th century philosopher. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(TextCompletion, {
          $id: "friedrich-voice-completion",
        }).to({ completion: "text" }, consoleOutput)
      )
    )
    .to({ completion: "Friedrich" }, rememberFriedrich)
);

rememberFriedrich.to({ context: "context" }, albert);
rememberAlbert.to({ context: "context" }, friedrich);

const debateTopic = node(UserInput, {
  $id: "debate-topic",
  message: "What is the topic of the debate?",
})
  .to(
    { text: "topic" },
    node(LocalMemory, {
      $id: "remember-topic",
    })
  )
  .to({ context: "context" }, albert);

const graph = new GraphRunner();
graph.run(debateTopic);
