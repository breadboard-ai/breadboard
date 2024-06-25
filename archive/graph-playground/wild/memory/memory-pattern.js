// in both of the patterns, the first actor only participates once,
// at the beginning of the conversation.

// The other actor participates repeatedly, until the conversation ends.
// The first pattern has the agents participating in the same prompt template.
// That is, the "output" in this pattern is the same.
// The second pattern has the agents participating in two different prompt
// templates.
// That is, there are two different "outputs", one for each agent.

// If we know the number of actors, and we know what outputs they use,
// we should be able to wire the memory correctly.

/**
 * The following three nodes form the "memory" of the ReAct algo.
 * The are built out of the `append` node, which is a powerful tool
 * for accumulating information.
 *
 * We need three nodes to orchestrate the proper ordering of the memory:
 * - First, we need to remember the question.
 * - Second, we need to remember the thought.
 * - Thirs, we need to remember the observation.
 *
 * The second and third are remembered repeatedly in the ReAct algo cycle.
 *
 * Graphs are generally orderless, so extra work is necessary to make this
 * ordering happen.
 */
export const memoryPatternOne = (kit, output) => {
  // "third" is the tool that produces the result in ReAct algo.
  // It's usually captured as "Observation" in memory.
  const third = kit.append().wire("accumulator->memory", output);

  // "second" is the LLM that produces the thought in ReAct algo.
  // It's usually captured as "Thought" in memory.
  const second = kit
    .append()
    .wire("accumulator->", third)
    .wire("accumulator<-", third);

  // "first" is the user who asks the question in ReAct algo.
  // It's usually captured as "Question" in memory.
  // IMPORTANT: There is no actual accumulation going on here.
  // The only reason why we're using `append` is to format output.
  // It takes empty accumulator and produces `Question: <question>` output,
  // which is then sent to another `append` as accumulator.
  const first = kit
    .append()
    .wire("accumulator->", second)
    .wire("accumulator->memory", output);

  return { first, second, third };
};

// Two outputs: means going into two separate templates or completions.
// Example: dialog between two chat agents.
export const memoryPatternTwo = (kit, secondOutput, thirdOutput) => {
  // "third" is the third agent. This agent has its own "output", which
  // typically is a prompt template.
  // goes to second output, because it feeds the second agent prompt template.
  const third = kit.append().wire("accumulator->memory", secondOutput);

  // "second" is the second agent. This agent also has its own "output".
  const second = kit
    .append()
    .wire("accumulator->", third)
    .wire("<-accumulator", third);

  // "first" is the first agent. It's usually the user.
  // In this pattern, this agent only participates once, at the beginning.
  // goes to second output because it starts the question.
  const first = kit
    .append()
    .wire("accumulator->", second)
    .wire("accumulator->memory", secondOutput);

  second.wire("accumulator->memory", thirdOutput);

  return { first, second, third };
};

export const memoryPatternThree = (kit, output) => {
  // In this pattern, there's only two actors, but both are participating
  // continuously.
  // this is the `accumulating-context` pattern.

  const first = kit.append();
  first.wire("accumulator->?", first);
  first.wire("accumulator->memory", output);
  return { first };
};

class ConversationMemory {
  #kit;
  constructor(kit) {
    this.#kit = kit;
  }

  addActor({ name, output, once }) {
    // name -- a friendly name for the actor
    // output -- the node that will be wired as output for the actor's memory
    // once -- if true, the actor only participates once, at the beginning of the conversation.
  }
}

// memoryPatternOne
// this is how the ReAct algo would use the `ConversationMemory` class.
(kit, output) => {
  const memory = new ConversationMemory(kit);
  memory.addActor({ name: "Question", once: true });
  memory.addActor({ name: "Thought" });
  memory.addActor({ name: "Observation" }, output);
  const { rememberQuestion, rememberThought, rememberObservation } =
    memory.getMemoryStores();
};

// memoryPatternTwo
// this is how "endless debate" will use the `ConversationMemory` class.
(kit, albertOutput, friedrichOutput) => {
  const memory = new ConversationMemory(kit);
  memory.addActor({ name: "Topic", once: true });
  memory.addActor({ name: "Albert", output: albertOutput });
  memory.addActor({ name: "Friedrich", output: friedrichOutput });
  const { rememberTopic, rememberAlbert, rememberFriedrich } =
    memory.getMemoryStores();
};

// memoryPatternThree
// this is how "accumulating context" will use the `ConversationMemory` class.
(kit, output) => {
  const memory = new ConversationMemory(kit);
  memory.addActor({ name: "User" });
  memory.addActor({ name: "Asisstant" }, output);
  const { rememberUser, rememberAssistant } = memory.getMemoryStores();
};
