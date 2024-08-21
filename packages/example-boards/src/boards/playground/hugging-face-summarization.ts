import { board, input, object, output } from "@breadboard-ai/build";
import { code, secret, fetch } from "@google-labs/core-kit";

const inputs = input({
    type: "string",
    title: "inputs",
    default: "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct.",
    description: "The data to send to the hugging face api summarization endpoint"
});

const apiKey = secret("HUGGING_FACE_API_KEY");

const minLength = input({
    type: "number",
    title: "minLength",
    description: "Integer to define the minimum length in tokens of the output summary"
});

const maxLength = input({
    type: "number",
    title: "maxLength",
    description: "Integer to define the minimum length in tokens of the output summary"
});

const topK = input({
    type: "number",
    title: "top_k",
    description: "Integer to define the top tokens considered within the sample operation to create new text"
});

const topP = input({
    type: "number",
    title: "top_P",
    description: "Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p"
});

const temperature = input({
    type: "number",
    title: "temperature",
    default: 1.0,
    description: "The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability"
});

const repetitionPenalty = input({
    type: "number",
    title: "repetition_penalty",
    default: 1.0,
    description: "The more a token is used within generation the more it is penalized to not be picked in successive generation passes"
});

const maxTime = input({
    type: "number",
    title: "max_time",
    description: "The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit"
});

const useCache = input({
    type: "boolean",
    title: "use_cache",
    default: true,
    description: "Boolean. There is a cache layer on the inference API to speedup requests we have already seen. Most models can use those results as is as models are deterministic (meaning the results will be the same anyway). However if you use a non deterministic model, you can set this parameter to prevent the caching mechanism from being used resulting in a real new query"
});

const waitForModel = input({
    type: "boolean",
    title: "wait_for_model",
    default: false,
    description: " Boolean. If the model is not ready, wait for it instead of receiving 503. It limits the number of requests required to get your inference done. It is advised to only set this flag to true after receiving a 503 error as it will limit hanging in your application to known places"
});

const makeHeaders = code(
    { apiKey },
    { headers: object({ Authorization: "string" }) },
    ({ apiKey }) => {
        return { headers: { Authorization: `Bearer ${apiKey}` } };
    }
);

const makePayload = code(
    { inputs, minLength, maxLength, topK, topP, temperature, repetitionPenalty, maxTime, useCache, waitForModel },
    { 
        payload: "string"
    },
    ({ inputs, minLength, maxLength, topK, topP, temperature, repetitionPenalty, maxTime, useCache, waitForModel }) => {
        const request = {
            inputs,
            parameters: {
                min_length: minLength > 0 ? minLength : "None", 
                max_length: maxLength > 0 ? maxLength : "None", 
                top_k: topK > 0 ? topK : "None", 
                top_p: topP > 0 ? topP : "None", 
                temperature: temperature, 
                repetition_penalty: repetitionPenalty, 
                max_time: maxTime > 0 ? maxTime : "None",
            },
            options: {
                use_cache: useCache,
                wait_for_model: waitForModel
            }
        }

        return { payload: JSON.stringify(request) };
    }
);

const fetchResult = fetch({
    headers: makeHeaders.outputs.headers,
    method: "POST",
    body: makePayload.outputs.payload,
    url: "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
});

export default board({
    title: "Hugging Face Summarization Board",
    description: "Board which calls the Hugging Face Summarization Endpoint",
    inputs: { inputs, minLength, maxLength, topK, topP, temperature, repetitionPenalty, maxTime, useCache, waitForModel },
    outputs: { result: output(fetchResult.outputs.response)},
});