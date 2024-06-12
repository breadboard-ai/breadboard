import { board, base, code, OutputValues, BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import serialized from "./simplied-hacker-news-algolia-search"

const limitInputSchema = {
    type: "number",
    title: "limit",
    default: "1",
    description: "The limit"
}

const querySchema = {
    type: "string",
    title: "query",
    default: "JavaScript",
    description: "The query"
}

const tagsSchema = {
    type: "string",
    title: "tags",
    default: "JavaScript",
    description: "The tags"
}

const run = code<{ graph: GraphDescriptor }>(async (inputs) => {
    const {graph} = inputs
    const runner = await BoardRunner.fromGraphDescriptor(graph);
    for await (const stop of runner.run( )) {
        if (stop.type === "input") {
            stop.inputs = {
                query: "Docker",
                tags: "story"
            };
        } else if (stop.type === "output") {
            return { output: stop.outputs};
        }
    }
});

export default await board(() => {
    const input = base.input({
        $id: "query",
        schema: {
            title: "Algolia Limit",
            properties: {
                query: querySchema,
                limit: limitInputSchema,
                tags: tagsSchema,
            },
        },
        type: "string",
    })

    const res = run(serialized)
    return {
        output: res
    }

}).serialize({
    title: "WRAPPED TEST",
    description: "Board which returns API results based on a query using the Hacker News Angolia API",
    version: "0.0.1",
})

