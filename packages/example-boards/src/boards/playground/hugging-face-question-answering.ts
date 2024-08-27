import { board, input, object, output } from "@breadboard-ai/build";
import { code, secret, fetch } from "@google-labs/core-kit";

const question = input({
    type: "string",
    title: "question",
    default: "What is my name?",
    description: "The data to send to the hugging face api question answering endpoint"
});

const apiKey = secret("HUGGING_FACE_API_KEY");

const context = input({
    type: "string",
    title: "context",
    default: "My name is Clara and I live in Berkeley.",
    description: "context for the question being asked"
});

const makeHeaders = code(
    { apiKey },
    { headers: object({ Authorization: "string" }) },
    ({ apiKey }) => {
        return { headers: { Authorization: `Bearer ${apiKey}` } };
    }
);

const makePayload = code(
    { question, context },
    {
        payload: object({
            inputs: object({
                question: "string",
                context: "string",
            })
        })
    },
    ({ question, context }) => {
        const request = { inputs: { question, context } }
        return { payload: request };
    }
);

const fetchResult = fetch({
    headers: makeHeaders.outputs.headers,
    method: "POST",
    body: makePayload.outputs.payload,
    url: "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2"
});

export default board({
    title: "Hugging Face Question Answering Board",
    description: "Board which calls the Hugging Face Question Answering Endpoint",
    inputs: { question, context },
    outputs: { result: output(fetchResult.outputs.response)},
});