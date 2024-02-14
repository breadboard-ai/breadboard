import { base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

/*
To run this: npx breadboard run generativelanguage.models.list.js --kit @google-labs/core-kit --kit @google-labs/llm-starter -i "{ \"api_inputs\": {
      \"key\": \"${GEMINI_API_KEY}\"
    }
}"
*/

const metaData = {
  title: "List models",
  description: "List models from Gemini.",
  version: "0.0.3",
};

/*
 Note currently the tool to generate the OpenAPI spec does not support the security Scheme, therefore secrets will not work, you have to use an input called key.
*/
export default await board(() => {
  const input = base.input({ $id: "input" });

  return core.invoke({
    path: "./spec/generativelanguage.models.embedText.json",
    input: input.api_inputs,
    ...input,
    ...core.secrets({ keys: ["GEMINI_API_KEY"] }),
  });
}).serialize(metaData);
