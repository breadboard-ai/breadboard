import { board, base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";


const inputsSchema = {
    type: "string",
    title: "inputs",
    default: "I like you. I love you",
    description: "The data to send to the hugging face api text classification endpoint"
};

const keySchema = {
    type: "string",
    title: "apiKey",
    default: "myKey",
    description: "The hugging face api key"
};

const useCacheSchema = {
    type: "boolean",
    title: "use_cache",
    default: "true",
    description: "Boolean. There is a cache layer on the inference API to speedup requests we have already seen. Most models can use those results as is as models are deterministic (meaning the results will be the same anyway). However if you use a non deterministic model, you can set this parameter to prevent the caching mechanism from being used resulting in a real new query"
};

const waitForModelSchema = {
    type: "boolean",
    title: "wait_for_model",
    default: "false",
    description: " Boolean. If the model is not ready, wait for it instead of receiving 503. It limits the number of requests required to get your inference done. It is advised to only set this flag to true after receiving a 503 error as it will limit hanging in your application to known places"
};

export type HuggingFaceTextClassificationRawParams = {
    inputs: string
};

const authenticate = code<{ key: string }>((inputs) => {
    const key = inputs.key
    const auth = { Authorization: `Bearer ${key}` };

    return { auth };
});

const handleParams = code<{ inputs: string }>((input) => {
    const { inputs } = input

    const request: HuggingFaceTextClassificationRawParams = { inputs: inputs };
    const payload = JSON.stringify(request);

    return { payload }
})

export default await board(() => {
    const inputs = base.input({
        $id: "query",
        schema: {
            title: "Hugging Face Schema For Text Classification",
            properties: {
                inputs: inputsSchema,
                apiKey: keySchema,
                use_cache: useCacheSchema,
                wait_for_model: waitForModelSchema
            },
        },
        type: "string",
    });

    const task = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english"
    const output = base.output({ $id: "main" });

    const { auth } = authenticate({ key: inputs.apiKey.isString() });
    const { payload } = handleParams({
        inputs: inputs.inputs.isString(),
        use_cache: inputs.use_cache.isBoolean(),
        wait_for_model: inputs.wait_for_model.isBoolean()
    });

    const response = core.fetch({
        headers: auth,
        method: "POST",
        body: payload,
        url: task
    });

    response.to(output);
    return { output }
}).serialize({
    title: "Hugging Face Text Classification",
    description: "Board which calls the Hugging Face Text Classification Endpoint"
});
