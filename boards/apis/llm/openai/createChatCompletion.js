import { recipe, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Generate Completion with OpenAI",
  description:
    "Creates a completion from OpenAI for use in generateCompletion standard recipe",
  version: "0.0.3",
};

/*
 Note currently the tool to generate the OpenAPI spec does not support the security Scheme, therefore secrets will not work, you have to use an input called key.
*/
export default await recipe(({ model, prompt, temperature, topP }) => {
  prompt.title("prompt").description("The prompt to complete");
  temperature
    .title("temperature")
    .description("The model temperature (0.0-1.0 - lower value more creative)")
    .isNumber()
    .optional()
    .default(1); // https://platform.openai.com/docs/api-reference/completions/create
  topP
    .title("topP")
    .description("The model topP")
    .isNumber()
    .optional()
    .default(1); //https://platform.openai.com/docs/api-reference/completions/create

  const convertRequest = code(({ model, prompt, temperature, topP }) => {
    const request = {
      temperature: temperature,
      model,
      // maxOutputTokens: api_inputs.maxOutputTokens || undefined,
      // candidateCount: undefined, // candidateCount is not well defined across LLMs as a concept yet.
      top_p: topP,
      prompt,
      // stopSequences: api_inputs.stopSequences || undefined,
      // safetySettings: undefined, // Safety Settings is not well defined across LLMs as a concept yet.
    };

    return { requestBody: request };
  });

  const convertResponse = code(({ api_json_response }) => {
    return { text_response: api_json_response.choices[0].text };
  });

  return core
    .invoke({
      path: "./api/createCompletion.json",
      ...convertRequest({
        $id: "convertOpenAIcreateCompletionRequest",
        prompt,
        temperature,
        topP,
        model,
      }),
    })
    .to(convertResponse({ $id: "convertOpenAIcreateCompletionResponse" }));
}).serialize(metaData);
