/**
 * @fileoverview Search for location information.
 */

import { Outcome, Schema } from "@breadboard-ai/types";
import { ok } from "../a2/utils.js";
import { executeTool } from "../a2/step-executor.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
export { invoke as default, describe };

type Inputs = {
  query: string;
};

type Outputs = {
  results: string;
};

export type SearchMapResults = {
  places: {
    id: string;
    formattedAddress: string;
    websiteUri: string;
    rating: number;
    userRatingCount: number;
    displayName: {
      text: string;
      languageCode: string;
    };
    editorialSummary: {
      text: string;
      languageCode: string;
    };
  }[];
};

function formatResults(query: string, results: string | SearchMapResults) {
  // If the result is already in string format, not SearchMap results, return as is.
  if (typeof results == "string") {
    return `Search Query: ${query}
## Google Places Search Results
${results}
    `;
  }
  return `Search Query: ${query}


## Google Places Search Results

${results.places
  .map((place) => {
    const title = place.websiteUri
      ? `[${place.displayName.text}](${place.websiteUri})`
      : place.displayName.text;
    return `- ${title}\n
  ${place.editorialSummary?.text || ""} 
  Address: ${place.formattedAddress}
  User Rating: ${place.rating} (${place.userRatingCount} reviews)
  `;
  })
  .join("\n\n")}
`;
}

async function invoke(
  { query }: Inputs,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const executing = await executeTool<SearchMapResults>(
    moduleArgs,
    "map_search",
    {
      query,
    }
  );
  if (!ok(executing)) return executing;

  const results = formatResults(query, executing);
  return { results };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
  asType?: boolean;
};

async function describe() {
  return {
    title: "Search Maps",
    description: "Search for location information.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          title: "Query",
          description:
            "Google Places API search query, typically formulated as [type of place] near [location]",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "string",
          title: "Search Results",
        },
      },
    } satisfies Schema,

    metadata: {
      icon: "map-search",
      tags: ["quick-access", "tool", "component"],
      order: 2,
    },
  };
}
