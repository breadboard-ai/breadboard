import { board } from "@google-labs/breadboard";
import { json } from "@google-labs/json-kit";

export default await board(({ text }) => {
  text.default("Could you please throw an error?");
  const throwError = json.jsonata({
    $metadata: { title: "Throw An Error" },
    json: text,
    expression: '$assert(false, "Here is an error!")',
  });
  return { stub: throwError.result };
}).serialize({
  title: "Error board",
  description:
    "Use this board to test error handling. It will throw an error when run.",
});
