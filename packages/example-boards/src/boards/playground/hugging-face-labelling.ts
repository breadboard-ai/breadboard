import { array, board, input, object, output } from "@breadboard-ai/build";
import { code, secret, fetch } from "@google-labs/core-kit";

const inputs = input({
    type: "string",
    title: "inputs",
    default: "Hi, I recently bought a device from your company but it is not working as advertised and I would like to get reimbursed!",
    description: "The data to send to the hugging face api labelling endpoint"
});

const apiKey = secret("HUGGING_FACE_API_KEY");

const candidateLabels = input({
    type: array("string"),
    title: "candidate_labels",
    default: ["refund", "legal", "faq"],
    description: "The labels to mark the input"
});

const multiLabel = input({
    type: "boolean",
    title: "multi_label",
    default: true,
    description: "Flag to indicate if multi labels are allowed"
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
    { inputs, candidateLabels, multiLabel, useCache, waitForModel },
    {
        payload: object({
            inputs: "string", 
            parameters: object({
                candidate_labels: array("string"),
                multi_label: "boolean",
                options: object({
                    use_cache: "boolean",
                    wait_for_model: "boolean"
                })
            })
        })
    },
    ({ inputs, candidateLabels, multiLabel, useCache, waitForModel }) => {
        const request = {
            inputs: inputs,
            parameters: {
                candidate_labels: candidateLabels,
                multi_label: multiLabel,
                options: {
                    use_cache: useCache,
                    wait_for_model: waitForModel
                }
            }
        }
        return { payload: request };
    }
);

const fetchResult = fetch({
    headers: makeHeaders.outputs.headers,
    method: "POST",
    body: makePayload.outputs.payload,
    url: "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
});

export default board({
    title: "Hugging Face Labelling Board",
    description: "Board which calls the Hugging Face Labelling Endpoint",
    inputs: { inputs, candidateLabels, multiLabel, useCache, waitForModel },
    outputs: { result: output(fetchResult.outputs.response)},
});