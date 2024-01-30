import { recipe, code, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Generate Completion",
  description:
    "Creates a completion from Gemini for use in generateCompletion standard recipe",
  version: "0.0.3",
};

/*
 Note currently the tool to generate the OpenAPI spec does not support the security Scheme, therefore secrets will not work, you have to use an input called key.
*/
export default await recipe(({ prompt, temperature, topP, topK }) => {
  prompt.title("prompt").description("The prompt to complete");
  temperature
    .title("temperature")
    .description("The model temperature (0.0-1.0 - lower value more creative)")
    .isNumber()
    .optional()
    .default(0.9); // https://ai.google.dev/models/gemini#model_metadata
  topP
    .title("topP")
    .description("The model topP")
    .isNumber()
    .optional()
    .default(1); // https://ai.google.dev/models/gemini#model_metadata
  topK
    .title("topK")
    .description("The model topK")
    .isNumber()
    .optional()
    .default(1); // https://ai.google.dev/models/gemini#model_metadata

  const convertRequest = code(({ prompt, temperature, topP, topK }) => {
    const request = {
      temperature: temperature,
      // maxOutputTokens: api_inputs.maxOutputTokens || undefined,
      topK: topK,
      // candidateCount: undefined, // candidateCount is not well defined across LLMs as a concept yet.
      topP: topP,
      prompt: {
        text: prompt,
      },
      // stopSequences: api_inputs.stopSequences || undefined,
      // safetySettings: undefined, // Safety Settings is not well defined across LLMs as a concept yet.
    };

    return { requestBody: request };
  });

  const convertResponse = code((api_response) => {
    return { text_response: api_response.candidates[0].content.parts.text };
  });

  return core
    .invoke({
      path: "./api/generativelanguage.models.generateText.json",
      ...convertRequest({
        $id: "convertGeminiGenerateTextRequest",
        prompt,
        temperature,
        topP,
        topK,
      }),
    })
    .to(convertResponse({ $id: "convertGeminiGenerateTextResponse" }));
}).serialize(metaData);
