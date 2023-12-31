import { base, recipe, code } from "@google-labs/breadboard";

import { starter } from "@google-labs/llm-starter";
import { core } from "@google-labs/core-kit";

// To run this: npx breadboard run recipes/tools/openapi/tests/openai.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://raw.githubusercontent.com/breadboard-ai/breadboard/c371c2cd5aca33673e30fc647c920228752e41ee/recipes/tools/openapi/tests/specs/openai.json\"}"

// YAML Open AI - https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml => https://raw.githubusercontent.com/breadboard-ai/breadboard/c371c2cd5aca33673e30fc647c920228752e41ee/recipes/tools/openapi/tests/specs/openai.json

const metaData = {
  title: "Create a board from an Open API spec",
  description: "Converts an Open API spec to a board.",
  version: "0.0.3",
};

export default await recipe(() => {
  const input = base.input({ $id: "input" });

  const getBoard = code(({ api }) => {
    return { graph: api.board };
  });

  const apiBoard = input.to(
    core.invoke({ path: "../index.json", url: input.url })
  );

  // This tests the input parameters
  return core
    .invoke()
    .in({
      graph: getBoard({ api: apiBoard.createEmbedding }),
      url: input.url,
      api_inputs: {
        bearer: "OPENAI_API_KEY",
        "application/json": {
          input:
            "Hello, my name is Paul and I'm not a large language model. I'm a real boy.",
          model: "text-embedding-ada-002",
        },
      },
    })
    .in(starter.secrets({ keys: ["OPENAI_API_KEY"] }));
}).serialize(metaData);
