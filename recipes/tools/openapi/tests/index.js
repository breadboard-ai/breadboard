import { base, recipe, code } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Create a board from an Open API spec",
  description: "Converts an Open API spec to a board.",
  version: "0.0.3",
};

export default await recipe(() => {
  const input = base.input({ $id: "input" });

  const output = base.output({ $id: "output" });

  const api = input.to(
    core.invoke({ path: "../index.json", url: input.url })
  ).listAPIs;

  core.invoke({ board: api.board }).to(output);

  return output;
}).serialize(metaData);
