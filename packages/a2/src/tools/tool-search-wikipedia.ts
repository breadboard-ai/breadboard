/**
 * @fileoverview Raw Search Wikipedia tool.
 */

export { invoke as default, describe };

export type WikipediaInputs = {
  query: string;
};

export type WikipediaOutputs = {
  result: string[];
};

type WikipediaResponse = string[][];

type WikipediaPageResponse = {
  response: {
    query: {
      pages: {
        extract: string;
      }[];
    };
  };
};

function searchURL(query: string) {
  return `https://en.wikipedia.org/w/api.php?action=opensearch&search=${query}&origin=*`;
}

function pageQueryURL(page: string) {
  return `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=revisions%7Cextracts&titles=${page}&redirects=1&formatversion=2&rvlimit=1&explaintext=1&origin=*`;
}

async function invoke(
  { query }: WikipediaInputs,
  caps: Capabilities
): Promise<Outcome<WikipediaOutputs>> {
  if (!query) {
    return { $error: "No search query provided." };
  }

  const gettingTitles = await caps.fetch({
    url: searchURL(query),
    method: "GET",
  });
  if ("$error" in gettingTitles) {
    return gettingTitles as Outcome<WikipediaOutputs>;
  }
  const response = gettingTitles.response as WikipediaResponse;
  const titles =
    response.at(3)?.map((item) => decodeURIComponent(item.slice(30))) || [];
  if (!titles.length) {
    return { $error: `No titles found` };
  }
  const extracts = await Promise.all(
    titles.map(async (title) => {
      const gettingPage = (await caps.fetch({
        url: pageQueryURL(title),
        method: "GET",
      })) as Outcome<WikipediaPageResponse>;
      if ("$error" in gettingPage) {
        return { $error: `Error getting page: ${title}` };
      }
      console.log("GETTING PAGE", gettingPage.response);
      const extract = gettingPage.response.query.pages.at(0)?.extract;
      if (!extract) {
        return { $error: `Error getting extract: ${title}` };
      }
      return extract;
    })
  );
  const errors = extracts.filter((item) => typeof item !== "string");
  if (errors.length) {
    return { $error: errors.join("\n\n") };
  }
  return {
    result: extracts as string[],
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
          description: "The query to use for searching Wikipedia",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        result: {
          type: "object",
          title: "Result",
          description: "Wikipedia Search Result",
        },
      },
    } satisfies Schema,
  };
}
