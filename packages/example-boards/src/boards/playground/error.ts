import { board, input, output } from "@breadboard-ai/build";
import { jsonata } from "@google-labs/json-kit";

const text = input({
  default: "Could you please throw an error?"
});

const error = jsonata({
  $metadata: { title: "Throw An Error" },
  json: text,
  expression: '$assert(false, "Here is an error!")',
}).unsafeOutput("result");

const stub = output(error);

export default board({
  title: "Error Board",
  description: "Use this board to test error handling. It will throw an error when run.",
  version: "0.1.0",
  inputs: { text },
  outputs: { stub },
});