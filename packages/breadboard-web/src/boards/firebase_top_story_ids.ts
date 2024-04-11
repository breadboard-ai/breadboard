import { board, base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const limitInputSchema = {
    type: "number",
    title: "Story Limit",
    default: "1",
    description: "The Number of HackerNews Story ID's to return"
}

const slice = code<{ list: number[], limit: number }>(({ list, limit }) => {
    return { output: list.slice(0, limit) }
})

const boardSchema = "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/schema/breadboard.schema.json";

export const firebaseBoardTopStoryIds = await board(() => {
    const input = base.input({
        $id: "limit",
        schema: {
            title: "Hacker News Story",
            properties: {
                limit: limitInputSchema
            },
        },
        type: "number",
    })

    const { response } = core.fetch({ $id: "fetch", method: "GET", url: "https://hacker-news.firebaseio.com/v0/topstories.json" });
    const output = base.output({ $id: "main" });
    const sliced = slice({ list: response as unknown as number[], limit: input.limit as unknown as number })

    sliced.to(output)

    return { output }
}).serialize({
    title: "Hacker News Firebase API Story IDs",
    description: "Board which returns the top story IDs from Hacker News",
    version: "0.0.1",})

firebaseBoardTopStoryIds.$schema = boardSchema

export default firebaseBoardTopStoryIds