import {
  board, GraphDescriptor, OutputValues,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { templates } from "@google-labs/template-kit";

const gd: GraphDescriptor = await board<{query: string}, OutputValues>((inputs) => {
  const makeUrl = templates.urlTemplate({
    $id: "makeURL",
    template: "https://slack.com/api/search.messages?query={query}",
    query: inputs.query
  });

  const makeHeaders = json.jsonata({
    $id: "makeHeaders",
    expression: `{
        "Content-Type": "application/json",
        "Authorization": "Bearer " & $.SLACK_API_KEY
    }`,
    SLACK_API_KEY: core.secrets({ $id: "slackApiKeySecret", keys: ["SLACK_API_KEY"] }),
  })

  return core.fetch({
    $id: "fetchSearchResults",
    url: makeUrl.url,
    method: "GET",
    headers: makeHeaders.result
  })
}).serialize({
  title: "Slack search board",
  description: "Summarising slack search results",
  version: "0.0.1",
});

export default gd
