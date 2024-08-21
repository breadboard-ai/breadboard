import { board, input, object, output } from "@breadboard-ai/build";
import { code, secret, fetch } from "@google-labs/core-kit";

const inputs = input({
    type: "string",
    title: "data",
    default: "Меня зовут Вольфганг и я живу в Берлине",
    description: "The data to send to the Hugging Face api Translation API (Russian To English)" 
});

const apiKey = secret("HUGGING_FACE_API_KEY");

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
    { inputs, useCache, waitForModel },
    { payload: object({ inputs: "string", options: object({ use_cache: "boolean", wait_for_model: "boolean" }) }) },
    ({ inputs, useCache, waitForModel }) => {
        const request = {
            inputs: inputs,
            options: {
                use_cache: useCache,
                wait_for_model: waitForModel
            }
        }
        return { payload: request };
    }
);

const fetchResult = fetch({
    headers: makeHeaders.outputs.headers,
    method: "POST",
    body: makePayload.outputs.payload,
    url: "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-ru-en"
});

export default board({
    title: "Hugging Face Translation Russian to English Board",
    description: "Board which calls the Hugging Face Translation Endpoint",
    inputs: { inputs, useCache, waitForModel },
    outputs: { result: output(fetchResult.outputs.response)},
});