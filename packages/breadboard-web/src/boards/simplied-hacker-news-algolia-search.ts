import { board, base, code, OutputValues } from "@google-labs/breadboard";

import  { core } from "@google-labs/core-kit";
import  { templates } from "@google-labs/template-kit";

export type PostItem = {
    author: string;
    created_at: string;
    created_at_i: number;
    story_id: number;
    type: string;
};

export type Comment = PostItem & {
    parent_id: number;
    text: string;
    title: null;
};

export type Story = PostItem & {
    title: string;
    points: number;
    url: string;
};

export type HackerNewsAlgoliaSearchTags =
    | "story"
    | "comment"
    | "poll"
    | "pollopt"
    | "show_hn"
    | "ask_hn"
    | "front_page";
export type NumericFilterField = "created_at_i" | "points" | "num_comments";
export type Operator = "<" | "<=" | "=" | ">" | ">=";

export type HackerNewsSearchNumericFilters = {
    operator: Operator;
    field: NumericFilterField;
    value: number;
};

export type HackerNewAlgoliaSearchParameters = {
    query: string;
    tags?: HackerNewsAlgoliaSearchTags[];
    numericFilters?: HackerNewsSearchNumericFilters[];
    page?: number;
    limit?: number;
};

export type SearchHits = OutputValues & {
    hits: PostItem[];
};

const spread = code<{ object: object }>((inputs) => {
    const object = inputs.object;
    if (typeof object !== "object") {
        throw new Error(`object is of type ${typeof object} not object`);
    }
    return { ...object };
});


const slice = code<{ list: PostItem[], limit: number }>(({ list, limit }) => {
    return { output: list.slice(0, limit) }
})
// removes some of the fields returned from Hackernews
const trimResponse = code<{ list: PostItem[] }>(({ list}) => {
    list.forEach((item) => {
        delete item["children"]
        delete item["_highlightResult"]
        delete item["_tags"]
        delete item["points"]
        delete item["num_comments"]
        delete item["objectID"]
        delete item["updated_at"]
    })

    return { output: list }
})

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


const serialized = await board(() => {
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

    let baseURL = "https://hn.algolia.com/api/v1/search?query={query}"

    if (input.tags != undefined) {
        baseURL = baseURL + "&tags={tags}"
    }

    if (input.page != undefined) {
        baseURL = baseURL + "&page={page}"
    }

    const urlTemplate = templates.urlTemplate({
        $id: "urlTemplate",
        template: baseURL,
        query:input.query,
        page: 1,
        tags:input.tags,

    });

    const fetchUrl = core.fetch({ $id: "fetch", method: "GET", url: urlTemplate.url });
    const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

    const trimmed = trimResponse({list: response.hits as unknown as PostItem[]})

    const sliced = slice({ list: trimmed.output as unknown as PostItem[], limit: 10})

    return {
        url: urlTemplate.url,
        output: sliced
    }

}).serialize({
    title: "Simplified Hacker News Angolia search ",
    description: "Board which returns API results based on a query using the Hacker News Angolia API",
    version: "0.0.1",
})

export default serialized