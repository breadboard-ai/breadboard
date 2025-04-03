/**
 * @fileoverview The guts of the Search Maps tool.
 */

import secrets from "@secrets";
import fetch from "@fetch";

import { ok, err } from "./a2/utils";
import { executeTool } from "./a2/step-executor";

export { invoke as default, describe };

export type SearchMapsInputs = {
  query: string;
};

export type SearchMapsOutputs = {
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

function formatResults(query: string, results: SearchMapResults) {
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

async function executeMapSearch(query: string): Promise<Outcome<string>> {
  const executing = await executeTool<SearchMapResults>("map_search", {
    query,
  });
  if (!ok(executing)) return executing;

  return formatResults(query, executing);
}

async function invoke({
  query,
}: SearchMapsInputs): Promise<Outcome<SearchMapsOutputs>> {
  const results = await executeMapSearch(query);
  if (!ok(results)) return results;

  return { results };
}

async function describe() {
  return {
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
  };
}
