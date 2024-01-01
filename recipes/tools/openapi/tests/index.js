import { base, recipe, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

// To run this: npx breadboard run recipes/tools/openapi/tests/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\"}"

const metaData = {
  title: "Create a board from an Open API spec",
  description: "Converts an Open API spec to a board.",
  version: "0.0.3",
};

export default await recipe(() => {
  const input = base.input({ $id: "input" });

  const apiBoard = core.invoke({ path: "../index.json", url: input.url });

  // This tests the input parameters
  return core.invoke().in({
    board: apiBoard.getAPI,
    input: {
      provider: "apis.guru",
      api: "2.2.0",
    },
  });
}).serialize(metaData);
