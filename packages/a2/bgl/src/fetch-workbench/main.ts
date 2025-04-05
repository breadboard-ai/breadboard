/**
 * @fileoverview Add a description for your module here.
 */

import fetch from "@fetch";

export { invoke as default, describe };

type Inputs = {
  endpoint: string;
};

type Outputs = {
  result: unknown;
};

async function invoke({ endpoint }: Inputs): Promise<Outcome<Outputs>> {
  const response = await fetch({ url: endpoint, file: "/local/saved" });
  if ("$error" in response) return { $error: response.$error as string };
  return { result: response.response };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          title: "Endpoint URL",
          default: "https://echo.free.beeceptor.com",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        result: {
          type: "object",
          title: "Result",
        },
      },
    } satisfies Schema,
  };
}
