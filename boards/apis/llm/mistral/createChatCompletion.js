/*
To run this:

1. Create an environment variable called MISTRAL_API_KEY with your API key
2. npx breadboard run createChatCompletion.js --kit @google-labs/core-kit --kit @google-labs/llm-starter -i "{ \"api_inputs\": {
      \"authentication\": {
        \"bearer\": \"MISTRAL_API_KEY\"
      },
      \"application/json\": {
        \"messages\": [
          {
            \"role\": \"user\",
            \"content\": \"What is the best French cheese?\"
          }
        ],
        \"model\": \"mistral-small\"
      }
    }
}"
*/

/*
 Note currently the tool to generate the OpenAPI spec does not support the security Scheme, therefore secrets will not work, you have to use an input called key.
*/
import { board, code, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Generate Completion with Mistral",
  description:
    "Creates a completion from Mistral for use in generateCompletion standard board",
  version: "0.0.3",
};

/*
 Note currently the tool to generate the OpenAPI spec does not support the security Scheme, therefore secrets will not work, you have to use an input called key.
*/
export default await board(
  ({ model, prompt, temperature, topP, authentication }) => {
    prompt.title("prompt").description("The prompt to complete");
    model
      .title("model")
      .description("The model to interact with")
      .optional()
      .default("mistral-small");
    temperature
      .title("temperature")
      .description(
        "The model temperature (0.0-1.0 - lower value more creative)"
      )
      .isNumber()
      .optional()
      .default(0.7); // https://docs.mistral.ai/api/#operation/createChatCompletion
    topP
      .title("topP")
      .description("The model topP")
      .isNumber()
      .optional()
      .default(1); // https://docs.mistral.ai/api/#operation/createChatCompletion

    const convertRequest = code(
      ({ model, prompt, temperature, topP, authentication }) => {
        const request = {
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: temperature,
          model,
          top_p: topP,
        };

        return { authentication, requestBody: request };
      }
    );

    const convertResponse = code(({ api_json_response }) => {
      return { text_response: api_json_response.choices[0].message.content };
    });

    return core
      .invoke({
        path: "./api/createChatCompletion.json",
        ...convertRequest({
          $id: "convertMistralcreateChatCompletionRequest",
          prompt,
          temperature,
          topP,
          model,
          authentication,
        }),
      })
      .to(
        convertResponse({ $id: "convertMistralcreateChatCompletionResponse" })
      );
  }
).serialize(metaData);
