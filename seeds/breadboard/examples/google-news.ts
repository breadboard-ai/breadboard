/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Breadboard, Starter } from "@google-labs/breadboard";
import { toMermaid } from "@google-labs/graph-runner";
import { writeFile } from "fs/promises";

import { config } from "dotenv";

config();

// Create an new breadboard.
const breadboard = new Breadboard();

// Get a starter kit.
// Starter kit contains helper methods to create useful nodes.
// To work, a starter kit needs to be associated with the instance of
// the breadboard on which we're wiring the nodes.
const kit = new Starter(breadboard);

// Create a new text template node.
const summarizeResults = kit.textTemplate(
  "Use the news headlines below to write one or two sentences to summarize the latest news on this topic:\n\n##Topic:\n{{topic}}\n\n## Headlines {{headlines}}\n\\n## Summary:\n"
);

// Create a new url template node.
const newsUrl = kit.urlTemplate(
  "https://news.google.com/rss/search?q={{query}}&hl=en-US&gl=US&ceid=US:en"
);

// Wire input to the text template and the url template.
kit
  .input("What news topic would you like to have summarized?")
  .wire("text->topic", summarizeResults)
  .wire("text->query", newsUrl);

// Create a new fetch node.
const fetchHeadlines = kit.fetch();

// Wire the url template to the fetch node.
newsUrl.wire("url", fetchHeadlines);

// Create a new JSONata node.
const parseHeadlines = kit.jsonata(
  "$join((rss.channel.item.title.`$t`)[[1..20]], `\n`)"
);

// Wire a whole series of nodes together:
// - fetch node to the XML-to-JSON node
// - XML-to-JSON to the JSONata node.
// - JSONata node to the text template node.
fetchHeadlines.wire(
  "response->xml",
  kit
    .xmlToJson()
    .wire("json", parseHeadlines.wire("result->headlines", summarizeResults))
);

// Create a new text completion node and wire it to the output.
const textCompletion = kit
  .textCompletion()
  .wire("completion->text", kit.output());

// Wire secrets node (containing API_KEY) to the text completion node.
kit.secrets(["API_KEY"]).wire("API_KEY", textCompletion);

// Wire the text template node to the text completion node.
summarizeResults.wire("prompt->text", textCompletion);

// Save resulting breadboard
await writeFile(
  "examples/google-news.json",
  JSON.stringify(breadboard, null, 2)
);

// .. or turn it into a diagram
await writeFile(
  "examples/google-news.md",
  `# Google News Diagram\n\n\`\`\`mermaid\n${toMermaid(breadboard)}\n\`\`\``
);

// Run the breadboard:

// Add the inputs.
breadboard.addInputs({ text: "Breadboards" });

// Add the output event handler
breadboard.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log(detail.text);
});

// ... and run!
await breadboard.run();
