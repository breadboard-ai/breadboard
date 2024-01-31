import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const sampleAgent = "single-turn.json";

const counter = code(({ context, count }) => {
  const num = (count as number) - 1;
  if (num != 0) {
    return { continue: context, count: num };
  }
  return { stop: context };
});

export default await board(({ agent, context, max }) => {
  context
    .title("Context")
    .isArray()
    .format("multiline")
    .examples("[]")
    .description("Initial conversation context");
  max
    .title("Max")
    .description(
      "The maximum number of loops to make (set to -1 to go infinitely)"
    )
    .isNumber()
    .examples("3");

  agent.title("Agent").description("Agent to loop").examples(sampleAgent);

  const invokeAgent = core.invoke({
    $id: "invokeAgent",
    path: agent.memoize(),
    context,
  });

  const count = counter({
    $id: "counter",
    context: invokeAgent.context,
    count: max,
  });

  count.continue.as("context").to(invokeAgent);
  count.count.to(count);

  return { context: count.stop };
}).serialize({
  title: "Agent Loop",
  description:
    "An experiment: a board that represents an iterative loop over an agent",
  version: "0.0.1",
});
