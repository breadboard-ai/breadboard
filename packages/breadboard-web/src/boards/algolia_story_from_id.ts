import { board, base, asRuntimeKit, BoardRunner, code} from "@google-labs/breadboard";

import Core, { core } from "@google-labs/core-kit";
import TemplateKit, { templates } from "@google-labs/template-kit";

const storyInputSchema = {
    type: "string",
    title: "Story ID",
    default: "39788322",
    description: "HackerNews Story ID to extract",
};

const spread = code<{ object: object }>((inputs) => {
    const object = inputs.object;
    if (typeof object !== "object") {
        throw new Error(`object is of type ${typeof object} not object`);
    }
    return { ...object };
});

const boardSchema = "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/schema/breadboard.schema.json";

const firebaseBoardStoryFromId = await board(() => {
    const input = base.input({
        $id: "storyID",
        schema: {
            title: "Hacker News Story",
            properties: {
                storyID: storyInputSchema
            },
            required: ["storyID"],
        }
    })

    const urlTemplate = templates.urlTemplate({
        $id: "urlTemplate",
        template: "https://hn.algolia.com/api/v1/items/{storyID}",
    });

    input.to(urlTemplate);

    const fetchUrl = core.fetch({ $id: "fetch", method: "GET", url: urlTemplate.url});

    const output = base.output({ $id: "main" });

    const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

    response.to(output)

    return {output}

}).serialize({
    title: "Algolia Firebase API Story by ID",
    description: "Board which returns story contents",
    version: "0.0.1",
    url: "https://github.com/ExaDev/breadboard-examples/tree/hackerNews-toolworker/src/examples/hackerNews/algolia"
})

firebaseBoardStoryFromId.$schema = boardSchema

const kits = [asRuntimeKit(Core), asRuntimeKit(TemplateKit)]

const runner = await BoardRunner.fromGraphDescriptor(firebaseBoardStoryFromId);
for await (const stop of runner.run({ kits: kits })) {
    if (stop.type === "input") {
        stop.inputs = {
            storyID: "39788322",
        };
    } else if (stop.type === "output") {
        console.log(stop.outputs)
    }
}

export default firebaseBoardStoryFromId