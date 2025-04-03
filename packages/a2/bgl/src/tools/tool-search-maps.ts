/**
 * @fileoverview The guts of the Search Maps tool.
 */

import secrets from "@secrets";
import fetch from "@fetch";

import { ok } from "./a2/utils";

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

async function invoke({
  query,
}: SearchMapsInputs): Promise<Outcome<SearchMapsOutputs>> {
  const key = await secrets({ keys: ["GOOGLE_MAPS_API_KEY"] });
  if (!ok(key)) {
    return key;
  }
  const fetching = await fetch({
    url: "https://places.googleapis.com/v1/places:searchText",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": `${key.GOOGLE_MAPS_API_KEY}`,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.editorialSummary",
    },
    body: {
      textQuery: query,
    },
  });
  if (!ok(fetching)) {
    return fetching;
  }
  return {
    results: formatResults(query, fetching.response as SearchMapResults),
  };
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
