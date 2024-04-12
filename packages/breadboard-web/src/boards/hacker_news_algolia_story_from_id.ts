import { board, base, code} from "@google-labs/breadboard";

import  { core } from "@google-labs/core-kit";
import  { templates } from "@google-labs/template-kit";

const storyInputSchema = {
    type: "string",
    title: "Story ID",
    default: "39788322",
    description: "Hacker News Story ID to extract",
};

const spread = code<{ object: object }>((inputs) => {
    const object = inputs.object;
    if (typeof object !== "object") {
        throw new Error(`object is of type ${typeof object} not object`);
    }
    return { ...object };
});

export default await board(() => {
    const input = base.input({
        $id: "storyID",
        schema: {
            title: "Hacker News Story",
            properties: {
                storyID: storyInputSchema
            },
        }
    })

    const urlTemplate = templates.urlTemplate({
        $id: "urlTemplate",
        template: "https://hn.algolia.com/api/v1/items/{storyID}",
        storyID: input.storyID
    });
    
    const fetchUrl = core.fetch({ $id: "fetch", method: "GET", url: urlTemplate.url});
    const output = base.output({ $id: "main" });
    const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

    response.to(output)

    return {output}

}).serialize({
    title: "Hacker News Algolia API Story by ID",
    description: "Board which returns story contents using the Hacker News Algolia API",
    version: "0.0.1",
})
