/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { EmbedTextResponse, palm } from "@google-labs/palm-lite";

const embedTextHandler = (
    text: string,
    PALM_KEY: string
)

export default defineNodeType({
    name: "embedText",
    metadata: {
        title: "Embed Text",
        description:
          "Uses `embedding-gecko-001` model to generate an embedding of a given text",
      },
      inputs: {
        text: {
            type: "string",
            format: "multiline",
            description: "Prompt for text completion.",
          },
          PALM_KEY: {
            type: "string",
            description: "The Google Cloud Platform API key",
          },
      },
      outputs: {
        embedding: {
            type: "array",
            title: "embedding",
            description: "The embedding of the text.",
            items: {
              type: "number",
            },
            minItems: 768,
            maxItems: 768,
          },
      },
      invoke: async ({ text, PALM_KEY }) => {
        if (!PALM_KEY)
          throw new Error("Embedding requires `PALM_KEY` input");
        if (!text) throw new Error("Embedding requires `text` input");
    
        const query = { text };
    
        let embedding: number[] | undefined;
        // Because Embedding API is a bit flaky, we try a few times before giving up.
        let tries = 3;
        while (!embedding && tries-- > 0) {
          try {
            const request = palm(PALM_KEY).embedding(query);
            const data = await fetch(request);
            const response = (await data.json()) as EmbedTextResponse;
            embedding = response?.embedding?.value;
          } catch (e) {
            // TODO: Implement proper error handling.
          }
        }
        if (!embedding)
          throw new Error(`No embedding returned for "${text}"`);
    
        return { embedding };
      },
});