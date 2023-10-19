/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const core = board.addKit(Core);
const kit = board.addKit(Starter);

/**
 * This final form of the ReAct implementation.
 *
 * This board actually incomplete: It requires tools to be passed in. The tools
 * are themselves graphs that will be invoked.
 *
 * This way, people can start with this same ReAct board and add their own tools
 * without modifying it.
 *
 * See `call-react-with-lambdas.ts` for an example of the tools are specified.
 */

// Define the input schema:
// - `text`: the query
// - `tools`: the list of tools
const input = board.input({
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Question",
        description: "Ask ReAct a question",
      },
      tools: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              description: "The name of the tool.",
            },
            description: {
              type: "string",
              description: "A description of the tool.",
            },
            path: {
              type: "string",
              description: "The path to the tool.",
              format: "uri",
            },
          },
          required: ["tool", "description", "path"],
        },
      },
    },
    required: ["text", "tools"],
  },
});

// The single node where all the important keys come from.
const secrets = kit.secrets(["PALM_KEY", "GOOGLE_CSE_ID"]);

// This is the jsonata node that extracts the tool names
// from the reflected graph.
const tools = kit.jsonata("*.tool ~> $join(', ')");

// This is the jsonata node that extracts the tool descriptions
// from the reflected graph.
const descriptions = kit.jsonata(
  "$join(*.($$.tool & ': ' & $$.description), '\n')"
);

input.wire("tools->json", tools).wire("tools->json", descriptions);

// This is the main ingredient: the template that makes the algo tick.
const reActTemplate = kit
  .promptTemplate(
    "Answer the following questions as best you can. You have access to the " +
      "following tools:\n\n{{descriptions}}\n\nUse the following " +
      "format:\n\nQuestion: the input question you must answer\nThought: you " +
      "should always think about what to do\nAction: the action to take, " +
      "should be one of: {{tools}}\nAction Input: the input to the action\n" +
      "Observation: the result of the action\n... " +
      "(this Thought/Action/Action Input/Observation can repeat N times)\n" +
      "Thought: I now know the final answer\nFinal Answer: the final answer to " +
      "the original input question\n\nBegin!\n\n{{memory}}\nThought:"
  )
  .wire("descriptions<-result.", descriptions)
  .wire("tools<-result.", tools);

/**
 * The following three nodes form the "memory" of the ReAct algo.
 * The are built out of the `append` node, which is a powerful tool
 * for accumulating information.
 *
 * We need three nodes to orchestrate the proper ordering of the memory:
 * - First, we need to remember the question.
 * - Second, we need to remember the thought.
 * - Third, we need to remember the observation.
 *
 * The second and third are remembered repeatedly in the ReAct algo cycle.
 *
 * Graphs are generally orderless, so extra work is necessary to make this
 * ordering happen.
 */

// When the observation arrives from the tools, we use this node
// to append it to the memory.
// This node wires directly to the `reActTemplate` node,
// since it's at the end of our order.
const rememberObservation = kit
  .append({ $id: "rememberObservation" })
  .wire("accumulator->memory", reActTemplate);

// When the thought arrives from the completion, we use this node
// to append it to the memory.
// Notice how the `accumulator` is wired in a cycle with the
// `rememberObservation` node. This is what allows ordering in a cycle.
const rememberThought = kit
  .append({ $id: "rememberThought" })
  .wire("accumulator->", rememberObservation)
  .wire("accumulator<-", rememberObservation);

// When the question arrives from the input, we use this node
// to append it to the memory.
// We wire its accumulator to `rememberThought`, so that
// the `rememberThought` node has an initial accumulator value.
// We also wire its accumulator to the `reActTemplate` node for the same
// reason: when the first iteration starts, there aren't any thoughts or
// observations yet.
const rememberQuestion = kit
  .append({ $id: "rememberQuestion" })
  .wire("accumulator->", rememberThought)
  .wire("accumulator->memory", reActTemplate);

// Wire input to the `rememberQuestion` node, to provide the question to
// remember.
input.wire("text->Question", rememberQuestion);

// The completion must include stop sentences, to prevent LLM form hallucinating
// all answers.
const reActCompletion = kit
  .generateText({
    stopSequences: ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-PALM_KEY.", secrets);

// Parse the response of the shape:
//   Action: <action name> --> tool
//   Action Input: <action input> --> args
// or
//   Final Answer: <answer> --> answer
const parser = kit.jsonata(
  "{ " +
    "'tool': $match($, /Action: (.+)$/m).groups[0], " +
    "'args': $match($, /Action Input: (.+)$/m).groups[0], " +
    "'answer': $match($, /Final Answer: (.+)$/m).groups[0] }",
  { raw: true }
);

// Call the LLM, remember the thought and parse the response
reActTemplate.wire(
  "prompt->text",
  reActCompletion
    .wire("completion->Thought", rememberThought)
    .wire("completion->json", parser)
);

// Now call the action. The action is a graph that is invoked. The graph is
// specified by the `path` property of the tool. The `args` property is the
// input to the graph, by convention we map the input string to an argument
// named after the tool.
core
  .invoke()
  .wire(
    "*<-",
    kit
      .jsonata("tools[tool = $$.tool]", { raw: true })
      .wire("tool<-", parser)
      .wire("tools<-.", input)
  )
  .wire("text<-args", parser)
  .wire("text->Observation", rememberObservation);

parser.wire("answer->text", board.output());

export default board;
