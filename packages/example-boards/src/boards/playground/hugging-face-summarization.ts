import { board, base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const inputsSchema = {
    type: "string",
    title: "inputs",
    default: "data",
    description: "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct."
};

const keySchema = {
    type: "string",
    title: "apiKey",
    default: "myKey",
    description: "The hugging face api key"
};

const minLengthSchema = {
    type: "string",
    title: "number",
    default: "None",
    description: "Integer to define the minimum length in tokens of the output summary"
};

const maxLengthSchema = {
    type: "number",
    title: "max_length",
    default: "None",
    description: "Integer to define the maximum length in tokens of the output summary"
};

const topKSchema = {
    type: "number",
    title: "top_k",
    default: "None",
    description: "Integer to define the top tokens considered within the sample operation to create new text"
};

const topPSchema = {
    type: "number",
    title: "top_P",
    default: "None",
    description: "Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p"
};

const temperatureSchema = {
    type: "number",
    title: "temperature",
    default: "1.0",
    description: "The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability"
};

const repetitionPenaltySchema = {
    type: "number",
    title: "repetition_penalty",
    default: "1.0",
    description: "The more a token is used within generation the more it is penalized to not be picked in successive generation passes"
};

const maxTimeSchema = {
    type: "number",
    title: "max_time",
    default: "None",
    description: "The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit"
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

export type HuggingFaceSummarizationParams = {
    inputs: string
    parameters: {
        min_length: number;
        max_length: number;
        top_k: number;
        top_p: number;
        temperature: number;
        repetition_penalty: number;
        max_time: number;

        options: {
            use_cache: boolean
            wait_for_model: boolean
        }
    }
};

const authenticate = code<{ key: string }>((inputs) => {
    const key = inputs.key
    const auth = { Authorization: `Bearer ${key}` }

    return { auth };
});

const handleParams = code<{ inputs: string, min_length: number, max_length: number, top_k: number, top_p: number, temperature: number, repetition_penalty: number, max_time: number }>((input) => {
    const { inputs, min_length, max_length, top_k, top_p, temperature, repetition_penalty, max_time } = input
    const request: HuggingFaceSummarizationParams = {
        inputs: inputs,
        parameters: {
            min_length: min_length, max_length: max_length, top_k: top_k, top_p: top_p, temperature: temperature, repetition_penalty: repetition_penalty, max_time: max_time,
            options: {
                use_cache: false,
                wait_for_model: false
            }
        }
    };

    const payload = JSON.stringify(request);

    return { payload }
});

export default await board(() => {
    const inputs = base.input({
        $id: "query",
        schema: {
            title: "Hugging Face Schema For Summarization",
            properties: {
                inputs: inputsSchema,
                apiKey: keySchema,
                min_length: minLengthSchema,
                max_length: maxLengthSchema,
                top_k: topKSchema,
                top_p: topPSchema,
                temperature: temperatureSchema,
                repetition_penalty: repetitionPenaltySchema,
                max_time: maxTimeSchema,
                use_cache: useCacheSchema,
                wait_for_model: waitForModelSchema
            },
        },
        type: "string",
    });

    const task = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
    const output = base.output({ $id: "main" });

    const { auth } = authenticate({ key: inputs.apiKey.isString() });
    const { payload } = handleParams({
        inputs: inputs.inputs.isString(),
        min_length: inputs.min_length.isNumber(),
        max_length: inputs.max_length.isNumber(),
        top_k: inputs.top_k.isNumber(),
        top_p: inputs.top_p.isNumber(),
        temperature: inputs.temperature.isNumber(),
        repetition_penalty: inputs.repetition.isNumber(),
        max_time: inputs.max_time.isNumber()
    });

    const response = core.fetch({
        headers: auth,
        method: "POST",
        body: payload,
        url: task
    });

    response.to(output)

    return { output }
}).serialize({
    title: "Hugging Face Summarization Board",
    description: "Board which calls the Hugging Face Summarization Endpoint"
});

