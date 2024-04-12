import { board, base, code, OutputValues } from "@google-labs/breadboard";

import  { core } from "@google-labs/core-kit";
import  { templates } from "@google-labs/template-kit";

export type PostItem = {
    author: string;
    created_at: string;
    created_at_i: number;
    id: number;
    children: Comment[];
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

const pageSchema = {
    type: "string",
    title: "page",
    default: "2",
    description: "the page"
}

export default await board(() => {
    const input = base.input({
        $id: "query",
        schema: {
            title: "Algolia Limit",
            properties: {
                query: querySchema,
                limit: limitInputSchema,
                tags: tagsSchema,
                page: pageSchema,
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
        page:input.page,
        tags:input.tags,

    });

    const fetchUrl = core.fetch({ $id: "fetch", method: "GET", url: urlTemplate.url });
    const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

    const sliced = slice({ list: response.hits as unknown as PostItem[], limit: input.limit as unknown as number })

    return {
        url: urlTemplate.url,
        output: sliced
    }

}).serialize({
    title: "Hacker News Angolia search ",
    description: "Board which returns API results based on a query using the Hacker News Angolia API",
    version: "0.0.1",
})
