import { board, base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const questionSchema = {
    type: "string",
    title: "question",
    default: "What is my name?",
    description: "The data to send to the hugging face api question answering endpoint"
};

const keySchema = {
    type: "string",
    title: "apiKey",
    default: "myKey",
    description: "The hugging face api key"
};

const contextSchema = {
    type: "string",
    title: "context",
    default: "My name is Clara and I live in Berkeley.",
    description: "context for the question being asked"
};

export type HuggingQuestionAnsweringParams = {
    inputs: {
        question: string
        context: string
    }
};

const authenticate = code<{ key: string }>((inputs) => {
    const key = inputs.key
    const auth = { Authorization: `Bearer ${key}` }

    return { auth };
});

const handleParams = code<{ question: string, context: string }>((input) => {
    const { question, context, } = input

    const payload: HuggingQuestionAnsweringParams = {
        "inputs": {
            question: question,
            context: context,
        }
    }

    return { payload }
});

export default await board(() => {
    const inputs = base.input({
        $id: "query",
        schema: {
            title: "Hugging Face Schema For Question Answering",
            properties: {
                question: questionSchema,
                apiKey: keySchema,
                context: contextSchema,
            },
        },
        type: "string",
    });

    const task = "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2"
    const output = base.output({ $id: "main" });

    const { auth } = authenticate({ key: inputs.apiKey.isString() });
    const { payload } = handleParams({ question: inputs.question.isString(), context: inputs.context.isString() });

    const response = core.fetch({
        headers: auth,
        method: "POST",
        body: payload,
        url: task
    });

    response.to(output);
    return { output }
}).serialize({
    title: "Hugging Face Question Answering Board",
    description: "Board which calls the Hugging Face Question Answering Endpoint"
});