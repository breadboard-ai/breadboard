/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";

const metaData = {
  title: "Fetch an RSS feed",
  description:
    "Fetch an RSS feed and return the title and description of the first item.",
  version: "0.0.3",
};

const urlSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      title: "URL",
      description: "The URL of the RSS feed to fetch.",
    },
  },
  required: ["text"],
};

export default await recipe(async () => {
  const fetchFeed = base
    .input({ $id: "input", schema: urlSchema })
    .url.to(
      starter.fetch({
        $id: "fetch",
        raw: true,
      })
    )
    .response.as("xml")
    .to(starter.xmlToJson({ $id: "xmlToJson" }));

  starter
    .jsonata({
      json: fetchFeed.json,
      expression:
        "{ 'title': rss.channel.title.`$t`[0], 'description':rss.channel.description.`$t`[0], 'link': rss.channel.link.`$t`[0], 'pubDate': rss.channel.pubDate.`$t`[0], 'lastBuildDate': rss.channel.lastBuildDate.`$t`[0], 'language': rss.channel.language.`$t`[0], 'generator': rss.channel.generator.`$t`[0], 'docs': rss.channel.docs.`$t`[0], 'ttl': rss.channel.ttl.`$t`[0], 'image': rss.channel.image.`$t`[0], 'itemCount': rss.channel.item.length }",
    })
    .result.as("feed")
    .to(base.output({ $id: "feedMetaData" }));

  return starter
    .jsonata({
      json: fetchFeed.json,
      expression:
        '$map(rss.channel.item, function($v) { { "title": $v.title.`$t`[0], "description": $v.description.`$t`[0], "link": $v.link.`$t`[0], "pubDate": $v.pubDate.`$t`[0] } })',
    })
    .result.as("items")
    .to(base.output({ $id: "feedItems" }));
}).serialize(metaData);
