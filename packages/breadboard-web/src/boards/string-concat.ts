import {base, board, code } from "@google-labs/breadboard";

const concatStrings = code<{ greeting: string, subject: string }>((inputs) => {
    const { greeting, subject } = inputs

    const concat = greeting.concat(subject)

    return { concat };
});

const greetingSchema = {
    type: "string",
    title: "My Greeting",
    default: "Hello",
    description: "The greeting"
};

const subjectSchema = {
    type: "string",
    title: "Subject",
    default: "World",
    description: "The subject we are greeting"
};

export default await board(() => {
    const inputs = base.input({
        $id: "String concatination Inputs",
        schema: {
            title: "Inputs for string concatination",
            properties: {
                greeting: greetingSchema,
                subject: subjectSchema
            },
        },
        type: "string",
    });

    const result = concatStrings({
        greeting: inputs.greeting as unknown as string,
        subject: inputs.subject as unknown as string
    })

    const output = base.output({ $id: "main" });

    result.to(output)

    return { output }

}).serialize({
    title: "String Concatenation",
    description: "Board which concatenates two strings together"
});