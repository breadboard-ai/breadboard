import { board, base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const inputsSchema = {
    type: "string",
    title: "inputs",
    default: "Hi, I recently bought a device from your company but it is not working as advertised and I would like to get reimbursed!",
    description: "The data to send to the hugging face api labelling endpoint"
};

const keySchema = {
    type: "string",
    title: "apiKey",
    default: "myKey",
    description: "The hugging face api key"
};

const candidateLabelsSchema = {
    type: "list",
    title: "candidate_lebels",
    default: "[refund, legal, faq]",
    description: "The labels to mark the input"
};

const multiLabelSchema = {
    type: "boolean",
    title: "multi_label",
    default: "true",
    description: "Flag to indicate if multi labels are allowed"
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

export type HuggingFaceLabellingParams = {
    inputs: string;
    parameters: {
        candidate_labels: string[];
        multi_label: boolean;

        options: {
            use_cache: boolean;
            wait_for_model: boolean;
        }
    }
};

const authenticate = code<{ key: string }>((inputs) => {
    const key = inputs.key
    const auth = { Authorization: `Bearer ${key}` }

    return { auth };
});

const handleParams = code<{ inputs: string, candidate_labels: string[], multi_label: boolean, use_cache: boolean, wait_for_model: boolean }>((input) => {
    const {
        inputs,
        candidate_labels,
        multi_label,
        use_cache,
        wait_for_model
    } = input

    const payload: HuggingFaceLabellingParams = {
        inputs: inputs,
        parameters: {
            candidate_labels: candidate_labels,
            multi_label: multi_label,
            options: {
                use_cache: use_cache,
                wait_for_model: wait_for_model
            }
        }
    };

    return { payload }
});

export default await board(() => {
    const inputs = base.input({
        $id: "query",
        schema: {
            title: "Hugging Face Schema For text labelling",
            properties: {
                inputs: inputsSchema,
                apiKey: keySchema,
                candidate_labels: candidateLabelsSchema,
                multi_label: multiLabelSchema,
                use_cache: useCacheSchema,
                wait_for_model: waitForModelSchema
            },
        },
        type: "string",
    });

    const task = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
    const output = base.output({ $id: "main" });

    const { auth } = authenticate({ key: inputs.apiKey.isString() });
    const { payload } = handleParams({
        inputs: inputs.inputs.isString(),
        candidate_labels: inputs.candidate_labels as unknown as string[],
        multi_label: inputs.multi_label.isBoolean(),
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
    title: "Hugging Face Labelling Board",
    description: "Board which calls the Hugging Face Labelling Endpoint"
});
